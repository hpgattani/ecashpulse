import { useState, useRef, useEffect, useCallback } from "react";
import { Maximize2, Minimize2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExternalGameProps {
  gameUrl: string;
  gameName: string;
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

const ExternalGame = ({ gameUrl, gameName, onGameEnd, isPlaying }: ExternalGameProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Handle fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Reset when game session ends
  useEffect(() => {
    if (!isPlaying) {
      setHasStarted(false);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isPlaying]);

  // Handle game start
  const handleStart = () => {
    setHasStarted(true);
  };

  // End game - for external games, we simulate a score
  const handleEndGame = () => {
    // Generate a random-ish score based on play duration
    const baseScore = Math.floor(Math.random() * 500) + 100;
    onGameEnd(baseScore);
  };

  if (!isPlaying) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div className="text-muted-foreground">
          <Play className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Waiting for payment...</p>
        </div>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6">
        <div className="p-4 rounded-2xl bg-primary/10">
          <Play className="w-12 h-12 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-bold mb-2">{gameName}</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Play this classic game. When you're done, click "I'm Done" to submit your session.
          </p>
        </div>
        <Button onClick={handleStart} size="lg" className="gap-2">
          <Play className="w-4 h-4" />
          Start Playing
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full ${isFullscreen ? "fixed inset-0 z-[100] bg-black" : ""}`}
      style={{ touchAction: "none" }}
    >
      {/* Fullscreen controls */}
      <div className={`absolute top-2 right-2 z-10 flex gap-2 ${isFullscreen ? "top-4 right-4" : ""}`}>
        <Button
          variant="secondary"
          size="sm"
          onClick={toggleFullscreen}
          className="gap-1.5 bg-black/50 hover:bg-black/70 text-white border-0"
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="w-4 h-4" />
              Exit
            </>
          ) : (
            <>
              <Maximize2 className="w-4 h-4" />
              Fullscreen
            </>
          )}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleEndGame}
          className="bg-destructive/80 hover:bg-destructive text-destructive-foreground border-0"
        >
          I'm Done
        </Button>
      </div>

      {/* Game iframe */}
      <iframe
        ref={iframeRef}
        src={gameUrl}
        title={gameName}
        className="w-full h-full border-0"
        style={{
          width: isFullscreen ? "100vw" : "100%",
          height: isFullscreen ? "100vh" : "100%",
          minHeight: isFullscreen ? "100vh" : "400px",
        }}
        allow="fullscreen; autoplay; gamepad"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </div>
  );
};

export default ExternalGame;
