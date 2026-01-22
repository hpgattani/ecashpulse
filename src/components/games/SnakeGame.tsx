import { useState, useEffect, useCallback, useRef } from "react";
import { useTouchSwipe, SwipeDirection } from "@/hooks/useTouchSwipe";
import { useHaptic } from "@/hooks/useHaptic";
import useGameSounds from "@/hooks/useGameSounds";

interface SnakeGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

const GRID_SIZE = 20;
const CELL_SIZE = 18;
const INITIAL_SPEED = 150;

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Position = { x: number; y: number };

const SnakeGame = ({ onGameEnd, isPlaying }: SnakeGameProps) => {
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Direction>("RIGHT");
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const gameLoopRef = useRef<number | null>(null);
  const directionRef = useRef<Direction>("RIGHT");
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; life: number; color: string }[]>([]);
  const animationRef = useRef<number | null>(null);
  const haptic = useHaptic();
  const { play } = useGameSounds();

  const generateFood = useCallback((): Position => {
    return {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  }, []);

  const resetGame = useCallback(() => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    setSnake([{ x: 10, y: 10 }]);
    setFood(generateFood());
    setDirection("RIGHT");
    directionRef.current = "RIGHT";
    setScore(0);
    setGameOver(false);
    setGameStarted(true);
    particlesRef.current = [];
  }, [generateFood]);

  useEffect(() => {
    if (isPlaying && !gameStarted) {
      resetGame();
    }
  }, [isPlaying, gameStarted, resetGame]);

  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Spawn particles on food eat
  const spawnParticles = useCallback((x: number, y: number) => {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      particlesRef.current.push({
        x: x * CELL_SIZE + CELL_SIZE / 2,
        y: y * CELL_SIZE + CELL_SIZE / 2,
        vx: Math.cos(angle) * (2 + Math.random() * 2),
        vy: Math.sin(angle) * (2 + Math.random() * 2),
        life: 1,
        color: `hsl(${Math.random() * 60 + 100}, 100%, 60%)`,
      });
    }
  }, []);

  // Canvas rendering with effects
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw grid with subtle glow
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lines
      ctx.strokeStyle = "rgba(59, 130, 246, 0.1)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(canvas.width, i * CELL_SIZE);
        ctx.stroke();
      }

      // Draw snake with gradient and glow
      snake.forEach((segment, index) => {
        const isHead = index === 0;
        const x = segment.x * CELL_SIZE;
        const y = segment.y * CELL_SIZE;
        const size = CELL_SIZE - 2;

        // Glow effect
        if (isHead) {
          ctx.shadowColor = "#22c55e";
          ctx.shadowBlur = 15;
        } else {
          ctx.shadowColor = "#22c55e";
          ctx.shadowBlur = 8;
        }

        // Gradient fill
        const gradient = ctx.createRadialGradient(
          x + size / 2, y + size / 2, 0,
          x + size / 2, y + size / 2, size
        );
        if (isHead) {
          gradient.addColorStop(0, "#4ade80");
          gradient.addColorStop(1, "#16a34a");
        } else {
          const alpha = 1 - (index / snake.length) * 0.5;
          gradient.addColorStop(0, `rgba(74, 222, 128, ${alpha})`);
          gradient.addColorStop(1, `rgba(22, 163, 74, ${alpha})`);
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, size, size, isHead ? 6 : 4);
        ctx.fill();

        // Eye for head
        if (isHead) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#fff";
          const eyeOffset = {
            UP: { x: 4, y: 3 },
            DOWN: { x: 4, y: 10 },
            LEFT: { x: 3, y: 6 },
            RIGHT: { x: 10, y: 6 },
          }[direction];
          ctx.beginPath();
          ctx.arc(x + eyeOffset.x, y + eyeOffset.y, 3, 0, Math.PI * 2);
          ctx.arc(x + eyeOffset.x + 6, y + eyeOffset.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      });

      // Draw food with pulsing glow
      const foodX = food.x * CELL_SIZE;
      const foodY = food.y * CELL_SIZE;
      const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;

      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 20 * pulse;

      const foodGradient = ctx.createRadialGradient(
        foodX + CELL_SIZE / 2, foodY + CELL_SIZE / 2, 0,
        foodX + CELL_SIZE / 2, foodY + CELL_SIZE / 2, CELL_SIZE / 2
      );
      foodGradient.addColorStop(0, "#fca5a5");
      foodGradient.addColorStop(0.5, "#ef4444");
      foodGradient.addColorStop(1, "#dc2626");

      ctx.fillStyle = foodGradient;
      ctx.beginPath();
      ctx.arc(foodX + CELL_SIZE / 2, foodY + CELL_SIZE / 2, (CELL_SIZE - 4) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
        p.vy += 0.1; // gravity

        if (p.life > 0) {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          return true;
        }
        return false;
      });

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [snake, food, direction]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOver) return;

      let newDir: Direction | null = null;
      switch (e.key) {
        case "ArrowUp":
        case "w":
          if (directionRef.current !== "DOWN") newDir = "UP";
          break;
        case "ArrowDown":
        case "s":
          if (directionRef.current !== "UP") newDir = "DOWN";
          break;
        case "ArrowLeft":
        case "a":
          if (directionRef.current !== "RIGHT") newDir = "LEFT";
          break;
        case "ArrowRight":
        case "d":
          if (directionRef.current !== "LEFT") newDir = "RIGHT";
          break;
      }
      
      if (newDir) {
        directionRef.current = newDir;
        setDirection(newDir);
        haptic.light();
        play("move");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, gameOver, haptic, play]);

  useEffect(() => {
    if (!isPlaying || gameOver || !gameStarted) return;

    const moveSnake = () => {
      setSnake((prevSnake) => {
        const head = { ...prevSnake[0] };

        switch (directionRef.current) {
          case "UP": head.y -= 1; break;
          case "DOWN": head.y += 1; break;
          case "LEFT": head.x -= 1; break;
          case "RIGHT": head.x += 1; break;
        }

        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          setGameOver(true);
          haptic.error();
          play("gameOver");
          onGameEnd(score);
          return prevSnake;
        }

        if (prevSnake.some((segment) => segment.x === head.x && segment.y === head.y)) {
          setGameOver(true);
          haptic.error();
          play("gameOver");
          onGameEnd(score);
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        if (head.x === food.x && head.y === food.y) {
          setScore((s) => s + 10);
          spawnParticles(food.x, food.y);
          setFood(generateFood());
          haptic.success();
          play("eat");
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    };

    gameLoopRef.current = window.setInterval(moveSnake, INITIAL_SPEED - Math.min(score, 100));

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPlaying, gameOver, gameStarted, food, score, onGameEnd, generateFood, haptic, play, spawnParticles]);

  const handleSwipe = useCallback((swipeDir: SwipeDirection) => {
    if (!isPlaying || gameOver) return;
    
    const directionMap: Record<SwipeDirection, Direction> = {
      up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT",
    };
    
    const newDirection = directionMap[swipeDir];
    
    if (
      (newDirection === "UP" && directionRef.current !== "DOWN") ||
      (newDirection === "DOWN" && directionRef.current !== "UP") ||
      (newDirection === "LEFT" && directionRef.current !== "RIGHT") ||
      (newDirection === "RIGHT" && directionRef.current !== "LEFT")
    ) {
      directionRef.current = newDirection;
      setDirection(newDirection);
      haptic.light();
      play("move");
    }
  }, [isPlaying, gameOver, haptic, play]);

  const touchHandlers = useTouchSwipe({ onSwipe: handleSwipe, threshold: 20 });

  const handleButtonTouch = (newDirection: Direction) => {
    if (!isPlaying || gameOver) return;
    
    if (
      (newDirection === "UP" && directionRef.current !== "DOWN") ||
      (newDirection === "DOWN" && directionRef.current !== "UP") ||
      (newDirection === "LEFT" && directionRef.current !== "RIGHT") ||
      (newDirection === "RIGHT" && directionRef.current !== "LEFT")
    ) {
      directionRef.current = newDirection;
      setDirection(newDirection);
      haptic.light();
      play("move");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-4" style={{ background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)" }}>
      {/* Score with glow */}
      <div className="text-2xl mb-3 font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300 drop-shadow-lg">
        Score: {score}
      </div>
      
      <p className="text-xs text-primary/70 mb-2 md:hidden">Swipe on game area to move</p>
      
      <div
        ref={gameAreaRef}
        className="relative border-2 border-primary/50 rounded-lg touch-none overflow-hidden"
        style={{
          width: GRID_SIZE * CELL_SIZE,
          height: GRID_SIZE * CELL_SIZE,
          boxShadow: "0 0 30px rgba(34, 197, 94, 0.3), inset 0 0 20px rgba(34, 197, 94, 0.1)",
        }}
        {...touchHandlers}
      >
        <canvas
          ref={canvasRef}
          width={GRID_SIZE * CELL_SIZE}
          height={GRID_SIZE * CELL_SIZE}
          className="absolute inset-0"
        />
      </div>

      {/* Mobile controls */}
      <div className="mt-4 grid grid-cols-3 gap-2 md:hidden">
        <div />
        <button
          onTouchStart={() => handleButtonTouch("UP")}
          className="w-14 h-14 bg-gradient-to-b from-green-500/40 to-green-600/30 active:from-green-400/60 active:to-green-500/50 rounded-xl flex items-center justify-center text-2xl text-white/90 transition-all shadow-lg shadow-green-500/20 border border-green-500/30"
        >
          ↑
        </button>
        <div />
        <button
          onTouchStart={() => handleButtonTouch("LEFT")}
          className="w-14 h-14 bg-gradient-to-b from-green-500/40 to-green-600/30 active:from-green-400/60 active:to-green-500/50 rounded-xl flex items-center justify-center text-2xl text-white/90 transition-all shadow-lg shadow-green-500/20 border border-green-500/30"
        >
          ←
        </button>
        <button
          onTouchStart={() => handleButtonTouch("DOWN")}
          className="w-14 h-14 bg-gradient-to-b from-green-500/40 to-green-600/30 active:from-green-400/60 active:to-green-500/50 rounded-xl flex items-center justify-center text-2xl text-white/90 transition-all shadow-lg shadow-green-500/20 border border-green-500/30"
        >
          ↓
        </button>
        <button
          onTouchStart={() => handleButtonTouch("RIGHT")}
          className="w-14 h-14 bg-gradient-to-b from-green-500/40 to-green-600/30 active:from-green-400/60 active:to-green-500/50 rounded-xl flex items-center justify-center text-2xl text-white/90 transition-all shadow-lg shadow-green-500/20 border border-green-500/30"
        >
          →
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-4 hidden md:block">
        Use arrow keys or WASD to move
      </p>
    </div>
  );
};

export default SnakeGame;
