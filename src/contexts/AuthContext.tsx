import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  ecash_address: string;
  created_at: string;
  last_login_at?: string | null;
}

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  total_bets: number;
  total_wins: number;
  total_volume: number;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  sessionToken: string | null;
  loading: boolean;
  login: (ecashAddress: string, txHash?: string) => Promise<{ error: string | null }>;
  logout: () => void;
  updateProfile: (newProfile: Profile) => void;
  validateSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Simple eCash address validation
const isValidEcashAddress = (address: string): boolean => {
  const ecashRegex = /^ecash:q[a-z0-9]{41}$/;
  const legacyRegex = /^q[a-z0-9]{41}$/;
  return ecashRegex.test(address.toLowerCase()) || legacyRegex.test(address.toLowerCase());
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Validate session with server
  const validateSession = useCallback(async (): Promise<boolean> => {
    const storedToken = localStorage.getItem('ecash_session_token');
    
    if (!storedToken) {
      setUser(null);
      setProfile(null);
      setSessionToken(null);
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('validate-session', {
        body: { session_token: storedToken }
      });

      if (error || !data?.valid) {
        // Session invalid - clear local storage
        localStorage.removeItem('ecash_user');
        localStorage.removeItem('ecash_profile');
        localStorage.removeItem('ecash_session_token');
        setUser(null);
        setProfile(null);
        setSessionToken(null);
        return false;
      }

      // Session valid - update state with fresh server data
      setUser(data.user);
      setProfile(data.profile);
      setSessionToken(storedToken);
      
      localStorage.setItem('ecash_user', JSON.stringify(data.user));
      if (data.profile) {
        localStorage.setItem('ecash_profile', JSON.stringify(data.profile));
      }
      
      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  }, []);

  // Initialize auth state - validate session on load
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('ecash_session_token');
      
      if (storedToken) {
        // Validate session with server
        const isValid = await validateSession();
        if (!isValid) {
          console.log('Stored session is invalid or expired');
        }
      }
      
      setLoading(false);
    };

    initAuth();
  }, [validateSession]);

  // Login by checking for webhook-created session
  const login = async (ecashAddress: string, txHash?: string): Promise<{ error: string | null }> => {
    const trimmedAddress = ecashAddress.trim().toLowerCase();
    
    if (!isValidEcashAddress(trimmedAddress)) {
      return { error: 'Invalid eCash address format' };
    }

    try {
      // Query for session created by webhook for this address
      const { data, error } = await supabase.functions.invoke('validate-session', {
        body: { ecash_address: trimmedAddress, tx_hash: txHash }
      });

      if (error || !data?.valid) {
        // Webhook hasn't created session yet
        return { error: 'Session not ready - waiting for server verification' };
      }

      // Session found and valid
      setUser(data.user);
      setProfile(data.profile || null);
      setSessionToken(data.session_token);

      localStorage.setItem('ecash_user', JSON.stringify(data.user));
      localStorage.setItem('ecash_session_token', data.session_token);
      if (data.profile) {
        localStorage.setItem('ecash_profile', JSON.stringify(data.profile));
      }
      
      return { error: null };
    } catch (err) {
      console.error('Login error:', err);
      return { error: 'Authentication failed' };
    }
  };

  const logout = () => {
    setUser(null);
    setProfile(null);
    setSessionToken(null);
    localStorage.removeItem('ecash_user');
    localStorage.removeItem('ecash_profile');
    localStorage.removeItem('ecash_session_token');
  };

  const updateProfile = (newProfile: Profile) => {
    setProfile(newProfile);
    localStorage.setItem('ecash_profile', JSON.stringify(newProfile));
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      sessionToken, 
      loading, 
      login, 
      logout, 
      updateProfile,
      validateSession 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
