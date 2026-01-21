import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trophy, Zap, Gamepad2, CheckCircle } from "lucide-react";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";

import SnakeGame from "./SnakeGame";
import TetrisGame from "./TetrisGame";
import LumberjackGame from "./LumberjackGame";
import SpaceShooterGame from "./SpaceShooterGame";

/* ------------------------------------------------------------------ */
/* Constants */
/* ------------------------------------------------------------------ */

const ESCROW_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";

const DEMO_FEE_XEC = 5.46;

type Step = "payment" | "playing" | "finished";

interface MiniGame {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
}

interface Props {
  game: MiniGame;
  mode: "competitive" | "demo";
  isOpen: boolean;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/* Component */
/* ------------------------------------------------------------------ */

export default function GamePlayModal({ game, mode, isOpen, onClose }: Props) {
  const { prices } = useCryptoPrices();

  const [step, setStep] = useState<Step>("payment");
  const [entryFeeXec, setEntryFeeXec] = useState<number>(0);
  const [finalScore, setFinalScore] = useState<number>(0);

  const payButtonRef = useRef<HTMLDivElement>(null);

  /* ------------------------------------------------------------------ */
  /* Entry Fee Calculation */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!isOpen) return;

    setStep("payment");
    setFinalScore(0);

    if (mode === "demo") {
      setEntryFeeXec(DEMO_FEE_XEC);
      return;
    }

    const price = prices?.ecash;
    if (!price || price <= 0) {
      setEntryFeeXec(0);
      return;
    }

    const oneUsdInXec = 1 / price;
    setEntryFeeXec(Number(oneUsdInXec.toFixed(2)));
  }, [isOpen, mode, prices?.ecash]);

  /* ------------------------------------------------------------------ */
  /* PayButton Rendering */
  /* ------------------------------------------------------------------ */

  const renderPayButton = useCallback(() => {
    if (!payButtonRef.current) return;
    if (!(window as any).PayButton) return;

    payButtonRef.current.innerHTML = "";

    const container = document.createElement("div");
    payButtonRef.current.appendChild(container);

    (window as any).PayButton.render(container, {
      to: ESCROW_ADDRESS,
      amount: entryFeeXec, // ✅ EXACT DECIMAL
      currency: "XEC",
      text: `Pay ${entryFeeXec} XEC`,
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
      onSuccess: (tx: any) => {
        toast.custom(
          () => (
            <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-emerald-500 text-white shadow-xl">
              <CheckCircle className="w-5 h-5" />
              <div>
                <p className="font-semibold">Payment Sent</p>
                <p className="text-sm opacity-90">{entryFeeXec} XEC</p>
              </div>
            </div>
          ),
          { duration: 4000 },
        );

        setStep("playing");
      },
      onError: (err: any) => {
        console.error("PayButton error:", err);
        toast.error("Payment failed. Please try again.");
      },
    });
  }, [entryFeeXec, mode]);

  useEffect(() => {
    if (!isOpen || step !== "payment" || entryFeeXec <= 0) return;

    const interval = setInterval(() => {
      if ((window as any).PayButton) {
        clearInterval(interval);
        renderPayButton();
      }
    }, 100);

    return () => {
      clearInterval(interval);
      if (payButtonRef.current) {
        payButtonRef.current.innerHTML = "";
      }
    };
  }, [isOpen, step, entryFeeXec, renderPayButton]);

  /* ------------------------------------------------------------------ */
  /* Game Logic */
  /* ------------------------------------------------------------------ */

  const handleGameEnd = async (score: number) => {
    setFinalScore(score);
    setStep("finished");

    if (mode === "competitive") {
      try {
        await fetch("/api/submit-game-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId: game.id,
            score,
            isCompetitive: true,
          }),
        });
        toast.success(`Score submitted: ${score.toLocaleString()}`);
      } catch {
        toast.error("Failed to submit score");
      }
    }
  };

  const renderGame = () => {
    const props = { onGameEnd: handleGameEnd, isPlaying: step === "playing" };

    switch (game.slug) {
      case "snake":
        return <SnakeGame {...props} />;
      case "tetris":
        return <TetrisGame {...props} />;
      case "lumberjack":
        return <LumberjackGame {...props} />;
      case "space-shooter":
        return <SpaceShooterGame {...props} />;
      default:
        return <div>Game not found</div>;
    }
  };

  /* ------------------------------------------------------------------ */
  /* UI */
  /* ------------------------------------------------------------------ */

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-3xl">{game.icon}</span>
            <span>{game.name}</span>
          </DialogTitle>
        </DialogHeader>

        {step === "payment" && (
          <div className="space-y-6 text-center">
            <div className="p-6 rounded-xl bg-muted/20 border">
              {mode === "competitive" ? (
                <>
                  <Trophy className="mx-auto text-amber-400 w-12 h-12 mb-3" />
                  <p className="font-bold">Competitive Entry</p>
                  <p className="text-sm text-muted-foreground">Leaderboard enabled</p>
                </>
              ) : (
                <>
                  <Zap className="mx-auto text-blue-400 w-12 h-12 mb-3" />
                  <p className="font-bold">Demo Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Entry fee: <strong>5.46 XEC</strong>
                  </p>
                </>
              )}

              <div className="text-3xl font-bold mt-4">{entryFeeXec} XEC</div>
            </div>

            <div className="flex justify-center">
              <div ref={payButtonRef} />
            </div>
          </div>
        )}

        {step === "playing" && (
          <div className="aspect-square max-h-[400px] bg-black rounded-lg overflow-hidden">{renderGame()}</div>
        )}

        {step === "finished" && (
          <div className="text-center space-y-6">
            <Gamepad2 className="mx-auto w-16 h-16 text-primary" />
            <p className="text-4xl font-bold">{finalScore.toLocaleString()}</p>
            <p className="text-muted-foreground">points</p>

            <div className="flex gap-3">
              <Button className="flex-1" onClick={() => setStep("payment")}>
                Play Again
              </Button>
              <Button className="flex-1" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
