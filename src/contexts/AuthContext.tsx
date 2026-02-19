import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

// Generate a deterministic-ish user ID from address (consistent across sessions)
const addressToUserId = (address: string): string => {
  // Simple hash-like approach: use the address itself as a stable ID seed
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    const char = address.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  // Create a UUID-like string from the address for consistency
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-a${hex.slice(1, 4)}-${address.slice(-12)}`;
};

// Generate a random session token
const generateSessionToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
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

  // Client-side session validation — just check localStorage
  const validateSession = async (): Promise<boolean> => {
    const storedToken = localStorage.getItem('ecash_session_token');
    const storedUser = readLocalJson<User>('ecash_user');

    if (!storedToken || !storedUser) {
      setUser(null);
      setProfile(null);
      setSessionToken(null);
      return false;
    }

    // Session is valid if it exists locally
    setUser(storedUser);
    setProfile(readLocalJson<Profile>('ecash_profile'));
    setSessionToken(storedToken);
    return true;
  };

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      await validateSession();
      setLoading(false);
    };
    initAuth();
  }, []);

  // Client-side login — create session directly from address
  const login = async (ecashAddress: string, txHash?: string): Promise<{ error: string | null }> => {
    const trimmedAddress = ecashAddress.trim().toLowerCase();
    
    if (!isValidEcashAddress(trimmedAddress)) {
      return { error: 'Invalid eCash address format' };
    }

    const userId = addressToUserId(trimmedAddress);
    const now = new Date().toISOString();
    const token = generateSessionToken();

    const newUser: User = {
      id: userId,
      ecash_address: trimmedAddress,
      created_at: now,
      last_login_at: now,
    };

    setUser(newUser);
    setSessionToken(token);

    localStorage.setItem('ecash_user', JSON.stringify(newUser));
    localStorage.setItem('ecash_session_token', token);

    return { error: null };
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
