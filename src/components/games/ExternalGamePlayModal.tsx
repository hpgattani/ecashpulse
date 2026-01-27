import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, Minimize2, Trophy, Gamepad2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";

interface ExternalGame {
  id: string;
  name: string;
  description: string;
  icon: string;
  url: string;
  embedUrl: string;
  platform: string;
  gameDbId?: string; // Database ID for leaderboard
}

interface ExternalGamePlayModalProps {
  game: ExternalGame;
  mode: "competitive" | "demo";
  isOpen: boolean;
  onClose: () => void;
}

const ESCROW_ADDRESS = "ecash:qz5j83ez703wvlwpqh94j6t45f8dn2s4lg5g7n6d3r";

const ExternalGamePlayModal = ({ game, mode, isOpen, onClose }: ExternalGamePlayModalProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaid, setIsPaid] = useState(mode === "demo");
  const [gameEnded, setGameEnded] = useState(false);
  const [score, setScore] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [playerAddressHash, setPlayerAddressHash] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { prices } = useCryptoPrices();
  const xecPrice = prices.ecash;
  const entryFeeXec = useRef(mode === "competitive" ? Math.round(1 / (xecPrice || 0.00002)) : 546);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setGameEnded(false);
      setScore("");
      setIsPaid(mode === "demo");
      
      // Lock entry fee at modal open
      if (mode === "competitive" && xecPrice) {
        entryFeeXec.current = Math.round(1 / xecPrice);
      }
    }
  }, [isOpen, mode, xecPrice]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const handlePaymentSuccess = (txid: string, address: string) => {
    setPlayerAddressHash(address.replace("ecash:", "").substring(0, 16));
    setIsPaid(true);
    toast.success("Payment confirmed! Start playing!");
  };

  const handleEndGame = () => {
    setGameEnded(true);
  };

  const handleSubmitScore = async () => {
    const numScore = parseInt(score);
    if (isNaN(numScore) || numScore < 0) {
      toast.error("Please enter a valid score");
      return;
    }

    if (mode === "demo") {
      toast.success(`Demo score: ${numScore} - Play competitive to submit to leaderboard!`);
      onClose();
      return;
    }

    if (!playerAddressHash || !game.gameDbId) {
      toast.error("Unable to submit score");
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("submit-game-score", {
        body: {
          gameId: game.gameDbId,
          score: numScore,
          playerAddressHash,
          entryFee: entryFeeXec.current,
        },
      });

      if (error) throw error;
      toast.success(`Score ${numScore} submitted to leaderboard!`);
      onClose();
    } catch (err) {
      console.error("Score submission error:", err);
      toast.error("Failed to submit score");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-2 sm:p-4"
          onClick={(e) => e.target === e.currentTarget && !gameEnded && onClose()}
        >
          <motion.div
            ref={containerRef}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-4xl bg-card rounded-xl overflow-hidden border border-border shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-card to-muted border-b border-border">
              <div className="flex items-center gap-3">
                <span className="text-2xl sm:text-3xl">{game.icon}</span>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-foreground">{game.name}</h2>
                  <div className="flex items-center gap-2">
                    {mode === "competitive" ? (
                      <span className="text-xs text-amber-400 flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> Competitive
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Gamepad2 className="w-3 h-3" /> Demo Mode
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Game Content */}
            <div className="relative" style={{ height: "500px" }}>
              {/* Payment Gate for Competitive */}
              {mode === "competitive" && !isPaid && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-card/95 backdrop-blur-sm p-6">
                  <Trophy className="w-16 h-16 text-amber-400 mb-4" />
                  <h3 className="text-xl font-bold text-foreground mb-2">Competitive Mode</h3>
                  <p className="text-muted-foreground text-center mb-4 max-w-md">
                    Pay the entry fee to compete on the weekly leaderboard. Top 3 players split the prize pool!
                  </p>
                  <p className="text-lg font-bold text-primary mb-6">
                    Entry: {entryFeeXec.current.toLocaleString()} XEC (~$1)
                  </p>
                  
                  {/* PayButton placeholder - integrate with actual PayButton */}
                  <div className="flex flex-col gap-3 w-full max-w-xs">
                    <Button
                      onClick={() => {
                        // Simulate payment for demo - in production, use actual PayButton
                        const mockAddress = "ecash:qr" + Math.random().toString(36).substring(2, 15);
                        handlePaymentSuccess("mock-tx", mockAddress);
                      }}
                      className="w-full bg-gradient-to-r from-primary to-accent"
                    >
                      Pay with Wallet
                    </Button>
                    <Button variant="outline" onClick={onClose}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Score Submission Overlay */}
              {gameEnded && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-card/95 backdrop-blur-sm p-6">
                  <Trophy className="w-16 h-16 text-amber-400 mb-4" />
                  <h3 className="text-xl font-bold text-foreground mb-2">Game Over!</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Enter your final score from the game:
                  </p>
                  
                  <div className="flex flex-col gap-4 w-full max-w-xs">
                    <Input
                      type="number"
                      placeholder="Enter your score"
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                      className="text-center text-xl font-bold"
                      min="0"
                    />
                    
                    <Button
                      onClick={handleSubmitScore}
                      disabled={isSubmitting || !score}
                      className="w-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : mode === "competitive" ? (
                        "Submit to Leaderboard"
                      ) : (
                        "Submit Demo Score"
                      )}
                    </Button>
                    
                    <Button variant="outline" onClick={onClose}>
                      Close
                    </Button>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isLoading && isPaid && !gameEnded && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card">
                  <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                  <p className="text-muted-foreground">Loading game...</p>
                </div>
              )}

              {/* Game iFrame */}
              {isPaid && !gameEnded && (
                <iframe
                  src={game.embedUrl}
                  className="w-full h-full border-0"
                  allow="autoplay; fullscreen; gamepad; keyboard-map"
                  allowFullScreen
                  onLoad={() => setIsLoading(false)}
                  title={game.name}
                />
              )}
            </div>

            {/* Footer with End Game button */}
            {isPaid && !gameEnded && (
              <div className="p-3 border-t border-border bg-muted/50 flex justify-between items-center">
                <p className="text-xs text-muted-foreground">
                  Use keyboard to play. Click "End Game" when finished.
                </p>
                <Button
                  onClick={handleEndGame}
                  variant="destructive"
                  size="sm"
                >
                  End Game & Submit Score
                </Button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExternalGamePlayModal;
