import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import { toast } from "sonner";
import { Gamepad2, Trophy, Zap, CheckCircle } from "lucide-react";
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
  const [entryFeeXec, setEntryFeeXec] = useState(0);
  const payButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep("payment");
      setFinalScore(0);
      calculateEntryFee();
    }
  }, [isOpen, mode]);

  const calculateEntryFee = () => {
    if (mode === "demo") {
      setEntryFeeXec(DEMO_MIN_XEC);
    } else {
      // $1 USD in XEC
      const xecPrice = prices?.ecash || 0.00003;
      const oneUsdInXec = 1 / xecPrice;
      setEntryFeeXec(Math.ceil(oneUsdInXec));
    }
  };

  // Render PayButton
  useEffect(() => {
    if (!isOpen || !payButtonRef.current || step !== "payment" || entryFeeXec <= 0) {
      if (payButtonRef.current) {
        payButtonRef.current.innerHTML = "";
      }
      return;
    }

    const timer = setTimeout(() => {
      if (!payButtonRef.current) return;

      payButtonRef.current.innerHTML = "";

      const buttonContainer = document.createElement("div");
      payButtonRef.current.appendChild(buttonContainer);

      if (typeof (window as any).PayButton !== "undefined") {
        (window as any).PayButton.render(buttonContainer, {
          to: ESCROW_ADDRESS,
          amount: entryFeeXec,
          currency: "XEC",
          text: `Pay ${entryFeeXec.toLocaleString()} XEC`,
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

            // Show branded toast
            toast.custom(
              () => (
                <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-500/90 to-teal-500/90 text-white shadow-xl backdrop-blur-sm border border-white/20">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Payment Sent!</p>
                    <p className="text-sm text-white/80">{entryFeeXec.toLocaleString()} XEC</p>
                  </div>
                </div>
              ),
              { duration: 4000, position: "bottom-center" }
            );

            handlePaymentSuccess(txHash);
          },
          onError: (error: any) => {
            console.error("PayButton error:", error);
            toast.error("Payment failed", {
              description: "Please try again.",
            });
          },
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isOpen, step, entryFeeXec, mode]);

  const handlePaymentSuccess = async (txHash?: string) => {
    console.log("Game payment received:", txHash);
    setStep("playing");
  };

  const handleGameEnd = async (score: number) => {
    setFinalScore(score);
    setStep("finished");

    if (mode === "competitive") {
      // Submit score to backend
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
      isPlaying: step === "playing",
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
        return <div>Game not found</div>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg glass-card border-primary/20 fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-3xl">{game.icon}</span>
            <div>
              <span className="text-xl">{game.name}</span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                mode === "competitive" 
                  ? "bg-amber-500/20 text-amber-400" 
                  : "bg-blue-500/20 text-blue-400"
              }`}>
                {mode === "competitive" ? "Competitive" : "Demo"}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {step === "payment" && (
            <div className="text-center space-y-6">
              <div className="p-6 rounded-xl bg-muted/20 border border-border/30">
                {mode === "competitive" ? (
                  <>
                    <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                    <h3 className="text-lg font-bold mb-2">Competitive Entry</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Your score will be added to the weekly leaderboard. Top 3 win prizes!
                    </p>
                  </>
                ) : (
                  <>
                    <Zap className="w-12 h-12 text-blue-400 mx-auto mb-3" />
                    <h3 className="text-lg font-bold mb-2">Demo Mode</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Practice without affecting the leaderboard.
                    </p>
                  </>
                )}

                <div className="text-3xl font-bold text-primary mb-2">
                  {entryFeeXec.toLocaleString()} XEC
                </div>
                <p className="text-xs text-muted-foreground">
                  {mode === "competitive" ? "≈ $1 USD" : "Minimum demo fee"}
                </p>
              </div>

              {/* PayButton container - centered */}
              <div className="flex justify-center">
                <div ref={payButtonRef} className="min-h-[50px]" />
              </div>
            </div>
          )}

          {step === "playing" && (
            <div className="aspect-square max-h-[400px] w-full bg-black/50 rounded-lg overflow-hidden">
              {renderGame()}
            </div>
          )}

          {step === "finished" && (
            <div className="text-center space-y-6">
              <div className="p-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30">
                <Gamepad2 className="w-16 h-16 text-primary mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Game Over!</h3>
                <p className="text-4xl font-bold text-primary mb-2">
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
                  onClick={() => setStep("payment")}
                  className="flex-1"
                >
                  Play Again
                </Button>
                <Button 
                  onClick={onClose}
                  variant="outline"
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GamePlayModal;