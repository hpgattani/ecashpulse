import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, Zap, CheckCircle, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import { toast } from "sonner";
import { triggerHaptic } from "@/hooks/useHaptic";
import SnakeGame from "./SnakeGame";
import TetrisGame from "./TetrisGame";
import LumberjackGame from "./LumberjackGame";
import SpaceShooterGame from "./SpaceShooterGame";

interface MiniGame {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
}

interface GamePlayModalProps {
  game: MiniGame;
  mode: "competitive" | "demo";
  isOpen: boolean;
  onClose: () => void;
}

const ESCROW_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";
const DEMO_MIN_XEC = 5.46;

const GamePlayModal = ({ game, mode, isOpen, onClose }: GamePlayModalProps) => {
  const { user } = useAuth();
  const { prices } = useCryptoPrices();
  const [step, setStep] = useState<"payment" | "playing" | "finished">("payment");
  const [finalScore, setFinalScore] = useState(0);
  const [isGameActive, setIsGameActive] = useState(false);
  const payButtonRef = useRef<HTMLDivElement>(null);
  
  // Lock entry fee at modal open to prevent PayButton re-renders
  const [lockedEntryFee, setLockedEntryFee] = useState(0);

  // Calculate entry fee once when modal opens
  useEffect(() => {
    if (isOpen) {
      const fee = mode === "demo" 
        ? DEMO_MIN_XEC 
        : Math.ceil(1 / (prices?.ecash || 0.00003));
      setLockedEntryFee(fee);
      setStep("payment");
      setFinalScore(0);
      setIsGameActive(false);
    }
  }, [isOpen, mode, prices?.ecash]);

  // Close any PayButton modals/overlays
  const closePayButtonModal = useCallback(() => {
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

    if (payButtonRef.current) {
      payButtonRef.current.innerHTML = '';
    }
  }, []);

  // Handle payment success
  const handlePaymentSuccess = useCallback(async (txHash?: string) => {
    closePayButtonModal();
    triggerHaptic('success');
    
    toast.custom(
      () => (
        <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-500/90 to-teal-500/90 text-white shadow-xl backdrop-blur-sm border border-white/20">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="font-semibold">Payment Sent!</p>
            <p className="text-sm text-white/80">{lockedEntryFee.toLocaleString()} XEC</p>
          </div>
        </div>
      ),
      { duration: 4000, position: "bottom-center" }
    );

    console.log("Game payment received:", txHash);
    setStep("playing");
    // Delay game activation slightly to allow step transition
    setTimeout(() => setIsGameActive(true), 100);
  }, [closePayButtonModal, lockedEntryFee]);

  // Load PayButton script
  useEffect(() => {
    if (!document.querySelector('script[src*="paybutton"]')) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/@paybutton/paybutton/dist/paybutton.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Render PayButton - using stable lockedEntryFee
  useEffect(() => {
    if (!isOpen || !payButtonRef.current || step !== "payment" || lockedEntryFee <= 0) {
      if (payButtonRef.current) {
        payButtonRef.current.innerHTML = "";
      }
      return;
    }

    payButtonRef.current.innerHTML = "";

    const renderButton = () => {
      if (!payButtonRef.current) return;

      payButtonRef.current.innerHTML = "";

      const buttonContainer = document.createElement("div");
      buttonContainer.id = `paybutton-game-${game.id}-${Date.now()}`;
      payButtonRef.current.appendChild(buttonContainer);

      if ((window as any).PayButton) {
        (window as any).PayButton.render(buttonContainer, {
          to: ESCROW_ADDRESS,
          amount: lockedEntryFee,
          currency: "XEC",
          text: `Pay ${lockedEntryFee.toLocaleString()} XEC`,
          hoverText: "Confirm",
          successText: "Payment Sent!",
          autoClose: true,
          hideToasts: true,
          theme: {
            palette: {
              primary: mode === "competitive" ? "#f59e0b" : "#3b82f6",
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

            handlePaymentSuccess(txHash);
          },
          onError: (error: any) => {
            console.error("PayButton error:", error);
            triggerHaptic('error');
            toast.error("Payment failed", {
              description: "Please try again.",
            });
          },
        });
      }
    };

    const timeoutId = setTimeout(renderButton, 150);

    return () => {
      clearTimeout(timeoutId);
      if (payButtonRef.current) {
        payButtonRef.current.innerHTML = "";
      }
    };
  }, [isOpen, step, lockedEntryFee, game.id, mode, handlePaymentSuccess]);

  const handleGameEnd = async (score: number) => {
    setFinalScore(score);
    setStep("finished");
    setIsGameActive(false);
    triggerHaptic('medium');

    if (mode === "competitive" && user) {
      try {
        const response = await fetch("/api/submit-game-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId: game.id,
            score,
            isCompetitive: true,
          }),
        });
        
        if (response.ok) {
          toast.success(`Score submitted: ${score.toLocaleString()} points!`);
        }
      } catch (error) {
        console.error("Failed to submit score:", error);
      }
    }
  };

  const renderGame = () => {
    const gameProps = {
      onGameEnd: handleGameEnd,
      isPlaying: isGameActive,
    };

    switch (game.slug) {
      case "snake":
        return <SnakeGame {...gameProps} />;
      case "tetris":
        return <TetrisGame {...gameProps} />;
      case "lumberjack":
        return <LumberjackGame {...gameProps} />;
      case "space-shooter":
        return <SpaceShooterGame {...gameProps} />;
      default:
        return <div className="text-muted-foreground text-center p-8">Game not found</div>;
    }
  };

  const handlePlayAgain = () => {
    // First deactivate game to trigger reset in game component
    setIsGameActive(false);
    setFinalScore(0);
    
    if (mode === "demo") {
      // In demo mode, allow instant replay without repaying
      setStep("playing");
      // Small delay to ensure game component sees the isPlaying=false then true transition
      setTimeout(() => setIsGameActive(true), 150);
    } else {
      // Competitive mode requires new payment
      const fee = Math.ceil(1 / (prices?.ecash || 0.00003));
      setLockedEntryFee(fee);
      setStep("payment");
    }
  };

  const handleClose = () => {
    setIsGameActive(false);
    closePayButtonModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop - prevent closing during game */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={step === "playing" ? undefined : handleClose}
            className="absolute inset-0 bg-background/90 backdrop-blur-md"
          />

          {/* Modal - fullscreen on mobile, centered on desktop */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="absolute inset-2 sm:inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full md:max-h-[90vh]"
          >
            <div className="glass-card glow-primary p-3 sm:p-4 h-full md:h-auto flex flex-col overflow-hidden rounded-2xl">
              {/* Header */}
              <div className="flex items-start justify-between mb-3 flex-shrink-0">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-2xl sm:text-3xl">{game.icon}</span>
                  <div>
                    <h2 className="font-display font-bold text-base sm:text-lg text-foreground">{game.name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      mode === "competitive" 
                        ? "bg-amber-500/20 text-amber-400" 
                        : "bg-blue-500/20 text-blue-400"
                    }`}>
                      {mode === "competitive" ? "Competitive" : "Demo"}
                    </span>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleClose} 
                  className="h-8 w-8"
                  disabled={step === "playing"}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {step === "payment" && (
                  <div className="text-center space-y-4 sm:space-y-6 py-4">
                    <div className="p-4 sm:p-6 rounded-xl bg-muted/20 border border-border/30">
                      {mode === "competitive" ? (
                        <>
                          <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400 mx-auto mb-3" />
                          <h3 className="text-base sm:text-lg font-bold mb-2">Competitive Entry</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                            Your score will be added to the weekly leaderboard. Top 3 win prizes!
                          </p>
                        </>
                      ) : (
                        <>
                          <Zap className="w-10 h-10 sm:w-12 sm:h-12 text-blue-400 mx-auto mb-3" />
                          <h3 className="text-base sm:text-lg font-bold mb-2">Demo Mode</h3>
                          <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                            Practice without affecting the leaderboard.
                          </p>
                        </>
                      )}

                      <div className="text-2xl sm:text-3xl font-bold text-primary mb-2">
                        {lockedEntryFee.toLocaleString()} XEC
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {mode === "competitive" ? "≈ $1 USD" : "Minimum demo fee"}
                      </p>
                    </div>

                    {/* PayButton container */}
                    <div className="flex justify-center min-h-[50px]">
                      <div ref={payButtonRef} className="min-h-[50px]" />
                    </div>
                  </div>
                )}

                {step === "playing" && (
                  <div 
                    className="w-full h-full min-h-[400px] sm:min-h-[450px] rounded-lg overflow-hidden bg-black/50"
                    style={{ touchAction: 'none' }}
                  >
                    {renderGame()}
                  </div>
                )}

                {step === "finished" && (
                  <div className="text-center space-y-4 sm:space-y-6 py-4">
                    <div className="p-6 sm:p-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30">
                      <Gamepad2 className="w-12 h-12 sm:w-16 sm:h-16 text-primary mx-auto mb-4" />
                      <h3 className="text-xl sm:text-2xl font-bold mb-2">Game Over!</h3>
                      <p className="text-3xl sm:text-4xl font-bold text-primary mb-2">
                        {finalScore.toLocaleString()}
                      </p>
                      <p className="text-muted-foreground">points</p>
                      
                      {mode === "competitive" && (
                        <p className="text-sm text-emerald-400 mt-4">
                          ✓ Score submitted to leaderboard
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <Button 
                        onClick={handlePlayAgain}
                        className="flex-1"
                      >
                        Play Again
                      </Button>
                      <Button 
                        onClick={handleClose}
                        variant="outline"
                        className="flex-1"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default GamePlayModal;
