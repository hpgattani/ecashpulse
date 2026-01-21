import { useState, useEffect, useCallback, useRef } from "react";
import { useTouchSwipe, SwipeDirection } from "@/hooks/useTouchSwipe";
import { useHaptic } from "@/hooks/useHaptic";
import useGameSounds from "@/hooks/useGameSounds";

interface SpaceShooterGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

type Position = { x: number; y: number };
type Bullet = Position;
type Enemy = Position & { id: number };

const GAME_WIDTH = 300;
const GAME_HEIGHT = 400;
const PLAYER_SIZE = 30;
const BULLET_SIZE = 6;
const ENEMY_SIZE = 25;

const SpaceShooterGame = ({ onGameEnd, isPlaying }: SpaceShooterGameProps) => {
  const [playerX, setPlayerX] = useState(GAME_WIDTH / 2);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const gameLoopRef = useRef<number | null>(null);
  const enemyIdRef = useRef(0);
  const lastShotRef = useRef(0);
  const haptic = useHaptic();
  const { play } = useGameSounds();

  const resetGame = useCallback(() => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    setPlayerX(GAME_WIDTH / 2);
    setBullets([]);
    setEnemies([]);
    setScore(0);
    setGameOver(false);
    setGameStarted(true);
    enemyIdRef.current = 0;
  }, []);

  // Reset game when isPlaying changes to true
  useEffect(() => {
    if (isPlaying && !gameStarted) {
      resetGame();
    }
  }, [isPlaying, gameStarted, resetGame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, []);

  const shoot = useCallback(() => {
    const now = Date.now();
    if (now - lastShotRef.current < 200) return; // Rate limit
    lastShotRef.current = now;
    
    setBullets((prev) => [...prev, { x: playerX, y: GAME_HEIGHT - 60 }]);
    haptic.light();
    play("shoot");
  }, [playerX, haptic, play]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOver || !gameStarted) return;

      if (e.key === "ArrowLeft" || e.key === "a") {
        setPlayerX((x) => Math.max(PLAYER_SIZE / 2, x - 20));
        haptic.light();
      } else if (e.key === "ArrowRight" || e.key === "d") {
        setPlayerX((x) => Math.min(GAME_WIDTH - PLAYER_SIZE / 2, x + 20));
        haptic.light();
      } else if (e.key === " " || e.key === "ArrowUp") {
        shoot();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, gameOver, gameStarted, shoot, haptic]);

  useEffect(() => {
    if (!isPlaying || gameOver || !gameStarted) return;

    gameLoopRef.current = window.setInterval(() => {
      // Move bullets up
      setBullets((prev) => prev.filter((b) => b.y > 0).map((b) => ({ ...b, y: b.y - 10 })));

      // Move enemies down
      setEnemies((prev) => {
        const moved = prev.map((e) => ({ ...e, y: e.y + 3 }));
        
        // Check if any enemy reached bottom
        const reachedBottom = moved.some((e) => e.y > GAME_HEIGHT - 50);
        if (reachedBottom) {
          setGameOver(true);
          haptic.error();
          play("gameOver");
          onGameEnd(score);
          return prev;
        }
        
        return moved.filter((e) => e.y < GAME_HEIGHT);
      });

      // Spawn new enemies
      if (Math.random() < 0.05) {
        const newEnemy: Enemy = {
          id: enemyIdRef.current++,
          x: Math.random() * (GAME_WIDTH - ENEMY_SIZE) + ENEMY_SIZE / 2,
          y: 0,
        };
        setEnemies((prev) => [...prev, newEnemy]);
      }

      // Check collisions
      setBullets((prevBullets) => {
        const remainingBullets: Bullet[] = [];

        prevBullets.forEach((bullet) => {
          let hit = false;
          setEnemies((prevEnemies) => {
            return prevEnemies.filter((enemy) => {
              const dx = Math.abs(bullet.x - enemy.x);
              const dy = Math.abs(bullet.y - enemy.y);
              if (dx < (BULLET_SIZE + ENEMY_SIZE) / 2 && dy < (BULLET_SIZE + ENEMY_SIZE) / 2) {
                hit = true;
                setScore((s) => s + 10);
                haptic.medium();
                play("hit");
                return false;
              }
              return true;
            });
          });
          if (!hit) remainingBullets.push(bullet);
        });

        return remainingBullets;
      });
    }, 50);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPlaying, gameOver, gameStarted, score, onGameEnd, haptic, play]);

  // Touch swipe controls
  const handleSwipe = useCallback((swipeDir: SwipeDirection) => {
    if (!isPlaying || gameOver || !gameStarted) return;

    if (swipeDir === "left") {
      setPlayerX((x) => Math.max(PLAYER_SIZE / 2, x - 30));
      haptic.light();
    } else if (swipeDir === "right") {
      setPlayerX((x) => Math.min(GAME_WIDTH - PLAYER_SIZE / 2, x + 30));
      haptic.light();
    } else if (swipeDir === "up") {
      shoot();
    }
  }, [isPlaying, gameOver, gameStarted, shoot, haptic]);

  const handleTap = useCallback(() => {
    if (!isPlaying || gameOver || !gameStarted) return;
    shoot();
  }, [isPlaying, gameOver, gameStarted, shoot]);

  const touchHandlers = useTouchSwipe({
    onSwipe: handleSwipe,
    onTap: handleTap,
    threshold: 20,
  });

  const handleMoveLeft = () => {
    if (!gameStarted) return;
    setPlayerX((x) => Math.max(PLAYER_SIZE / 2, x - 30));
    haptic.light();
  };

  const handleMoveRight = () => {
    if (!gameStarted) return;
    setPlayerX((x) => Math.min(GAME_WIDTH - PLAYER_SIZE / 2, x + 30));
    haptic.light();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-900 p-4">
      <div className="text-white text-xl mb-4 font-bold">Score: {score}</div>
      
      {/* Swipe hint for mobile */}
      <p className="text-xs text-primary/70 mb-2 md:hidden">Swipe to move • Tap to shoot</p>

      <div
        className="relative border-2 border-primary overflow-hidden touch-none"
        style={{
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
          background: "linear-gradient(to bottom, #0f0c29, #302b63, #24243e)",
        }}
        {...touchHandlers}
      >
        {/* Stars background */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full opacity-50"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 23) % 100}%`,
            }}
          />
        ))}

        {/* Enemies */}
        {enemies.map((enemy) => (
          <div
            key={enemy.id}
            className="absolute text-2xl"
            style={{
              left: enemy.x - ENEMY_SIZE / 2,
              top: enemy.y,
            }}
          >
            👾
          </div>
        ))}

        {/* Bullets */}
        {bullets.map((bullet, i) => (
          <div
            key={i}
            className="absolute bg-amber-400 rounded-full"
            style={{
              left: bullet.x - BULLET_SIZE / 2,
              top: bullet.y,
              width: BULLET_SIZE,
              height: BULLET_SIZE * 2,
              boxShadow: "0 0 10px hsl(var(--primary))",
            }}
          />
        ))}

        {/* Player */}
        <div
          className="absolute text-3xl transition-all duration-50"
          style={{
            left: playerX - PLAYER_SIZE / 2,
            bottom: 20,
          }}
        >
          🚀
        </div>
      </div>

      {/* Mobile controls */}
      <div className="flex gap-4 mt-4 md:hidden">
        <button
          onTouchStart={handleMoveLeft}
          className="w-16 h-16 bg-primary/30 active:bg-primary/50 rounded-xl text-2xl transition-colors"
        >
          ←
        </button>
        <button
          onTouchStart={shoot}
          className="w-16 h-16 bg-destructive/30 active:bg-destructive/50 rounded-xl text-2xl transition-colors"
        >
          🔥
        </button>
        <button
          onTouchStart={handleMoveRight}
          className="w-16 h-16 bg-primary/30 active:bg-primary/50 rounded-xl text-2xl transition-colors"
        >
          →
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-4 hidden md:block">
        ← → to move | Space to shoot
      </p>
    </div>
  );
};

export default SpaceShooterGame;
