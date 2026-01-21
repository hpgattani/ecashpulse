import { useState, useEffect, useCallback, useRef } from "react";
import { useTouchSwipe, SwipeDirection } from "@/hooks/useTouchSwipe";

interface LumberjackGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

type Side = "left" | "right";
type TreeSegment = { hasBranch: Side | null };

const LumberjackGame = ({ onGameEnd, isPlaying }: LumberjackGameProps) => {
  const [playerSide, setPlayerSide] = useState<Side>("left");
  const [tree, setTree] = useState<TreeSegment[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [timeLeft, setTimeLeft] = useState(100);
  const timerRef = useRef<number | null>(null);

  const generateSegment = (): TreeSegment => {
    const rand = Math.random();
    if (rand < 0.3) return { hasBranch: "left" };
    if (rand < 0.6) return { hasBranch: "right" };
    return { hasBranch: null };
  };

  const resetGame = useCallback(() => {
    const initialTree: TreeSegment[] = [];
    for (let i = 0; i < 8; i++) {
      initialTree.push(generateSegment());
    }
    // Ensure first segment is safe
    initialTree[0] = { hasBranch: null };
    
    setTree(initialTree);
    setPlayerSide("left");
    setScore(0);
    setTimeLeft(100);
    setGameOver(false);
  }, []);

  useEffect(() => {
    if (isPlaying && !gameOver) {
      resetGame();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying || gameOver) return;

    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0) {
          setGameOver(true);
          onGameEnd(score);
          return 0;
        }
        return t - 1;
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, gameOver, score, onGameEnd]);

  const chop = useCallback((side: Side) => {
    if (gameOver || !isPlaying) return;

    setPlayerSide(side);

    // Check if hit by branch
    const bottomSegment = tree[0];
    if (bottomSegment.hasBranch === side) {
      setGameOver(true);
      onGameEnd(score);
      return;
    }

    // Remove bottom segment and add new one at top
    setTree((prevTree) => {
      const newTree = [...prevTree.slice(1), generateSegment()];
      return newTree;
    });

    setScore((s) => s + 1);
    setTimeLeft((t) => Math.min(t + 5, 100)); // Add time bonus
  }, [tree, gameOver, isPlaying, score, onGameEnd]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOver) return;

      if (e.key === "ArrowLeft" || e.key === "a") {
        chop("left");
      } else if (e.key === "ArrowRight" || e.key === "d") {
        chop("right");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, gameOver, chop]);

  // Touch swipe controls
  const handleSwipe = useCallback((swipeDir: SwipeDirection) => {
    if (swipeDir === "left") {
      chop("left");
    } else if (swipeDir === "right") {
      chop("right");
    }
  }, [chop]);

  const touchHandlers = useTouchSwipe({
    onSwipe: handleSwipe,
    threshold: 20,
  });

  return (
    <div 
      className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-sky-400 to-sky-600 p-4 touch-none"
      {...touchHandlers}
    >
      {/* Timer bar */}
      <div className="w-48 h-4 bg-gray-800 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full transition-all duration-100"
          style={{
            width: `${timeLeft}%`,
            backgroundColor: timeLeft > 30 ? "#22c55e" : timeLeft > 15 ? "#eab308" : "#ef4444",
          }}
        />
      </div>

      <div className="text-white text-2xl mb-4 font-bold">Score: {score}</div>
      
      {/* Swipe hint for mobile */}
      <p className="text-xs text-white/70 mb-2 md:hidden">Swipe left/right to chop!</p>

      {/* Tree */}
      <div className="relative flex flex-col items-center">
        {/* Tree segments */}
        <div className="flex flex-col-reverse">
          {tree.map((segment, index) => (
            <div key={index} className="relative flex items-center justify-center">
              {/* Left branch */}
              {segment.hasBranch === "left" && (
                <div
                  className="absolute right-full w-16 h-6 bg-amber-800 rounded-l-lg"
                  style={{ marginRight: -4 }}
                />
              )}
              
              {/* Trunk */}
              <div className="w-12 h-10 bg-amber-700 border-x-4 border-amber-900" />
              
              {/* Right branch */}
              {segment.hasBranch === "right" && (
                <div
                  className="absolute left-full w-16 h-6 bg-amber-800 rounded-r-lg"
                  style={{ marginLeft: -4 }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Player */}
        <div className="relative w-48 h-16 flex items-end justify-center">
          <div
            className={`absolute transition-all duration-100 text-5xl ${
              playerSide === "left" ? "left-4" : "right-4"
            }`}
          >
            🪓
          </div>
          {/* Stump */}
          <div className="w-16 h-8 bg-amber-800 rounded-t-lg" />
        </div>
      </div>

      {/* Ground */}
      <div className="w-64 h-4 bg-green-700 rounded-lg mt-2" />

      {/* Controls */}
      <div className="flex gap-8 mt-6">
        <button
          onTouchStart={() => chop("left")}
          onClick={() => chop("left")}
          className="w-20 h-20 bg-primary/80 active:bg-primary rounded-xl text-3xl active:scale-95 transition-all"
        >
          ←
        </button>
        <button
          onTouchStart={() => chop("right")}
          onClick={() => chop("right")}
          className="w-20 h-20 bg-primary/80 active:bg-primary rounded-xl text-3xl active:scale-95 transition-all"
        >
          →
        </button>
      </div>

      <p className="text-xs text-white/80 mt-4">
        Tap or use ← → keys to chop. Avoid branches!
      </p>
    </div>
  );
};

export default LumberjackGame;