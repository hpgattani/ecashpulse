import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Info, AlertCircle, Calculator, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Outcome } from "@/hooks/usePredictions";
import { useLanguage } from "@/contexts/LanguageContext";
import { triggerHaptic } from "@/hooks/useHaptic";

const ESCROW_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";

interface Prediction {
  id: string;
  question: string;
  yesOdds: number;
  noOdds: number;
  volume?: number;
  escrowAddress?: string;
  outcomes?: Outcome[];
  // Pool values in satoshis for accurate payout calculation
  yesPool?: number;
  noPool?: number;
  endDate?: string;
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

  // If a specific outcome is selected, always treat it as "bet ON this outcome"
  useEffect(() => {
    if (selectedOutcome) {
      setBetPosition("yes");
    } else {
      setBetPosition(position);
    }
  }, [position, selectedOutcome]);

  // Calculate potential payout using actual pool values (parimutuel formula)
  const betAmountXec = parseFloat(betAmount) || 0;
  const betAmountSats = betAmountXec * 100; // Convert XEC to satoshis
  
  // Get pool values (in satoshis) - default to 0 if not available
  const yesPoolSats = prediction.yesPool ?? (prediction.volume ? prediction.volume * 100 * prediction.yesOdds / 100 : 0);
  const noPoolSats = prediction.noPool ?? (prediction.volume ? prediction.volume * 100 * prediction.noOdds / 100 : 0);
  
  // For multi-option, use outcome pool
  const selectedOutcomePool = selectedOutcome?.pool ?? 0;
  
  // Calculate pools based on bet position
  const yourSidePool = selectedOutcome 
    ? selectedOutcomePool 
    : (betPosition === "yes" ? yesPoolSats : noPoolSats);
  const opposingSidePool = selectedOutcome
    ? (prediction.outcomes?.reduce((sum, o) => sum + (o.id !== selectedOutcome.id ? o.pool : 0), 0) ?? 0)
    : (betPosition === "yes" ? noPoolSats : yesPoolSats);
  
  // Total pool AFTER your bet is placed
  const totalPoolAfterBet = yesPoolSats + noPoolSats + betAmountSats;
  const yourSidePoolAfterBet = yourSidePool + betAmountSats;
  
  // Parimutuel payout: you win a share of the ENTIRE pool proportional to your contribution to your side
  // Formula: (totalPool / yourSidePoolAfterBet) * yourBet = totalPool * (yourBet / yourSidePoolAfterBet)
  const winMultiplier = yourSidePoolAfterBet > 0 ? totalPoolAfterBet / yourSidePoolAfterBet : 1;
  const potentialPayoutSats = betAmountSats * winMultiplier;
  const potentialPayout = (potentialPayoutSats / 100).toFixed(2); // Convert back to XEC
  const potentialProfit = ((potentialPayoutSats - betAmountSats) / 100).toFixed(2);
  
  // Current odds display (percentage)
  const currentOdds = selectedOutcome
    ? selectedOutcome.odds
    : betPosition === "yes"
      ? prediction.yesOdds
      : prediction.noOdds;

  // Check if there are any bets at all - show warning only if pool is empty
  const totalVolume = prediction.volume || 0;
  const hasBetsPlaced = totalVolume > 0 || prediction.yesOdds !== 50 || prediction.noOdds !== 50;
  
  // Check if betting is closed (end_date has passed)
  const isBettingClosed = prediction.endDate ? new Date(prediction.endDate) < new Date() : false;

