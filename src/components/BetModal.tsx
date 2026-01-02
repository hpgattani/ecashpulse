import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Info, AlertCircle, Calculator, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Outcome } from "@/hooks/usePredictions";
import { useLanguage } from "@/contexts/LanguageContext";

const ESCROW_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";

/**
 * IMPORTANT:
 * yes_pool / no_pool are OPTIONAL so the app builds
 * even if backend doesn’t send them yet.
 */
interface Prediction {
  id: string;
  question: string;
  yesOdds: number;
  noOdds: number;
  volume?: number;

  // ✅ optional – defaults to 0 if missing
  yes_pool?: number;
  no_pool?: number;

  outcomes?: Outcome[];
}

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: Prediction;
  position: "yes" | "no";
  selectedOutcome?: Outcome | null;
}

const BetModal = ({ isOpen, onClose, prediction, position, selectedOutcome }: BetModalProps) => {
  const payButtonRef = useRef<HTMLDivElement>(null);
  const { user, sessionToken } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [betAmount, setBetAmount] = useState("100");
  const [betSuccess, setBetSuccess] = useState(false);
  const [betPosition, setBetPosition] = useState<"yes" | "no">(position);

  // --------------------------------------------------
  // POSITION HANDLING
  // --------------------------------------------------
  useEffect(() => {
    if (selectedOutcome) {
      setBetPosition("yes");
    } else {
      setBetPosition(position);
    }
  }, [position, selectedOutcome]);

  // --------------------------------------------------
  // ✅ REAL, SAFE PAYOUT CALCULATION
  // --------------------------------------------------
  const betAmountNum = parseFloat(betAmount) || 0;

  const yesPoolXec = Number(prediction.yes_pool ?? 0);
  const noPoolXec = Number(prediction.no_pool ?? 0);

  const opposingPoolXec = betPosition === "yes" ? noPoolXec : yesPoolXec;

  let winMultiplier = 1;

  // Only pay from REAL opposing pool
  if (opposingPoolXec > 0) {
    const totalPoolAfterBet = yesPoolXec + noPoolXec + betAmountNum;

    winMultiplier = totalPoolAfterBet / opposingPoolXec;
  }

  const potentialPayout = (betAmountNum * winMultiplier).toFixed(2);
  const potentialProfit = (betAmountNum * winMultiplier - betAmountNum).toFixed(2);

  // --------------------------------------------------
  // CLOSE PAYBUTTON OVERLAYS
  // --------------------------------------------------
  const closePayButtonModal = useCallback(() => {
    const selectors = [
      ".paybutton-modal",
      ".paybutton-overlay",
      '[class*="paybutton"][class*="modal"]',
      '[class*="paybutton"][class*="overlay"]',
      ".ReactModal__Overlay",
      "[data-paybutton-modal]",
    ];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        (el as HTMLElement).style.display = "none";
        el.remove();
      });
    });

    if (payButtonRef.current) {
      payButtonRef.current.innerHTML = "";
    }
  }, []);

  // --------------------------------------------------
  // RECORD BET
  // --------------------------------------------------
  const recordBet = useCallback(
    async (txHash?: string) => {
      if (!user || !sessionToken) return;

      closePayButtonModal();
      setBetSuccess(true);

      const betAmountSats = Math.round(betAmountNum * 100);

      try {
        const { data, error } = await supabase.functions.invoke("process-bet", {
          body: {
            session_token: sessionToken,
            prediction_id: prediction.id,
            position: betPosition,
            amount: betAmountSats,
            tx_hash: txHash || `pb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
            outcome_id: selectedOutcome?.id || null,
          },
        });

        if (error || data?.error) {
          setBetSuccess(false);
          toast.error("Bet recording failed", {
            description: data?.error || error?.message || "Please try again",
          });
          return;
        }

        toast.success(t.betPlaced, {
          description: `${betPosition.toUpperCase()} bet of ${betAmount} XEC confirmed.`,
        });

        window.dispatchEvent(new Event("predictions:refetch"));
        window.dispatchEvent(new Event("userbets:refetch"));

        setTimeout(() => {
          setBetSuccess(false);
          onClose();
        }, 1200);
      } catch (err: any) {
        setBetSuccess(false);
        toast.error("Failed to place bet", {
          description: err.message,
        });
      }
    },
    [user, sessionToken, betAmountNum, prediction.id, betPosition, selectedOutcome, onClose, closePayButtonModal, t],
  );

  // --------------------------------------------------
  // LOAD PAYBUTTON
  // --------------------------------------------------
  useEffect(() => {
    if (!document.querySelector('script[src*="paybutton"]')) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/@paybutton/paybutton/dist/paybutton.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // --------------------------------------------------
  // RENDER PAYBUTTON
  // --------------------------------------------------
  useEffect(() => {
    if (!isOpen || !payButtonRef.current || !user || !sessionToken || betSuccess) {
      if (payButtonRef.current) payButtonRef.current.innerHTML = "";
      return;
    }

    if (betAmountNum <= 0) return;

    payButtonRef.current.innerHTML = "";

    const renderButton = () => {
      if (!(window as any).PayButton) return;

      const container = document.createElement("div");
      payButtonRef.current!.appendChild(container);

      (window as any).PayButton.render(container, {
        to: ESCROW_ADDRESS,
        amount: betAmountNum,
        currency: "XEC",
        text: "Place Bet",
        hoverText: "Confirm",
        successText: "Payment Sent!",
        autoClose: true,
        theme: {
          palette: {
            primary: "#10b981",
            secondary: "#1e293b",
            tertiary: "#ffffff",
          },
        },
        onSuccess: (tx: any) => recordBet(tx?.hash || tx?.txid || tx),
        onError: () =>
          toast.error("Payment failed", {
            description: "Please try again.",
          }),
      });
    };

    const id = setTimeout(renderButton, 100);
    return () => clearTimeout(id);
  }, [isOpen, betAmountNum, user, sessionToken, betSuccess, recordBet]);

  // --------------------------------------------------
  // UNAUTHENTICATED
  // --------------------------------------------------
  if (!user || !sessionToken) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" onClick={onClose} />
            <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="glass-card glow-primary p-6 text-center w-full max-w-md">
                <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                <h2 className="font-bold text-xl mb-2">{t.connectWallet}</h2>
                <p className="text-muted-foreground mb-6">{t.connectWalletDesc}</p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={onClose}>
                    {t.cancel}
                  </Button>
                  <Button
                    onClick={() => {
                      sessionStorage.setItem("auth_return_url", window.location.pathname + window.location.search);
                      navigate("/auth");
                    }}
                  >
                    {t.connect}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // --------------------------------------------------
  // AUTHENTICATED UI
  // --------------------------------------------------
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" onClick={onClose} />
          <motion.div className="fixed inset-x-4 top-4 bottom-4 mx-auto max-w-md z-50 flex items-center">
            <div className="glass-card glow-primary p-4 sm:p-6 w-full">
              {betSuccess ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                  <h2 className="font-bold text-xl mb-2">{t.betPlaced}</h2>
                  <p className="text-muted-foreground">{t.betConfirmed}</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between mb-4">
                    <h2 className="font-bold text-lg">{t.placeYourBet}</h2>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <Input type="number" value={betAmount} onChange={(e) => setBetAmount(e.target.value)} min="1" />

                  <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex justify-between text-sm">
                      <span>{t.totalPayout}</span>
                      <span className="font-bold text-emerald-400">{potentialPayout} XEC</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{t.profit}</span>
                      <span className="font-bold text-emerald-400">+{potentialProfit} XEC</span>
                    </div>
                  </div>

                  <div ref={payButtonRef} className="mt-4" />

                  <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 mt-4">
                    <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <p className="text-xs text-muted-foreground">{t.platformFee}</p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BetModal;
