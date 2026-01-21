import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Zap, Gamepad2, CheckCircle } from "lucide-react";

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
  icon: string;
}

interface Props {
  game: MiniGame;
  mode: "demo";
  isOpen: boolean;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/* COMPONENT */
/* ------------------------------------------------------------------ */

export default function GamePlayModal({ game, isOpen, onClose }: Props) {
  const [step, setStep] = useState<Step>("payment");
  const [finalScore, setFinalScore] = useState(0);
  const payButtonRef = useRef<HTMLDivElement>(null);

  /* ------------------------------------------------------------------ */
  /* LOAD PAYBUTTON SCRIPT (STANDARD WAY) */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if ((window as any).PayButton) return;

    const script = document.createElement("script");
    script.src = "https://paybutton.org/paybutton.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  /* ------------------------------------------------------------------ */
  /* RENDER PAYBUTTON (NO FIXED / NO TRANSFORM) */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (!isOpen || step !== "payment") return;
    if (!(window as any).PayButton) return;
    if (!payButtonRef.current) return;

    payButtonRef.current.innerHTML = "";

    const container = document.createElement("div");
    payButtonRef.current.appendChild(container);

    (window as any).PayButton.render(container, {
      to: ESCROW_ADDRESS,
      amount: DEMO_FEE_XEC,
      currency: "XEC",
      text: `Send ${DEMO_FEE_XEC} XEC`,
      hoverText: "Open Wallet",
      autoClose: true,
      hideToasts: true,
      onSuccess: () => {
        toast.custom(
          () => (
            <div className="flex items-center gap-3 px-6 py-4 rounded-xl bg-emerald-500 text-white">
              <CheckCircle className="w-5 h-5" />
              <span>Payment sent</span>
            </div>
          ),
          { duration: 3000 },
        );
        setStep("playing");
      },
      onError: () => {
        toast.error("Payment failed");
      },
    });
  }, [isOpen, step]);

  /* ------------------------------------------------------------------ */
  /* GAME */
  /* ------------------------------------------------------------------ */

  const handleGameEnd = (score: number) => {
    setFinalScore(score);
    setStep("finished");
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
      {/* ❗ IMPORTANT: NO fixed / NO transform */}
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
              <Zap className="mx-auto w-12 h-12 text-blue-400 mb-3" />
              <p className="font-bold">Demo Mode</p>
              <p className="text-sm text-muted-foreground">
                Entry fee: <strong>5.46 XEC</strong>
              </p>
            </div>

            {/* PAYBUTTON LIVES HERE */}
            <div ref={payButtonRef} className="flex justify-center" />
          </div>
        )}

        {step === "playing" && <div className="aspect-square bg-black rounded-lg overflow-hidden">{renderGame()}</div>}

        {step === "finished" && (
          <div className="space-y-6 text-center">
            <Gamepad2 className="mx-auto w-16 h-16 text-primary" />
            <p className="text-4xl font-bold">{finalScore}</p>
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