  // Close any PayButton modals/overlays
  const closePayButtonModal = useCallback(() => {
    // PayButton creates overlays with these common selectors
    const selectors = [
      '.paybutton-modal',
      '.paybutton-overlay', 
      '[class*="paybutton"][class*="modal"]',
      '[class*="paybutton"][class*="overlay"]',
      '.ReactModal__Overlay',
      '[data-paybutton-modal]',
    ];
    
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        (el as HTMLElement).style.display = 'none';
        el.remove();
      });
    });

    // Also clear the PayButton container to remove QR code
    if (payButtonRef.current) {
      payButtonRef.current.innerHTML = '';
    }
  }, []);

  // Record bet
  const recordBet = useCallback(
    async (txHash?: string) => {
      if (!user || !sessionToken) return;

      // IMMEDIATELY close PayButton modal/QR code
      closePayButtonModal();
      
      // Haptic feedback for successful bet
      triggerHaptic('success');
      
      // Show success state right away for better UX
      setBetSuccess(true);

      const betAmountXec = parseFloat(betAmount);
      const betAmountSatoshis = Math.round(betAmountXec * 100);

      try {
        const { data, error } = await supabase.functions.invoke("process-bet", {
          body: {
            session_token: sessionToken,
            prediction_id: prediction.id,
            position: betPosition,
            amount: betAmountSatoshis,
            tx_hash: txHash || `pb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
            outcome_id: selectedOutcome?.id || null,
          },
        });

        if (error || data?.error) {
          setBetSuccess(false);
          triggerHaptic('error');
          toast.error("Bet recording failed", {
            description: data?.error || error?.message || "Please try again",
          });
          return;
        }

        const outcomeLabel = selectedOutcome ? selectedOutcome.label : betPosition.toUpperCase();
        toast.success(t.betPlaced, {
          description: `${outcomeLabel} bet of ${betAmount} XEC confirmed.`,
        });

        // Force-refresh odds immediately (and again shortly after) even if realtime drops.
        window.dispatchEvent(new Event('predictions:refetch'));
        setTimeout(() => window.dispatchEvent(new Event('predictions:refetch')), 1200);

        // Refresh user bet summaries so the "rubber stamp" watermark updates right away.
        window.dispatchEvent(new Event('userbets:refetch'));
        setTimeout(() => window.dispatchEvent(new Event('userbets:refetch')), 1200);

        setTimeout(() => {
          setBetSuccess(false);
          onClose();
        }, 1200);
      } catch (err: any) {
        setBetSuccess(false);
        triggerHaptic('error');
        toast.error("Failed to place bet", { description: err.message });
      }
    },
    [user, sessionToken, betAmount, prediction.id, betPosition, selectedOutcome, onClose, closePayButtonModal, t],
  );

  // Load PayButton script
  useEffect(() => {
    if (!document.querySelector('script[src*="paybutton"]')) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/@paybutton/paybutton/dist/paybutton.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Render PayButton
  useEffect(() => {
    if (!isOpen || !payButtonRef.current || !user || !sessionToken || betSuccess) {
      if (payButtonRef.current) {
        payButtonRef.current.innerHTML = "";
      }
      return;
    }

    const amount = parseFloat(betAmount) || 0;
    if (amount <= 0) {
      payButtonRef.current.innerHTML = "";
      return;
    }

    payButtonRef.current.innerHTML = "";

    const renderButton = () => {
      if (!payButtonRef.current) return;

      payButtonRef.current.innerHTML = "";

      const buttonContainer = document.createElement("div");
      buttonContainer.id = `paybutton-${prediction.id}-${Date.now()}`;
      payButtonRef.current.appendChild(buttonContainer);

      if ((window as any).PayButton) {
        (window as any).PayButton.render(buttonContainer, {
          to: ESCROW_ADDRESS,
          amount: amount,
          currency: "XEC",
          text: "Place Bet",
          hoverText: "Confirm",
          successText: "Payment Sent!",
          autoClose: true,
          theme: {
            palette: {
              primary: "#10b981", // always green for "bet on outcome"
              secondary: "#1e293b",
              tertiary: "#ffffff",
            },
          },
          onSuccess: (txResult: any) => {
            let txHash: string | undefined;

            if (typeof txResult === "string") {
              txHash = txResult;
            } else if (txResult?.hash) {
              txHash = txResult.hash;
            } else if (txResult?.txid) {
              txHash = txResult.txid;
            } else if (txResult?.txId) {
              txHash = txResult.txId;
            }

            recordBet(txHash);
          },
          onError: (error: any) => {
            console.error("PayButton error:", error);
            toast.error("Payment failed", {
              description: "Please try again.",
            });
          },
        });
      }
    };

    const timeoutId = setTimeout(renderButton, 100);

    return () => {
      clearTimeout(timeoutId);
      if (payButtonRef.current) {
        payButtonRef.current.innerHTML = "";
      }
    };
  }, [isOpen, betAmount, user, sessionToken, prediction.id, betSuccess, recordBet]);

  // Unauthenticated state
  if (!user || !sessionToken) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="glass-card glow-primary p-6 text-center w-full max-w-md">
                <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                <h2 className="font-display font-bold text-xl text-foreground mb-2">{t.connectWallet}</h2>
                <p className="text-muted-foreground mb-6">{t.connectWalletDesc}</p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={onClose}>
                    {t.cancel}
                  </Button>
                  <Button onClick={() => {
                    // Store return URL so user comes back after login (include full path for prediction pages)
                    sessionStorage.setItem('auth_return_url', window.location.pathname + window.location.search);
                    navigate("/auth");
                  }}>{t.connect}</Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  // Authenticated state
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-4 bottom-4 mx-auto max-w-md z-50 flex items-center"
          >
            <div className="glass-card glow-primary p-4 sm:p-6 w-full max-h-full overflow-y-auto">
              {/* Betting Closed State */}
              {isBettingClosed ? (
                <div className="text-center py-8">
                  <Clock className="w-16 h-16 text-amber-400 mx-auto mb-4" />
                  <h2 className="font-display font-bold text-xl text-foreground mb-2">Betting Closed</h2>
                  <p className="text-muted-foreground mb-6">
                    This market is no longer accepting bets. Awaiting resolution.
                  </p>
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                </div>
              ) : betSuccess ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                  <h2 className="font-display font-bold text-xl text-foreground mb-2">{t.betPlaced}</h2>
                  <p className="text-muted-foreground">
                    {t.betConfirmed}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="font-display font-bold text-lg sm:text-xl text-foreground mb-1">{t.placeYourBet}</h2>
                      {selectedOutcome ? (
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {t.bettingOn} <span className="text-primary font-semibold">{selectedOutcome.label}</span>
                        </p>
                      ) : (
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {t.betting}{" "}
                          <span
                            className={
                              betPosition === "yes" ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"
                            }
                          >
                            {betPosition.toUpperCase()}
                          </span>
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Prediction Info */}
                  <div className="p-3 rounded-lg bg-muted/50 mb-4">
                    <h3 className="font-medium text-foreground mb-2 text-sm">{prediction.question}</h3>

                    {selectedOutcome ? (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{t.yourPick}:</span>
                          <span className="text-primary font-semibold">{selectedOutcome.label}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="text-muted-foreground">{t.currentOdds}:</span>
                          <span className="text-primary font-semibold">{selectedOutcome.odds}%</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{t.yourPosition}:</span>
                          <span
                            className={
                              betPosition === "yes" ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"
                            }
                          >
                            {betPosition.toUpperCase()} ({currentOdds}%)
                          </span>
                        </div>
                      </>
                    )}

                    {hasBetsPlaced ? (
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-muted-foreground">{t.winMultiplier}:</span>
                        <span className="text-primary font-semibold">{winMultiplier.toFixed(2)}x</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span className="text-xs text-amber-300">
                          {t.oddsChangeWarning}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bet Amount + Payout Preview */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1.5 block">{t.betAmount} (XEC)</label>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder={t.enterAmount}
                          value={betAmount}
                          onChange={(e) => setBetAmount(e.target.value)}
                          min="1"
                          step="1"
                          className="text-lg font-semibold h-12 pr-14"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">XEC</span>
                      </div>
                    </div>

                    {betAmount && parseFloat(betAmount) > 0 && (
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Calculator className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm font-medium text-emerald-400">
                            {hasBetsPlaced ? t.ifYouWin : t.estimatedIfYouWin}
                          </span>
                        </div>
                        {hasBetsPlaced ? (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{t.totalPayout}:</span>
                              <span className="text-emerald-400 font-bold">{potentialPayout} XEC</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{t.profit}:</span>
                              <span className="text-emerald-400 font-bold">+{potentialProfit} XEC</span>
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {t.payoutDepends}
                          </div>
                        )}
                      </div>
                    )}

                    {/* PayButton Container */}
                    <div ref={payButtonRef} className="min-h-[50px] flex justify-center" />

                    {/* Info */}
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
                      <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        {t.platformFee}
                      </p>
                    </div>
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
