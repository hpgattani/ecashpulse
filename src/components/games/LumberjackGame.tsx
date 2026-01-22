import { useState, useEffect, useCallback, useRef } from "react";
import { useTouchSwipe, SwipeDirection } from "@/hooks/useTouchSwipe";
import { useHaptic } from "@/hooks/useHaptic";
import useGameSounds from "@/hooks/useGameSounds";

interface LumberjackGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

type Side = "left" | "right";
type TreeSegment = { hasBranch: Side | null };

const LumberjackGame = ({ onGameEnd, isPlaying }: LumberjackGameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerSide, setPlayerSide] = useState<Side>("left");
  const [tree, setTree] = useState<TreeSegment[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(100);
  const [chopAnimation, setChopAnimation] = useState(false);
  const [woodChips, setWoodChips] = useState<{ x: number; y: number; vx: number; vy: number; rot: number; life: number }[]>([]);
  const timerRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const haptic = useHaptic();
  const { play } = useGameSounds();

  const generateSegment = (): TreeSegment => {
    const rand = Math.random();
    if (rand < 0.3) return { hasBranch: "left" };
    if (rand < 0.6) return { hasBranch: "right" };
    return { hasBranch: null };
  };

  const resetGame = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    const initialTree: TreeSegment[] = [];
    for (let i = 0; i < 8; i++) {
      initialTree.push(generateSegment());
    }
    initialTree[0] = { hasBranch: null };
    
    setTree(initialTree);
    setPlayerSide("left");
    setScore(0);
    setTimeLeft(100);
    setGameOver(false);
    setGameStarted(true);
    setWoodChips([]);
  }, []);

  useEffect(() => {
    if (isPlaying && !gameStarted) {
      resetGame();
    }
  }, [isPlaying, gameStarted, resetGame]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying || gameOver || !gameStarted) return;

    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0) {
          setGameOver(true);
          haptic.error();
          play("gameOver");
          onGameEnd(score);
          return 0;
        }
        return t - 1;
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, gameOver, gameStarted, score, onGameEnd, haptic, play]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const trunkWidth = 50;
    const segmentHeight = 40;

    const render = () => {
      // Sky gradient
      const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
      skyGradient.addColorStop(0, "#87ceeb");
      skyGradient.addColorStop(0.6, "#e0f4ff");
      skyGradient.addColorStop(1, "#87ceeb");
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, height);

      // Sun
      ctx.fillStyle = "#fcd34d";
      ctx.shadowColor = "#fcd34d";
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.arc(width - 40, 40, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Clouds
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      drawCloud(ctx, 30, 30, 40);
      drawCloud(ctx, 120, 50, 30);
      drawCloud(ctx, 200, 25, 35);

      // Ground with grass
      const groundY = height - 40;
      const groundGradient = ctx.createLinearGradient(0, groundY, 0, height);
      groundGradient.addColorStop(0, "#22c55e");
      groundGradient.addColorStop(1, "#16a34a");
      ctx.fillStyle = groundGradient;
      ctx.fillRect(0, groundY, width, 40);

      // Grass blades
      ctx.strokeStyle = "#15803d";
      ctx.lineWidth = 2;
      for (let i = 0; i < width; i += 8) {
        const grassHeight = 5 + Math.random() * 8;
        ctx.beginPath();
        ctx.moveTo(i, groundY);
        ctx.lineTo(i + Math.sin(Date.now() / 500 + i) * 2, groundY - grassHeight);
        ctx.stroke();
      }

      // Tree trunk
      const trunkX = (width - trunkWidth) / 2;
      const trunkBaseY = groundY - 30;

      // Tree shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.beginPath();
      ctx.ellipse(width / 2 + 20, groundY + 5, 60, 15, 0, 0, Math.PI * 2);
      ctx.fill();

      // Draw tree segments from bottom to top
      tree.forEach((segment, index) => {
        const segY = trunkBaseY - (index + 1) * segmentHeight;
        
        // Trunk with wood texture
        const trunkGradient = ctx.createLinearGradient(trunkX, segY, trunkX + trunkWidth, segY);
        trunkGradient.addColorStop(0, "#92400e");
        trunkGradient.addColorStop(0.3, "#b45309");
        trunkGradient.addColorStop(0.7, "#b45309");
        trunkGradient.addColorStop(1, "#78350f");
        ctx.fillStyle = trunkGradient;
        ctx.fillRect(trunkX, segY, trunkWidth, segmentHeight);

        // Wood rings
        ctx.strokeStyle = "rgba(120, 53, 15, 0.3)";
        ctx.lineWidth = 1;
        for (let r = 0; r < 3; r++) {
          ctx.beginPath();
          ctx.moveTo(trunkX + 5, segY + 10 + r * 12);
          ctx.lineTo(trunkX + trunkWidth - 5, segY + 10 + r * 12);
          ctx.stroke();
        }

        // Branches
        if (segment.hasBranch) {
          const branchY = segY + segmentHeight / 2;
          const branchLength = 60;
          
          ctx.fillStyle = "#92400e";
          ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
          ctx.shadowBlur = 5;
          ctx.shadowOffsetY = 3;
          
          if (segment.hasBranch === "left") {
            ctx.beginPath();
            ctx.moveTo(trunkX, branchY - 8);
            ctx.lineTo(trunkX - branchLength, branchY - 4);
            ctx.lineTo(trunkX - branchLength, branchY + 4);
            ctx.lineTo(trunkX, branchY + 8);
            ctx.fill();
            
            // Leaves
            ctx.fillStyle = "#22c55e";
            ctx.shadowColor = "rgba(34, 197, 94, 0.5)";
            drawLeaves(ctx, trunkX - branchLength - 10, branchY);
          } else {
            ctx.beginPath();
            ctx.moveTo(trunkX + trunkWidth, branchY - 8);
            ctx.lineTo(trunkX + trunkWidth + branchLength, branchY - 4);
            ctx.lineTo(trunkX + trunkWidth + branchLength, branchY + 4);
            ctx.lineTo(trunkX + trunkWidth, branchY + 8);
            ctx.fill();
            
            ctx.fillStyle = "#22c55e";
            ctx.shadowColor = "rgba(34, 197, 94, 0.5)";
            drawLeaves(ctx, trunkX + trunkWidth + branchLength + 10, branchY);
          }
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
        }
      });

      // Tree top (foliage)
      const topY = trunkBaseY - tree.length * segmentHeight - 30;
      ctx.fillStyle = "#22c55e";
      ctx.shadowColor = "rgba(34, 197, 94, 0.5)";
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(width / 2, topY - 40);
      ctx.lineTo(width / 2 - 50, topY + 30);
      ctx.lineTo(width / 2 + 50, topY + 30);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Stump
      ctx.fillStyle = "#78350f";
      ctx.fillRect(trunkX - 5, trunkBaseY, trunkWidth + 10, 30);

      // Player (lumberjack)
      const playerX = playerSide === "left" ? trunkX - 50 : trunkX + trunkWidth + 10;
      const playerY = trunkBaseY - 20;
      
      // Body
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.roundRect(playerX, playerY, 40, 50, 5);
      ctx.fill();

      // Head
      ctx.fillStyle = "#fcd9b6";
      ctx.beginPath();
      ctx.arc(playerX + 20, playerY - 10, 15, 0, Math.PI * 2);
      ctx.fill();

      // Beard
      ctx.fillStyle = "#92400e";
      ctx.beginPath();
      ctx.arc(playerX + 20, playerY - 2, 10, 0, Math.PI);
      ctx.fill();

      // Hat
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.arc(playerX + 20, playerY - 18, 12, Math.PI, 0);
      ctx.fill();

      // Axe
      const axeRotation = chopAnimation ? (playerSide === "left" ? -0.5 : 0.5) : 0;
      ctx.save();
      ctx.translate(playerX + 20, playerY + 25);
      ctx.rotate(axeRotation + (playerSide === "left" ? -0.3 : 0.3));
      
      // Handle
      ctx.fillStyle = "#78350f";
      ctx.fillRect(-3, -30, 6, 40);
      
      // Blade
      ctx.fillStyle = "#94a3b8";
      ctx.beginPath();
      if (playerSide === "left") {
        ctx.moveTo(-3, -30);
        ctx.lineTo(-20, -25);
        ctx.lineTo(-20, -15);
        ctx.lineTo(-3, -10);
      } else {
        ctx.moveTo(3, -30);
        ctx.lineTo(20, -25);
        ctx.lineTo(20, -15);
        ctx.lineTo(3, -10);
      }
      ctx.fill();
      
      // Blade shine
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      if (playerSide === "left") {
        ctx.moveTo(-5, -28);
        ctx.lineTo(-15, -24);
        ctx.lineTo(-15, -20);
        ctx.lineTo(-5, -16);
      } else {
        ctx.moveTo(5, -28);
        ctx.lineTo(15, -24);
        ctx.lineTo(15, -20);
        ctx.lineTo(5, -16);
      }
      ctx.fill();
      
      ctx.restore();

      // Wood chips particles
      setWoodChips(prev => prev.filter(chip => {
        chip.x += chip.vx;
        chip.y += chip.vy;
        chip.vy += 0.3;
        chip.rot += chip.vx * 0.1;
        chip.life -= 0.02;

        if (chip.life > 0) {
          ctx.save();
          ctx.translate(chip.x, chip.y);
          ctx.rotate(chip.rot);
          ctx.globalAlpha = chip.life;
          ctx.fillStyle = "#b45309";
          ctx.fillRect(-4, -2, 8, 4);
          ctx.restore();
          return true;
        }
        return false;
      }));

      animationRef.current = requestAnimationFrame(render);
    };

    const drawCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
      ctx.beginPath();
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      ctx.arc(x + size * 0.4, y - size * 0.1, size * 0.4, 0, Math.PI * 2);
      ctx.arc(x + size * 0.8, y, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawLeaves = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const lx = x + Math.cos(angle) * 15;
        const ly = y + Math.sin(angle) * 12;
        ctx.beginPath();
        ctx.arc(lx, ly, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [tree, playerSide, chopAnimation, woodChips, score]);

  const spawnWoodChips = useCallback((side: Side) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const centerX = canvas.width / 2;
    const chips: typeof woodChips = [];
    
    for (let i = 0; i < 8; i++) {
      chips.push({
        x: centerX + (side === "left" ? -30 : 30),
        y: canvas.height - 100,
        vx: (side === "left" ? -1 : 1) * (2 + Math.random() * 4),
        vy: -3 - Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        life: 1,
      });
    }
    
    setWoodChips(prev => [...prev, ...chips]);
  }, []);

  const chop = useCallback((side: Side) => {
    if (gameOver || !isPlaying || !gameStarted) return;

    setPlayerSide(side);
    setChopAnimation(true);
    setTimeout(() => setChopAnimation(false), 100);

    const bottomSegment = tree[0];
    if (bottomSegment?.hasBranch === side) {
      setGameOver(true);
      haptic.error();
      play("gameOver");
      onGameEnd(score);
      return;
    }

    haptic.medium();
    play("chop");
    spawnWoodChips(side);

    setTree((prevTree) => {
      const newTree = [...prevTree.slice(1), generateSegment()];
      return newTree;
    });

    setScore((s) => s + 1);
    setTimeLeft((t) => Math.min(t + 5, 100));
  }, [tree, gameOver, isPlaying, gameStarted, score, onGameEnd, haptic, play, spawnWoodChips]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOver || !gameStarted) return;

      if (e.key === "ArrowLeft" || e.key === "a") {
        chop("left");
      } else if (e.key === "ArrowRight" || e.key === "d") {
        chop("right");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, gameOver, gameStarted, chop]);

  const handleSwipe = useCallback((swipeDir: SwipeDirection) => {
    if (swipeDir === "left") {
      chop("left");
    } else if (swipeDir === "right") {
      chop("right");
    }
  }, [chop]);

  const touchHandlers = useTouchSwipe({ onSwipe: handleSwipe, threshold: 20 });

  return (
    <div 
      className="flex flex-col items-center justify-center h-full p-4 touch-none"
      style={{ background: "linear-gradient(180deg, #87ceeb 0%, #bae6fd 100%)" }}
      {...touchHandlers}
    >
      {/* Timer bar with glow */}
      <div className="w-48 h-5 bg-gray-800/50 rounded-full mb-3 overflow-hidden border-2 border-white/20" style={{ boxShadow: "0 0 20px rgba(0,0,0,0.3)" }}>
        <div
          className="h-full transition-all duration-100 rounded-full"
          style={{
            width: `${timeLeft}%`,
            background: timeLeft > 30 
              ? "linear-gradient(90deg, #22c55e, #4ade80)" 
              : timeLeft > 15 
                ? "linear-gradient(90deg, #eab308, #facc15)" 
                : "linear-gradient(90deg, #ef4444, #f87171)",
            boxShadow: timeLeft > 30 
              ? "0 0 15px rgba(34, 197, 94, 0.7)" 
              : timeLeft > 15 
                ? "0 0 15px rgba(234, 179, 8, 0.7)" 
                : "0 0 15px rgba(239, 68, 68, 0.7)",
          }}
        />
      </div>

      {/* Score */}
      <div className="text-2xl mb-3 font-bold text-amber-900 drop-shadow-lg" style={{ textShadow: "2px 2px 0 rgba(255,255,255,0.5)" }}>
        Score: {score}
      </div>
      
      <p className="text-xs text-amber-800/80 mb-2 md:hidden">Swipe left/right to chop!</p>

      {/* Game canvas */}
      <canvas
        ref={canvasRef}
        width={280}
        height={350}
        className="rounded-xl border-4 border-amber-900/30"
        style={{ boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)" }}
      />

      {/* Controls */}
      <div className="flex gap-8 mt-4">
        <button
          onTouchStart={() => chop("left")}
          onClick={() => chop("left")}
          className="w-20 h-20 bg-gradient-to-b from-amber-500 to-amber-600 active:from-amber-400 active:to-amber-500 rounded-2xl text-3xl text-white font-bold active:scale-95 transition-all border-4 border-amber-700/50"
          style={{ boxShadow: "0 6px 0 #b45309, 0 8px 20px rgba(180, 83, 9, 0.4)" }}
        >
          ←
        </button>
        <button
          onTouchStart={() => chop("right")}
          onClick={() => chop("right")}
          className="w-20 h-20 bg-gradient-to-b from-amber-500 to-amber-600 active:from-amber-400 active:to-amber-500 rounded-2xl text-3xl text-white font-bold active:scale-95 transition-all border-4 border-amber-700/50"
          style={{ boxShadow: "0 6px 0 #b45309, 0 8px 20px rgba(180, 83, 9, 0.4)" }}
        >
          →
        </button>
      </div>

      <p className="text-xs text-amber-800/80 mt-3">
        Tap or use ← → keys to chop. Avoid branches!
      </p>
    </div>
  );
};

export default LumberjackGame;
