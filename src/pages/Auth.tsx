import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Zap, AlertCircle, CheckCircle, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

import type { PayButtonTransaction } from '@/types/paybutton.d.ts';

// Platform auth wallet - receives verification payments
const AUTH_WALLET = 'ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp';
const AUTH_AMOUNT = 5.46; // XEC amount for verification

const Auth = () => {
  const [error, setError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const payButtonRef = useRef<HTMLDivElement>(null);
  const { user, login } = useAuth();
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

  // Close any PayButton QR/modal overlays
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

  // Render PayButton when script is loaded
  useEffect(() => {
    if (!payButtonRef.current) return;

    if (user || authSuccess) {
      closePayButtonModal();
      return;
    }

    if (!scriptLoaded || !window.PayButton) return;

    payButtonRef.current.innerHTML = '';

    const handleSuccess = async (transaction: PayButtonTransaction) => {
      closePayButtonModal();

      console.log('Auth payment detected:', transaction);

      const senderAddress = transaction.inputAddresses?.[0];

      if (!senderAddress) {
        setError('Could not detect sender wallet address. Please try again.');
        return;
      }

      // Client-side login — no server calls needed
      const { error: loginError } = await login(senderAddress, transaction.hash);

      if (loginError) {
        setError(loginError);
        return;
      }

      setAuthSuccess(true);
      toast.success('Payment Sent!', {
        description: `Paid ${AUTH_AMOUNT} XEC — wallet verified`,
      });

      const returnUrl = sessionStorage.getItem('auth_return_url');
      sessionStorage.removeItem('auth_return_url');
      setTimeout(() => (window.location.href = returnUrl || '/'), 1500);
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
  }, [scriptLoaded, user, authSuccess, login, closePayButtonModal]);

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
              <span>Client-side wallet verification</span>
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

            <div className="space-y-4">
              {/* PayButton container */}
              <div className="flex justify-center min-h-[50px]">
                <div ref={payButtonRef} />
              </div>

              <div className="text-center text-xs text-muted-foreground space-y-1">
                <p>This small verification fee proves wallet ownership.</p>
                <p className="text-primary/80">Session stored locally in your browser.</p>
              </div>
            </div>

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
