import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trophy, Zap, Gamepad2 } from "lucide-react";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";

import SnakeGame from "./SnakeGame";
import TetrisGame from "./TetrisGame";
import LumberjackGame from "./LumberjackGame";
import SpaceShooterGame from "./SpaceShooterGame";

/* ------------------------------------------------------------------ */
/* CONSTANTS */
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
  mode: "competitive" | "demo"; // ✅ ALWAYS
  isOpen: boolean;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/* COMPONENT */
/* ------------------------------------------------------------------ */

export default function GamePlayModal({ game, mode, isOpen, onClose }: Props) {
  const { prices } = useCryptoPrices();

  const [step, setStep] = useState<Step>("payment");
  const [finalScore, setFinalScore] = useState(0);
  const [entryFeeXec, setEntryFeeXec] = useState<number>(0);

  const payButtonRef = useRef<HTMLDivElement>(null);

  /* ------------------------------------------------------------------ */
  /* ENTRY FEE (SAFE FOR BOTH MODES) */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!isOpen) return;

    setStep("payment");
    setFinalScore(0);

    if (mode === "demo") {
      setEntryFeeXec(DEMO_FEE_XEC);
      return;
    }

    // competitive: approx $1
    const price = prices?.ecash;
    if (!price || price <= 0) {
      setEntryFeeXec(0);
      return;
    }

    const oneUsdInXec = 1 / price;
    setEntryFeeXec(Number(oneUsdInXec.toFixed(2)));
  }, [isOpen, mode, prices?.ecash]);

  /* ------------------------------------------------------------------ */
  /* PAYBUTTON (DYNAMIC LOAD + RETRY) */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!isOpen || step !== "payment" || entryFeeXec <= 0) return;

    let cancelled = false;

    function loadAndRender() {
      if (cancelled) return;

      // Inject script if needed
      if (!(window as any).PayButton) {
        if (!document.getElementById("paybutton-js")) {
          const script = document.createElement("script");
          script.id = "paybutton-js";
          script.src = "https://paybutton.org/paybutton.js";
          script.async = true;
          document.body.appendChild(script);
        }
        setTimeout(loadAndRender, 200);
        return;
      }

      if (!payButtonRef.current) {
        setTimeout(loadAndRender, 100);
        return;
      }

      payButtonRef.current.innerHTML = "";

      const container = document.createElement("div");
      payButtonRef.current.appendChild(container);

      (window as any).PayButton.render(container, {
        to: ESCROW_ADDRESS,
        amount: entryFeeXec,
        currency: "XEC",
        text: `Send ${entryFeeXec} XEC`,
        hoverText: "Send with XEC wallet",
        autoClose: true,
        hideToasts: true,
        onSuccess: () => {
          toast.success("Payment sent");
          setStep("playing");
        },
        onError: () => {
          toast.error("Payment failed");
        },
      });
    }

    loadAndRender();

    return () => {
      cancelled = true;
      if (payButtonRef.current) {
        payButtonRef.current.innerHTML = "";
      }
    };
  }, [isOpen, step, entryFeeXec]);

  /* ------------------------------------------------------------------ */
  /* GAME */
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
      <DialogContent className="sm:max-w-lg">
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
                  <Trophy className="mx-auto w-12 h-12 text-amber-400 mb-3" />
                  <p className="font-bold">Competitive Mode</p>
                  <p className="text-sm text-muted-foreground">Approx $1 entry</p>
                </>
              ) : (
                <>
                  <Zap className="mx-auto w-12 h-12 text-blue-400 mb-3" />
                  <p className="font-bold">Demo Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Entry fee: <strong>5.46 XEC</strong>
                  </p>
                </>
              )}

              <div className="text-3xl font-bold mt-4">{entryFeeXec} XEC</div>
            </div>

            <div
              ref={payButtonRef}
              className="min-h-[180px] flex items-center justify-center text-sm text-muted-foreground"
            >
              Loading payment…
            </div>
          </div>
        )}

        {step === "playing" && (
          <div className="aspect-square max-h-[400px] bg-black rounded-lg overflow-hidden">{renderGame()}</div>
        )}

        {step === "finished" && (
          <div className="space-y-6 text-center">
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
