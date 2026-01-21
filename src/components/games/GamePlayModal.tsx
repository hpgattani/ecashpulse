import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trophy, Zap, Gamepad2, CheckCircle } from "lucide-react";

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
  mode: "competitive" | "demo";
  isOpen: boolean;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/* COMPONENT */
/* ------------------------------------------------------------------ */

export default function GamePlayModal({ game, mode, isOpen, onClose }: Props) {
  const [step, setStep] = useState<Step>("payment");
  const [finalScore, setFinalScore] = useState(0);

  /* ------------------------------------------------------------------ */
  /* BODY SCROLL LOCK (MOBILE STABLE) */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
    };
  }, [isOpen]);

  /* ------------------------------------------------------------------ */
  /* PAYBUTTON (PORTAL – DEEPLINK SAFE) */
  /* ------------------------------------------------------------------ */

  const renderPayButton = useCallback(() => {
    const portal = document.getElementById("paybutton-portal");
    if (!portal) return;
    if (!(window as any).PayButton) return;

    portal.innerHTML = "";

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "50%";
    container.style.bottom = "24px";
    container.style.transform = "translateX(-50%)";
    container.style.zIndex = "9999";
    container.style.width = "90%";
    container.style.maxWidth = "420px";

    portal.appendChild(container);

    (window as any).PayButton.render(container, {
      to: ESCROW_ADDRESS,
      amount: DEMO_FEE_XEC, // ✅ EXACT 5.46
      currency: "XEC",
      text: `Send ${DEMO_FEE_XEC} XEC`,
      hoverText: "Open Wallet",
      autoClose: false,
      hideToasts: true,
      onSuccess: () => {
        portal.innerHTML = "";
        toast.custom(
          () => (
            <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-emerald-500 text-white shadow-xl">
              <CheckCircle className="w-5 h-5" />
              <span>Payment Sent</span>
            </div>
          ),
          { duration: 3000 },
        );
        setStep("playing");
      },
      onError: () => {
        toast.error("Payment failed. Please try again.");
      },
    });
  }, []);

  useEffect(() => {
    if (!isOpen || step !== "payment") return;

    const interval = setInterval(() => {
      if ((window as any).PayButton) {
        clearInterval(interval);
        renderPayButton();
      }
    }, 100);

    return () => {
      clearInterval(interval);
      const portal = document.getElementById("paybutton-portal");
      if (portal) portal.innerHTML = "";
    };
  }, [isOpen, step, renderPayButton]);

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
      <DialogContent
        className="
          fixed
          left-1/2
          top-1/2
          -translate-x-1/2
          -translate-y-1/2
          sm:max-w-lg
          max-h-[90vh]
          overflow-y-auto
        "
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-3xl">{game.icon}</span>
            <span>{game.name}</span>
          </DialogTitle>
        </DialogHeader>

        {step === "payment" && (
          <div className="space-y-6 text-center">
            <div className="p-6 rounded-xl bg-muted/20 border">
              <Zap className="mx-auto text-blue-400 w-12 h-12 mb-3" />
              <p className="font-bold">Demo Mode</p>
              <p className="text-sm text-muted-foreground">
                Entry fee: <strong>5.46 XEC</strong>
              </p>
            </div>

            <p className="text-xs text-muted-foreground">Wallet will open at the bottom of the screen</p>
          </div>
        )}

        {step === "playing" && (
          <div className="aspect-square max-h-[400px] bg-black rounded-lg overflow-hidden">{renderGame()}</div>
        )}

        {step === "finished" && (
          <div className="text-center space-y-6">
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
