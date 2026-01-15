import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Zap, AlertCircle, Loader2, CheckCircle, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ChronikClient } from 'chronik-client';

// Platform auth wallet - receives verification payments
const AUTH_WALLET = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';
const AUTH_AMOUNT = 5.46; // XEC amount for verification

declare global {
  interface Window {
    PayButton?: {
      render: (element: HTMLElement, config: Record<string, unknown>) => void;
    };
  }
}

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
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
  const payButtonRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load PayButton script
  useEffect(() => {
    const existingScript = document.querySelector('script[src*="paybutton"]');
    if (existingScript) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@paybutton/paybutton/dist/paybutton.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.body.appendChild(script);
  }, []);

  // Close any PayButton QR/modal overlays for faster UX
  const closePayButtonModal = useCallback(() => {
    const selectors = [
      '.paybutton-modal',
      '.paybutton-overlay',
      '[class*="paybutton"][class*="modal"]',
      '[class*="paybutton"][class*="overlay"]',
      '.ReactModal__Overlay',
      '[data-paybutton-modal]',
    ];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        (el as HTMLElement).style.display = 'none';
        el.remove();
      });
    });

    if (payButtonRef.current) {
      payButtonRef.current.innerHTML = '';
    }
  }, []);

  // Verify transaction on-chain using Chronik and create session
  const verifyAndLogin = useCallback(async (txHash: string, senderAddress: string) => {
    setIsLoading(true);
    setPendingTxHash(txHash);
    setError(null);

    try {
      // Verify transaction exists on-chain using Chronik
      const chronik = new ChronikClient(['https://chronik.fabien.cash', 'https://chronik.e.cash']);
      
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        try {
          const tx = await chronik.tx(txHash);
          
          if (tx) {
            console.log('Transaction verified on-chain:', txHash);
            
            // Transaction verified - create session via edge function
            const { data, error: sessionError } = await supabase.functions.invoke('create-session', {
              body: { 
                ecash_address: senderAddress,
                tx_hash: txHash 
              }
            });

            if (sessionError || !data?.success) {
              throw new Error(data?.error || 'Failed to create session');
            }

            // Store session locally
            localStorage.setItem('ecash_user', JSON.stringify(data.user));
            localStorage.setItem('ecash_session_token', data.session_token);
            if (data.profile) {
              localStorage.setItem('ecash_profile', JSON.stringify(data.profile));
            }

            setAuthSuccess(true);
            toast.success('Payment Sent!', {
              description: `Paid ${AUTH_AMOUNT} XEC — wallet verified`,
            });
            
            // Check for return URL (e.g., user was trying to bet before login)
            const returnUrl = sessionStorage.getItem('auth_return_url');
            sessionStorage.removeItem('auth_return_url');
            
            // Redirect back to where they came from, or home
            setTimeout(() => (window.location.href = returnUrl || '/'), 1500);
            return;
          }
        } catch (txError) {
          // Transaction not found yet, keep trying
          console.log(`Attempt ${attempts + 1}: Waiting for transaction...`);
        }

        attempts++;
        await new Promise((r) => setTimeout(r, 2000));
      }

      throw new Error('Transaction verification timeout. Please try again.');
    } catch (err) {
      console.error('Verification error:', err);
      setError(err instanceof Error ? err.message : 'Verification failed');
      setIsLoading(false);
    }
  }, [toast]);

  // Render PayButton when script is loaded
  useEffect(() => {
    if (!payButtonRef.current) return;

    // If user is already logged in, loading, or auth succeeded, ensure QR/modal is closed
    if (user || isLoading || authSuccess) {
      closePayButtonModal();
      return;
    }

    if (!scriptLoaded || !window.PayButton) return;

    payButtonRef.current.innerHTML = '';

    const handleSuccess = async (transaction: PayButtonTransaction) => {
      // Immediately close the PayButton QR/modal for snappy UX
      closePayButtonModal();

      console.log('Auth payment detected:', transaction);
      
      const senderAddress = transaction.inputAddresses?.[0];
      const txHash = transaction.hash;
      
      if (!senderAddress) {
        setError('Could not detect sender wallet address. Please try again.');
        return;
      }

      verifyAndLogin(txHash, senderAddress);
    };

    window.PayButton.render(payButtonRef.current, {
      to: AUTH_WALLET,
      amount: AUTH_AMOUNT,
      currency: 'XEC',
      text: 'Verify Wallet',
      hoverText: `Pay ${AUTH_AMOUNT} XEC`,
      autoClose: true,
      hideToasts: true,
      onSuccess: handleSuccess,
      theme: {
        palette: {
          primary: '#0AC18E',
          secondary: '#1a1a2e',
          tertiary: '#ffffff'
        }
      }
    });

    return () => {
      closePayButtonModal();
    };
  }, [scriptLoaded, user, isLoading, authSuccess, verifyAndLogin, closePayButtonModal]);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  if (authSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
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

      <div className="min-h-screen flex items-center justify-center p-4">
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

            {/* Security Badge */}
            <div className="flex items-center justify-center gap-2 mb-4 text-xs text-primary">
              <Wallet className="w-4 h-4" />
              <span>Verified on-chain via Chronik</span>
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
                <p className="text-muted-foreground text-sm">
                  Verifying transaction on-chain...
                </p>
                {pendingTxHash && (
                  <p className="text-xs text-muted-foreground/60 mt-2 font-mono">
                    TX: {pendingTxHash.slice(0, 12)}...
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* PayButton container */}
                <div className="flex justify-center min-h-[50px]">
                  <div ref={payButtonRef} />
                </div>

                <div className="text-center text-xs text-muted-foreground space-y-1">
                  <p>This small verification fee proves wallet ownership.</p>
                  <p className="text-primary/80">Transaction verified directly on eCash blockchain.</p>
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
