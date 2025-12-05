import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  ecash_address: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (ecashAddress: string) => Promise<{ error: string | null }>;
  logout: () => void;
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
  // eCash addresses start with 'ecash:' followed by cashaddr format
  const ecashRegex = /^ecash:q[a-z0-9]{41}$/;
  // Also allow legacy format starting with 'q'
  const legacyRegex = /^q[a-z0-9]{41}$/;
  return ecashRegex.test(address.toLowerCase()) || legacyRegex.test(address.toLowerCase());
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored session
    const storedUser = localStorage.getItem('ecash_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('ecash_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (ecashAddress: string): Promise<{ error: string | null }> => {
    const trimmedAddress = ecashAddress.trim().toLowerCase();
    
    if (!isValidEcashAddress(trimmedAddress)) {
      return { error: 'Invalid eCash address format. Please enter a valid address.' };
    }

    try {
      // Check if user exists or create new
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('ecash_address', trimmedAddress)
        .maybeSingle();

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        return { error: 'Failed to check user. Please try again.' };
      }

      let userData: User;

      if (existingUser) {
        // Update last login
        await supabase
          .from('users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', existingUser.id);
        userData = existingUser as User;
      } else {
        // Create new user
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({ ecash_address: trimmedAddress })
          .select()
          .single();

        if (insertError || !newUser) {
          console.error('Insert error:', insertError);
          return { error: 'Failed to create account. Please try again.' };
        }
        userData = newUser as User;
      }

      setUser(userData);
      localStorage.setItem('ecash_user', JSON.stringify(userData));
      return { error: null };
    } catch (err) {
      console.error('Login error:', err);
      return { error: 'An unexpected error occurred. Please try again.' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ecash_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
