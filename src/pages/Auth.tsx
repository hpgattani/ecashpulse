import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Zap, Wallet, ArrowRight, AlertCircle, Shield, Copy, CheckCircle2, Coins, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, AUTH_MESSAGE } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const LOGIN_FEE_XEC = 5.46;
const ESCROW_ADDRESS = 'ecash:qr6pwzt7glvmq6ryr4305kat0vnv2wy69qjxpdwz5a';

const Auth = () => {
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const payButtonRef = useRef<HTMLDivElement>(null);
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Load PayButton script
  useEffect(() => {
    if (!document.querySelector('script[src*="paybutton"]')) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@paybutton/paybutton/dist/paybutton.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Render PayButton when showing payment
  useEffect(() => {
    if (!showPayment || !payButtonRef.current || !address) return;

    payButtonRef.current.innerHTML = '';
    
    const renderButton = () => {
      if (!payButtonRef.current) return;
      
      const buttonContainer = document.createElement('div');
      buttonContainer.id = 'login-paybutton';
      payButtonRef.current.appendChild(buttonContainer);

      if ((window as any).PayButton) {
        (window as any).PayButton.render(buttonContainer, {
          to: ESCROW_ADDRESS,
          amount: LOGIN_FEE_XEC,
          currency: 'XEC',
          text: `Pay ${LOGIN_FEE_XEC} XEC`,
          hoverText: 'Login Now',
          successText: 'Welcome!',
          opReturn: `LOGIN:${address}`,
          theme: {
            palette: {
              primary: '#00d4aa',
              secondary: '#1e293b',
              tertiary: '#ffffff'
            }
          },
          onSuccess: async (txid: string) => {
            setPaymentPending(true);
            const result = await login(address);
            if (result.error) {
              setError(result.error);
              setPaymentPending(false);
            } else {
              toast({
                title: 'Welcome!',
                description: 'Payment verified - you\'re now logged in!',
              });
              navigate('/');
            }
          }
        });
      }
    };

    setTimeout(renderButton, 100);
  }, [showPayment, address, login, toast, navigate]);

  const copyAddress = async () => {
    await navigator.clipboard.writeText(address || AUTH_MESSAGE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    
    setError(null);
    setShowPayment(true);
  };

  // Quick login without payment (for testing/demo)
  const handleQuickLogin = async () => {
    if (!address.trim()) {
      setError('Please enter your eCash address first');
      return;
    }
    setIsLoading(true);
    setError(null);
    
    const result = await login(address);
    if (result.error) {
      setError(result.error);
    } else {
      toast({
        title: 'Welcome!',
        description: 'Connected to eCash Pulse',
      });
      navigate('/');
    }
    setIsLoading(false);
  };

  // Google Sign In
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });
      
      if (error) {
        setError(error.message);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Cashtab connection
  const connectWithCashtab = async () => {
    try {
      const cashtab = (window as any).cashtab;
      if (!cashtab) {
        toast({
          title: 'Cashtab Not Found',
          description: 'Please install the Cashtab browser extension',
          variant: 'destructive',
        });
        window.open('https://chromewebstore.google.com/detail/cashtab/obldfcmebhllhjlhjbnghaipekcppeag', '_blank');
        return;
      }

      setIsLoading(true);
      setError(null);
      
      const addressResponse = await cashtab.request({ method: 'getAddress' });
      if (addressResponse?.address) {
        setAddress(addressResponse.address);
        
        // Try signing
        try {
          const signResponse = await cashtab.request({
            method: 'signMessage',
            params: { message: AUTH_MESSAGE }
          });
          
          if (signResponse?.signature) {
            const result = await login(addressResponse.address, signResponse.signature);
            if (result.error) {
              setError(result.error);
            } else {
              toast({
                title: 'Welcome!',
                description: 'Wallet verified and connected!',
              });
              navigate('/');
            }
          }
        } catch {
          // User declined signing, show payment option
          setShowPayment(true);
        }
      }
    } catch (error: any) {
      setError(error.message || 'Failed to connect with Cashtab');
    } finally {
      setIsLoading(false);
    }
  };

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
                Welcome Back
              </h1>
              <p className="text-muted-foreground text-sm">
                Choose your preferred login method
              </p>
            </div>

            {/* Google Sign In */}
            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              variant="outline"
              className="w-full mb-3 h-11"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continue with Google
            </Button>

            {/* Cashtab Button */}
            <Button
              type="button"
              onClick={connectWithCashtab}
              disabled={isLoading}
              className="w-full mb-4 bg-[#0074C2] hover:bg-[#005a99] text-white h-11"
            >
              <img 
                src="https://cashtab.com/cashtab_xec.png" 
                alt="Cashtab" 
                className="w-5 h-5 mr-2"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              Sign in with Cashtab
            </Button>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">or pay with XEC</span>
              </div>
            </div>

            {!showPayment ? (
              <form onSubmit={handleAddressSubmit} className="space-y-4">
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-foreground mb-2">
                    eCash Address
                  </label>
                  <Input
                    id="address"
                    type="text"
                    placeholder="ecash:qr..."
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
                  className="w-full h-11"
                  disabled={isLoading || !address.trim()}
                >
                  <Coins className="w-4 h-4 mr-2" />
                  Pay {LOGIN_FEE_XEC} XEC to Login
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs text-muted-foreground"
                  onClick={handleQuickLogin}
                  disabled={isLoading || !address.trim()}
                >
                  {isLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Shield className="w-3 h-3 mr-1" />}
                  Free login (demo mode)
                </Button>
              </form>
            ) : (
              /* Payment Step */
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet className="w-5 h-5 text-primary" />
                    <span className="font-medium text-foreground">Login Fee</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Pay <span className="text-primary font-bold">{LOGIN_FEE_XEC} XEC</span> to verify your address and login.
                  </p>
                  
                  <div className="flex items-center gap-2 p-2 bg-background/50 rounded text-xs font-mono mb-4">
                    <span className="truncate flex-1">{address}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={copyAddress}
                      className="h-6 w-6 flex-shrink-0"
                    >
                      {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>

                  {/* PayButton Container */}
                  <div 
                    ref={payButtonRef}
                    className="flex justify-center [&_.paybutton]:min-w-[180px]"
                  />

                  {paymentPending && (
                    <div className="flex items-center justify-center gap-2 mt-3 text-primary text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing login...</span>
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowPayment(false)}
                >
                  ← Change Address
                </Button>
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
