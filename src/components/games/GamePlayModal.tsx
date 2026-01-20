import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import { toast } from "sonner";
import { Gamepad2, Trophy, Zap, Wallet } from "lucide-react";
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

  const handlePaymentSuccess = async () => {
    toast.success("Payment received! Starting game...");
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
      <DialogContent className="sm:max-w-lg glass-card border-primary/20">
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

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Send payment to start playing:
                </p>
                
                {/* PayButton placeholder - will integrate with actual PayButton */}
                <div className="p-4 rounded-lg bg-card border border-border/30">
                  <Wallet className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <p className="text-xs text-muted-foreground mb-2">Send to:</p>
                  <p className="font-mono text-xs break-all text-foreground">
                    {ESCROW_ADDRESS}
                  </p>
                  <Button 
                    onClick={handlePaymentSuccess}
                    className="mt-4 w-full"
                  >
                    I've Paid - Start Game
                  </Button>
                </div>
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