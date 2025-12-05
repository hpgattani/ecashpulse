import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Zap, Wallet, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await login(address);
    
    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      toast({
        title: 'Welcome!',
        description: 'You have successfully logged in.',
      });
      navigate('/');
    }
  };

  return (
    <>
      <Helmet>
        <title>Login - eCash Pulse</title>
        <meta name="description" content="Login with your eCash address to access eCash Pulse prediction market." />
      </Helmet>

      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-2xl">
              eCash<span className="text-primary">Pulse</span>
            </span>
          </div>

          {/* Login Card */}
          <div className="glass-card p-6 md:p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">
                Connect with eCash
              </h1>
              <p className="text-muted-foreground text-sm">
                Enter your eCash address to login or create an account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-foreground mb-2">
                  eCash Address
                </label>
                <Input
                  id="address"
                  type="text"
                  placeholder="ecash:qz2708636snqhsxu8wnlka78h6fdp77ar59jrf5035"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full font-mono text-sm"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !address.trim()}
              >
                {isLoading ? (
                  'Connecting...'
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border/30">
              <p className="text-xs text-muted-foreground text-center">
                Don't have an eCash wallet?{' '}
                <a
                  href="https://e.cash/wallets"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Get one here
                </a>
              </p>
            </div>
          </div>

          {/* Back to Home */}
          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="text-muted-foreground"
            >
              Back to Home
            </Button>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default Auth;
