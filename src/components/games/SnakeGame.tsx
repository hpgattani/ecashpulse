import { useState, useEffect, useCallback, useRef } from "react";
import { Application, Graphics, Container, Text, TextStyle } from "pixi.js";
import { useHaptic } from "@/hooks/useHaptic";
import useGameSounds from "@/hooks/useGameSounds";

interface SnakeGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

const GRID_SIZE = 15;
const CELL_SIZE = 20;
const INITIAL_SPEED = 140;
const GAME_WIDTH = GRID_SIZE * CELL_SIZE;
const GAME_HEIGHT = GRID_SIZE * CELL_SIZE;

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Position = { x: number; y: number };

const SnakeGame = ({ onGameEnd, isPlaying }: SnakeGameProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const snakeRef = useRef<Position[]>([{ x: 7, y: 7 }]);
  const foodRef = useRef<Position>({ x: 12, y: 7 });
  const directionRef = useRef<Direction>("RIGHT");
  const scoreRef = useRef(0);
  const gameOverRef = useRef(false);
  const gameStartedRef = useRef(false);
  const gameLoopRef = useRef<number | null>(null);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; life: number; color: number }[]>([]);
  
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [direction, setDirection] = useState<Direction>("RIGHT");
  
  const haptic = useHaptic();
  const { play } = useGameSounds();

  const generateFood = useCallback((): Position => {
    return {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  }, []);

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current) return;
    
    let mounted = true;
    
    const initPixi = async () => {
      if (!mounted || !containerRef.current) return;
      
      const app = new Application();
      await app.init({
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: 0x0a0a1a,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      
      if (!mounted || !containerRef.current) {
        app.destroy(true);
        return;
      }
      
      containerRef.current.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;
      
      // Create game layers
      const gridLayer = new Container();
      const particleLayer = new Container();
      const gameLayer = new Container();
      const uiLayer = new Container();
      
      gridLayer.label = 'grid';
      particleLayer.label = 'particles';
      gameLayer.label = 'game';
      uiLayer.label = 'ui';
      
      app.stage.addChild(gridLayer, particleLayer, gameLayer, uiLayer);
      
      // Draw grid
      const gridGraphics = new Graphics();
      gridGraphics.setStrokeStyle({ width: 0.5, color: 0x3b82f6, alpha: 0.1 });
      for (let i = 0; i <= GRID_SIZE; i++) {
        gridGraphics.moveTo(i * CELL_SIZE, 0);
        gridGraphics.lineTo(i * CELL_SIZE, GAME_HEIGHT);
        gridGraphics.stroke();
        gridGraphics.moveTo(0, i * CELL_SIZE);
        gridGraphics.lineTo(GAME_WIDTH, i * CELL_SIZE);
        gridGraphics.stroke();
      }
      gridLayer.addChild(gridGraphics);
      
      // Game loop ticker
      app.ticker.add(() => {
        if (!gameStartedRef.current) return;
        
        // Clear and redraw game layer
        gameLayer.removeChildren();
        
        const snake = snakeRef.current;
        const food = foodRef.current;
        
        // Draw snake segments with neon glow effect
        snake.forEach((segment, index) => {
          const isHead = index === 0;
          const graphics = new Graphics();
          const x = segment.x * CELL_SIZE + 1;
          const y = segment.y * CELL_SIZE + 1;
          const size = CELL_SIZE - 2;
          
          // Glow effect (multiple layers)
          if (isHead) {
            graphics.circle(x + size/2, y + size/2, size * 0.8);
            graphics.fill({ color: 0x22c55e, alpha: 0.15 });
            graphics.circle(x + size/2, y + size/2, size * 0.6);
            graphics.fill({ color: 0x22c55e, alpha: 0.2 });
          }
          
          // Main segment
          const alpha = 1 - (index / snake.length) * 0.4;
          graphics.roundRect(x, y, size, size, isHead ? 6 : 4);
          graphics.fill({ color: isHead ? 0x4ade80 : 0x22c55e, alpha });
          
          // Highlight
          graphics.roundRect(x + 2, y + 2, size - 8, size / 3, 2);
          graphics.fill({ color: 0xffffff, alpha: 0.3 });
          
          // Eyes for head
          if (isHead) {
            const eyePositions = {
              UP: [{ x: x + 5, y: y + 5 }, { x: x + 12, y: y + 5 }],
              DOWN: [{ x: x + 5, y: y + 12 }, { x: x + 12, y: y + 12 }],
              LEFT: [{ x: x + 5, y: y + 5 }, { x: x + 5, y: y + 12 }],
              RIGHT: [{ x: x + 12, y: y + 5 }, { x: x + 12, y: y + 12 }],
            };
            const eyes = eyePositions[directionRef.current];
            eyes.forEach(eye => {
              graphics.circle(eye.x, eye.y, 2.5);
              graphics.fill({ color: 0xffffff });
              graphics.circle(eye.x, eye.y - 0.5, 1);
              graphics.fill({ color: 0x000000 });
            });
          }
          
          gameLayer.addChild(graphics);
        });
        
        // Draw food with pulsing glow
        const foodGraphics = new Graphics();
        const foodX = food.x * CELL_SIZE + CELL_SIZE / 2;
        const foodY = food.y * CELL_SIZE + CELL_SIZE / 2;
        const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
        
        // Outer glow
        foodGraphics.circle(foodX, foodY, (CELL_SIZE - 2) / 2 + 6);
        foodGraphics.fill({ color: 0xef4444, alpha: 0.15 * pulse });
        foodGraphics.circle(foodX, foodY, (CELL_SIZE - 2) / 2 + 3);
        foodGraphics.fill({ color: 0xef4444, alpha: 0.25 * pulse });
        
        // Main food
        foodGraphics.circle(foodX, foodY, (CELL_SIZE - 4) / 2);
        foodGraphics.fill({ color: 0xef4444 });
        
        // Highlight
        foodGraphics.circle(foodX - 2, foodY - 2, 3);
        foodGraphics.fill({ color: 0xffffff, alpha: 0.5 });
        
        gameLayer.addChild(foodGraphics);
        
        // Update and draw particles
        particleLayer.removeChildren();
        particlesRef.current = particlesRef.current.filter(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.03;
          p.vy += 0.1;
          
          if (p.life > 0) {
            const particleGraphics = new Graphics();
            particleGraphics.circle(p.x, p.y, 3 * p.life);
            particleGraphics.fill({ color: p.color, alpha: p.life });
            particleLayer.addChild(particleGraphics);
            return true;
          }
          return false;
        });
        
        // Game over overlay
        if (gameOverRef.current) {
          uiLayer.removeChildren();
          const overlay = new Graphics();
          overlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
          overlay.fill({ color: 0x000000, alpha: 0.7 });
          uiLayer.addChild(overlay);
          
          const gameOverText = new Text({
            text: 'GAME OVER',
            style: new TextStyle({
              fontSize: 20,
              fontWeight: 'bold',
              fill: 0xef4444,
            }),
          });
          gameOverText.anchor.set(0.5);
          gameOverText.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2);
          uiLayer.addChild(gameOverText);
        }
      });
    };
    
    initPixi();
    
    return () => {
      mounted = false;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, []);

  const spawnParticles = useCallback((x: number, y: number) => {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const colors = [0x4ade80, 0x22c55e, 0xfbbf24, 0xf59e0b];
      particlesRef.current.push({
        x: x * CELL_SIZE + CELL_SIZE / 2,
        y: y * CELL_SIZE + CELL_SIZE / 2,
        vx: Math.cos(angle) * (2 + Math.random() * 2),
        vy: Math.sin(angle) * (2 + Math.random() * 2),
        life: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }, []);

  const resetGame = useCallback(() => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    
    const centerX = Math.floor(GRID_SIZE / 2);
    const centerY = Math.floor(GRID_SIZE / 2);
    snakeRef.current = [
      { x: centerX, y: centerY },
      { x: centerX - 1, y: centerY },
      { x: centerX - 2, y: centerY },
    ];
    
    let newFood: Position;
    do {
      newFood = generateFood();
    } while (Math.abs(newFood.x - centerX) < 3 && Math.abs(newFood.y - centerY) < 3);
    foodRef.current = newFood;
    
    directionRef.current = "RIGHT";
    setDirection("RIGHT");
    scoreRef.current = 0;
    setScore(0);
    gameOverRef.current = false;
    setGameOver(false);
    gameStartedRef.current = true;
    particlesRef.current = [];
    
    // Clear UI layer
    if (appRef.current) {
      const uiLayer = appRef.current.stage.children.find(c => c.label === 'ui');
      if (uiLayer) uiLayer.removeChildren();
    }
  }, [generateFood]);

  useEffect(() => {
    if (isPlaying) {
      resetGame();
    } else {
      gameStartedRef.current = false;
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    }
  }, [isPlaying, resetGame]);

  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, []);

  // Game logic loop
  useEffect(() => {
    if (!isPlaying || gameOverRef.current || !gameStartedRef.current) return;

    const moveSnake = () => {
      if (gameOverRef.current) return;

      const head = { ...snakeRef.current[0] };

      switch (directionRef.current) {
        case "UP": head.y -= 1; break;
        case "DOWN": head.y += 1; break;
        case "LEFT": head.x -= 1; break;
        case "RIGHT": head.x += 1; break;
      }

      // Wall collision
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        gameOverRef.current = true;
        setGameOver(true);
        haptic.error();
        play("gameOver");
        onGameEnd(scoreRef.current);
        return;
      }

      // Self collision
      if (snakeRef.current.some((segment) => segment.x === head.x && segment.y === head.y)) {
        gameOverRef.current = true;
        setGameOver(true);
        haptic.error();
        play("gameOver");
        onGameEnd(scoreRef.current);
        return;
      }

      const newSnake = [head, ...snakeRef.current];

      // Food collision
      if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
        const newScore = scoreRef.current + 10;
        scoreRef.current = newScore;
        setScore(newScore);
        spawnParticles(foodRef.current.x, foodRef.current.y);
        foodRef.current = generateFood();
        haptic.success();
        play("eat");
      } else {
        newSnake.pop();
      }

      snakeRef.current = newSnake;
    };

    const speed = Math.max(60, INITIAL_SPEED - Math.min(scoreRef.current, 80));
    gameLoopRef.current = window.setInterval(moveSnake, speed);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPlaying, onGameEnd, generateFood, haptic, play, spawnParticles, score]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOverRef.current || !gameStartedRef.current) return;

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
  }, [isPlaying, haptic, play]);

  const handleButtonTouch = useCallback((newDirection: Direction) => {
    if (!isPlaying || gameOverRef.current || !gameStartedRef.current) return;
    
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
  }, [isPlaying, haptic, play]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-3" style={{ background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)" }}>
      {/* Score */}
      <div className="text-xl mb-2 font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">
        Score: {score}
      </div>
      
      {/* PixiJS Game Container */}
      <div 
        ref={containerRef}
        className="rounded-lg border-2 border-primary/50 overflow-hidden"
        style={{
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
          boxShadow: "0 0 30px rgba(34, 197, 94, 0.3), inset 0 0 20px rgba(34, 197, 94, 0.1)",
          touchAction: 'none',
        }}
      />

      {/* Mobile controls */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div />
        <button
          onTouchStart={(e) => { e.preventDefault(); handleButtonTouch("UP"); }}
          onMouseDown={() => handleButtonTouch("UP")}
          className="w-14 h-14 bg-gradient-to-b from-green-500/40 to-green-600/30 active:from-green-400/60 active:to-green-500/50 rounded-xl flex items-center justify-center text-2xl text-white/90 border border-green-500/30 select-none"
          style={{ touchAction: 'manipulation' }}
        >
          ↑
        </button>
        <div />
        <button
          onTouchStart={(e) => { e.preventDefault(); handleButtonTouch("LEFT"); }}
          onMouseDown={() => handleButtonTouch("LEFT")}
          className="w-14 h-14 bg-gradient-to-b from-green-500/40 to-green-600/30 active:from-green-400/60 active:to-green-500/50 rounded-xl flex items-center justify-center text-2xl text-white/90 border border-green-500/30 select-none"
          style={{ touchAction: 'manipulation' }}
        >
          ←
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); handleButtonTouch("DOWN"); }}
          onMouseDown={() => handleButtonTouch("DOWN")}
          className="w-14 h-14 bg-gradient-to-b from-green-500/40 to-green-600/30 active:from-green-400/60 active:to-green-500/50 rounded-xl flex items-center justify-center text-2xl text-white/90 border border-green-500/30 select-none"
          style={{ touchAction: 'manipulation' }}
        >
          ↓
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); handleButtonTouch("RIGHT"); }}
          onMouseDown={() => handleButtonTouch("RIGHT")}
          className="w-14 h-14 bg-gradient-to-b from-green-500/40 to-green-600/30 active:from-green-400/60 active:to-green-500/50 rounded-xl flex items-center justify-center text-2xl text-white/90 border border-green-500/30 select-none"
          style={{ touchAction: 'manipulation' }}
        >
          →
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-2 hidden md:block">
        Use arrow keys or WASD to move
      </p>
    </div>
  );
};

export default SnakeGame;
