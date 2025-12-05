import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Zap, Wallet, ArrowRight, AlertCircle, Shield, HelpCircle, Copy, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth, AUTH_MESSAGE } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const [address, setAddress] = useState('');
  const [signature, setSignature] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignatureHelp, setShowSignatureHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const copyMessage = async () => {
    await navigator.clipboard.writeText(AUTH_MESSAGE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await login(address, signature || undefined);
    
    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      toast({
        title: 'Welcome!',
        description: signature ? 'Wallet verified and connected!' : 'Connected (unverified)',
      });
      navigate('/');
    }
  };

  // Try to connect with Cashtab extension
  const connectWithCashtab = async () => {
    try {
      // Check if Cashtab extension is available
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
      
      // Request address from Cashtab
      const addressResponse = await cashtab.request({ method: 'getAddress' });
      if (addressResponse?.address) {
        setAddress(addressResponse.address);
        
        // Request signature
        try {
          const signResponse = await cashtab.request({
            method: 'signMessage',
            params: { message: AUTH_MESSAGE }
          });
          
          if (signResponse?.signature) {
            setSignature(signResponse.signature);
            
            // Auto-login with verified signature
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
        } catch (signError) {
          // User declined signing, still set the address
          toast({
            title: 'Address Retrieved',
            description: 'You can still login without signature verification',
          });
        }
      }
    } catch (error: any) {
      console.error('Cashtab error:', error);
      setError(error.message || 'Failed to connect with Cashtab');
    } finally {
      setIsLoading(false);
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
                Sign in with your eCash address (like eCashChat)
              </p>
            </div>

            {/* Cashtab Button */}
            <Button
              type="button"
              onClick={connectWithCashtab}
              disabled={isLoading}
              className="w-full mb-4 bg-[#0074C2] hover:bg-[#005a99] text-white"
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
                <span className="bg-card px-2 text-muted-foreground">or sign in manually</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="signature" className="text-sm font-medium text-foreground flex items-center gap-1">
                    Signature
                    <button
                      type="button"
                      onClick={() => setShowSignatureHelp(!showSignatureHelp)}
                      className="text-muted-foreground hover:text-primary"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </label>
                  <span className="text-xs text-muted-foreground">(Optional)</span>
                </div>

                {showSignatureHelp && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-3 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-2"
                  >
                    <p className="font-medium text-foreground">How to verify (like eCashChat):</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Open Cashtab or Electrum ABC wallet</li>
                      <li>Go to "Sign Message" feature</li>
                      <li>Copy this message:</li>
                    </ol>
                    <div className="flex items-center gap-2 p-2 bg-background rounded">
                      <code className="flex-1 text-[10px] break-all">{AUTH_MESSAGE}</code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={copyMessage}
                        className="h-6 w-6 flex-shrink-0"
                      >
                        {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                    <ol className="list-decimal list-inside space-y-1" start={4}>
                      <li>Sign with your address</li>
                      <li>Paste the signature below</li>
                    </ol>
                    <a 
                      href="https://www.ecashchat.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline mt-2"
                    >
                      See how eCashChat does it <ExternalLink className="w-3 h-3" />
                    </a>
                  </motion.div>
                )}

                <Textarea
                  id="signature"
                  placeholder="Paste your signature here..."
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  className="font-mono text-xs min-h-[60px]"
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

              {/* Security Warning */}
              {!signature && address && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200/80">
                      <p className="font-medium text-amber-400 mb-1">Unverified Login</p>
                      <p>Without a signature, we can't verify wallet ownership. Sign the message for secure login.</p>
                    </div>
                  </div>
                </div>
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
                    {signature ? <Shield className="w-4 h-4 mr-2" /> : null}
                    {signature ? 'Verify & Connect' : 'Connect'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

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