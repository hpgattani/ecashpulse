import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Zap, AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

// Platform auth wallet
const AUTH_WALLET = "ecash:qr6pwzt7glvmq6ryr4305kat0vnv2wy69qjxpdwz5a";
const AUTH_AMOUNT = 5.46;

declare global {
  interface Window {
    PayButton?: {
      render: (element: HTMLElement, config: Record<string, unknown>) => void;
    };
  }
}

interface PayButtonTransaction {
  hash: string;
  inputAddresses?: string[];
}

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const payButtonRef = useRef<HTMLDivElement>(null);

  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  /* -------- Load PayButton script -------- */
  useEffect(() => {
    const existingScript = document.querySelector('script[src*="paybutton"]');
    if (existingScript) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://unpkg.com/@paybutton/paybutton/dist/paybutton.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.body.appendChild(script);
  }, []);

  /* -------- Render PayButton -------- */
  useEffect(() => {
    if (!scriptLoaded || !payButtonRef.current || !window.PayButton || user || isLoading) return;

    payButtonRef.current.innerHTML = "";

    const handleSuccess = async (tx: PayButtonTransaction) => {
      const senderAddress = tx.inputAddresses?.[0];
      const txHash = tx.hash;

      if (!senderAddress || !txHash) {
        setError("Could not detect wallet or transaction.");
        return;
      }

      setIsLoading(true);
      setError(null);

      // ✅ ORIGINAL behavior: call login ONCE
      const result = await login(senderAddress, txHash);

      if (result?.error) {
        setIsLoading(false);
        setError("Authentication failed. Please try again.");
        return;
      }

      // ✅ Success
      setAuthSuccess(true);
      toast({
        title: "Welcome!",
        description: "Wallet verified successfully",
      });

      setTimeout(() => navigate("/"), 1200);
    };

    window.PayButton.render(payButtonRef.current, {
      to: AUTH_WALLET,
      amount: AUTH_AMOUNT,
      currency: "XEC",
      text: "Verify Wallet",
      hoverText: `Pay ${AUTH_AMOUNT} XEC`,
      onSuccess: handleSuccess,
    });
  }, [scriptLoaded, user, isLoading, login, navigate, toast]);

  /* -------- Redirect if already logged in -------- */
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  /* -------- Success Screen -------- */
  if (authSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="font-display text-xl font-bold">Wallet Verified!</h2>
          <p className="text-muted-foreground text-sm mt-2">Redirecting to eCash Pulse…</p>
        </motion.div>
      </div>
    );
  }

  /* -------- Main UI -------- */
  return (
    <>
      <Helmet>
        <title>Login - eCash Pulse</title>
      </Helmet>

      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-2xl">
              eCash<span className="text-primary">Pulse</span>
            </span>
          </div>

          {/* Card */}
          <div className="glass-card p-6 md:p-8">
            <div className="text-center mb-6">
              <h1 className="font-display text-2xl font-bold mb-2">Verify Your Wallet</h1>
              <p className="text-muted-foreground text-sm">Send {AUTH_AMOUNT} XEC to verify wallet ownership</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground text-sm">Verifying wallet…</p>
              </div>
            ) : (
              <div className="flex justify-center min-h-[50px]">
                <div ref={payButtonRef} />
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-border/30 text-center text-xs text-muted-foreground">
              Don’t have an eCash wallet?{" "}
              <a
                href="https://cashtab.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Get Cashtab
              </a>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Button variant="ghost" onClick={() => navigate("/")}>
              Back to Home
            </Button>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default Auth;
