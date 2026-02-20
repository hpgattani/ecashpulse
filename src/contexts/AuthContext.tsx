import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const readLocalJson = <T,>(key: string): T | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  };

  const [user, setUser] = useState<User | null>(() => readLocalJson<User>('ecash_user'));
  const [profile, setProfile] = useState<Profile | null>(() => readLocalJson<Profile>('ecash_profile'));
  const [sessionToken, setSessionToken] = useState<string | null>(() => localStorage.getItem('ecash_session_token'));
  const [loading, setLoading] = useState(true);

  // Server-side session validation
  const validateSession = async (): Promise<boolean> => {
    const storedToken = localStorage.getItem('ecash_session_token');
    if (!storedToken) {
      setUser(null);
      setProfile(null);
      setSessionToken(null);
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('validate-session', {
        body: { session_token: storedToken },
      });

      if (error || !data?.valid) {
        console.log('Session invalid, clearing local state');
        setUser(null);
        setProfile(null);
        setSessionToken(null);
        localStorage.removeItem('ecash_user');
        localStorage.removeItem('ecash_profile');
        localStorage.removeItem('ecash_session_token');
        return false;
      }

      setUser(data.user);
      setProfile(data.profile);
      setSessionToken(data.session_token || storedToken);

      localStorage.setItem('ecash_user', JSON.stringify(data.user));
      if (data.profile) {
        localStorage.setItem('ecash_profile', JSON.stringify(data.profile));
      }

      return true;
    } catch (err) {
      console.error('Session validation error:', err);
      // Keep local state on network failure (offline resilience)
      const storedUser = readLocalJson<User>('ecash_user');
      if (storedUser) {
        setUser(storedUser);
        setProfile(readLocalJson<Profile>('ecash_profile'));
        setSessionToken(storedToken);
        return true;
      }
      return false;
    }
  };

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      await validateSession();
      setLoading(false);
    };
    initAuth();
  }, []);

  // Server-side login — calls create-session edge function
  const login = async (ecashAddress: string, txHash?: string): Promise<{ error: string | null }> => {
    const trimmedAddress = ecashAddress.trim().toLowerCase();

    try {
      const { data, error } = await supabase.functions.invoke('create-session', {
        body: { ecash_address: trimmedAddress, tx_hash: txHash },
      });

      if (error) {
        console.error('Create session error:', error);
        return { error: error.message || 'Failed to create session' };
      }

      if (!data?.success) {
        return { error: data?.error || 'Login failed' };
      }

      setUser(data.user);
      setProfile(data.profile);
      setSessionToken(data.session_token);

      localStorage.setItem('ecash_user', JSON.stringify(data.user));
      localStorage.setItem('ecash_session_token', data.session_token);
      if (data.profile) {
        localStorage.setItem('ecash_profile', JSON.stringify(data.profile));
      }

      return { error: null };
    } catch (err: any) {
      console.error('Login error:', err);
      return { error: err.message || 'Network error during login' };
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
