import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Zap, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PayButton } from '@paybutton/react';

// Platform auth wallet - receives verification payments
const AUTH_WALLET = 'ecash:qr6pwzt7glvmq6ryr4305kat0vnv2wy69qjxpdwz5a';
const AUTH_AMOUNT = 5.46; // XEC amount for verification

interface PayButtonTransaction {
  hash: string;
  amount: string;
  paymentId: string;
  confirmed?: boolean;
  message: string;
  timestamp: number;
  address: string;
  rawMessage?: string;
  inputAddresses?: string[];
}

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handlePaymentSuccess = async (transaction: PayButtonTransaction) => {
    console.log('Payment successful:', transaction);
    
    // Get the sender's address from inputAddresses
    const senderAddress = transaction.inputAddresses?.[0];
    
    if (!senderAddress) {
      setError('Could not detect sender wallet address. Please try again.');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    // Use the sender's address to authenticate
    const result = await login(senderAddress, transaction.hash);
    
    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      setAuthSuccess(true);
      toast({
        title: 'Welcome!',
        description: 'Wallet verified and connected to eCash Pulse',
      });
      setTimeout(() => navigate('/'), 1500);
    }
  };

  if (authSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">
            Wallet Verified!
          </h2>
          <p className="text-muted-foreground text-sm mt-2">
            Redirecting to eCash Pulse...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Login - eCash Pulse</title>
        <meta name="description" content="Login to eCash Pulse prediction market" />
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
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">
                Verify Your Wallet
              </h1>
              <p className="text-muted-foreground text-sm">
                Send {AUTH_AMOUNT} XEC to verify wallet ownership and connect
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground text-sm">Verifying wallet...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* PayButton for authentication */}
                <div className="flex justify-center">
                  <PayButton
                    to={AUTH_WALLET}
                    amount={AUTH_AMOUNT}
                    currency="XEC"
                    text="Verify Wallet"
                    hoverText={`Pay ${AUTH_AMOUNT} XEC`}
                    onSuccess={handlePaymentSuccess}
                    theme={{
                      palette: {
                        primary: '#0AC18E',
                        secondary: '#1a1a2e',
                        tertiary: '#ffffff',
                        logo: '#0AC18E'
                      }
                    }}
                  />
                </div>

                <div className="text-center text-xs text-muted-foreground space-y-1">
                  <p>This small verification fee proves wallet ownership.</p>
                  <p className="text-primary/80">Your address is detected automatically from the transaction.</p>
                </div>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-border/30">
              <p className="text-xs text-muted-foreground text-center">
                Don't have an eCash wallet?{' '}
                <a
                  href="https://cashtab.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Get Cashtab
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
