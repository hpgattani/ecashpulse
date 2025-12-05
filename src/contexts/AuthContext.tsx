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
  loading: boolean;
  login: (ecashAddress: string, signature?: string) => Promise<{ error: string | null }>;
  logout: () => void;
  updateProfile: (newProfile: Profile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Message to sign for authentication (like eCashChat)
export const AUTH_MESSAGE = "Sign this message to verify your eCash address for eCashPulse";

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Simple eCash address validation
const isValidEcashAddress = (address: string): boolean => {
  // eCash addresses start with 'ecash:' followed by cashaddr format
  const ecashRegex = /^ecash:q[a-z0-9]{41}$/;
  // Also allow legacy format starting with 'q'
  const legacyRegex = /^q[a-z0-9]{41}$/;
  return ecashRegex.test(address.toLowerCase()) || legacyRegex.test(address.toLowerCase());
};

// Basic signature validation (format check)
const isValidSignatureFormat = (signature: string): boolean => {
  if (!signature || signature.length < 80) return false;
  // Signatures are typically base64 encoded
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return base64Regex.test(signature.trim());
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored session
    const storedUser = localStorage.getItem('ecash_user');
    const storedProfile = localStorage.getItem('ecash_profile');
    console.log('AuthContext: Loading from localStorage', { storedUser, storedProfile });
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        if (storedProfile) {
          const parsedProfile = JSON.parse(storedProfile);
          console.log('AuthContext: Loaded profile', parsedProfile);
          setProfile(parsedProfile);
        }
      } catch (e) {
        console.error('AuthContext: Error parsing stored data', e);
        localStorage.removeItem('ecash_user');
        localStorage.removeItem('ecash_profile');
      }
    }
    setLoading(false);
  }, []);

  const login = async (ecashAddress: string, signature?: string): Promise<{ error: string | null }> => {
    const trimmedAddress = ecashAddress.trim().toLowerCase();
    
    if (!isValidEcashAddress(trimmedAddress)) {
      return { error: 'Invalid eCash address format. Please enter a valid address starting with "ecash:"' };
    }

    // If signature provided, validate its format
    if (signature && !isValidSignatureFormat(signature)) {
      return { error: 'Invalid signature format. Please sign the message with your eCash wallet.' };
    }

    try {
      // Use edge function for registration/login (RLS blocks direct access)
      const { data, error } = await supabase.functions.invoke('register-user', {
        body: { ecash_address: trimmedAddress }
      });

      if (error) {
        console.error('Registration error:', error);
        return { error: 'Failed to authenticate. Please try again.' };
      }

      if (!data?.success || !data?.user) {
        return { error: data?.error || 'Failed to authenticate. Please try again.' };
      }

      const userData = data.user as User;
      const profileData = data.profile as Profile | null;
      
      setUser(userData);
      setProfile(profileData);
      localStorage.setItem('ecash_user', JSON.stringify(userData));
      if (profileData) {
        localStorage.setItem('ecash_profile', JSON.stringify(profileData));
      }
      return { error: null };
    } catch (err) {
      console.error('Login error:', err);
      return { error: 'An unexpected error occurred. Please try again.' };
    }
  };

  const logout = () => {
    setUser(null);
    setProfile(null);
    localStorage.removeItem('ecash_user');
    localStorage.removeItem('ecash_profile');
  };

  const updateProfile = (newProfile: Profile) => {
    setProfile(newProfile);
    localStorage.setItem('ecash_profile', JSON.stringify(newProfile));
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};