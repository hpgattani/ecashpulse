import { useState, useEffect, useCallback, useRef } from "react";

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
  const gameLoopRef = useRef<number | null>(null);
  const enemyIdRef = useRef(0);
  const lastShotRef = useRef(0);

  const resetGame = useCallback(() => {
    setPlayerX(GAME_WIDTH / 2);
    setBullets([]);
    setEnemies([]);
    setScore(0);
    setGameOver(false);
    enemyIdRef.current = 0;
  }, []);

  useEffect(() => {
    if (isPlaying && !gameOver) {
      resetGame();
    }
  }, [isPlaying]);

  const shoot = useCallback(() => {
    const now = Date.now();
    if (now - lastShotRef.current < 200) return; // Rate limit
    lastShotRef.current = now;
    
    setBullets((prev) => [...prev, { x: playerX, y: GAME_HEIGHT - 60 }]);
  }, [playerX]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOver) return;

      if (e.key === "ArrowLeft" || e.key === "a") {
        setPlayerX((x) => Math.max(PLAYER_SIZE / 2, x - 20));
      } else if (e.key === "ArrowRight" || e.key === "d") {
        setPlayerX((x) => Math.min(GAME_WIDTH - PLAYER_SIZE / 2, x + 20));
      } else if (e.key === " " || e.key === "ArrowUp") {
        shoot();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, gameOver, shoot]);

  useEffect(() => {
    if (!isPlaying || gameOver) return;

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
        const hitEnemyIds = new Set<number>();

        prevBullets.forEach((bullet) => {
          let hit = false;
          setEnemies((prevEnemies) => {
            return prevEnemies.filter((enemy) => {
              const dx = Math.abs(bullet.x - enemy.x);
              const dy = Math.abs(bullet.y - enemy.y);
              if (dx < (BULLET_SIZE + ENEMY_SIZE) / 2 && dy < (BULLET_SIZE + ENEMY_SIZE) / 2) {
                hit = true;
                hitEnemyIds.add(enemy.id);
                setScore((s) => s + 10);
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
  }, [isPlaying, gameOver, score, onGameEnd]);

  const handleTouch = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    
    if (x < GAME_WIDTH / 2) {
      setPlayerX((px) => Math.max(PLAYER_SIZE / 2, px - 20));
    } else {
      setPlayerX((px) => Math.min(GAME_WIDTH - PLAYER_SIZE / 2, px + 20));
    }
    shoot();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-900 p-4">
      <div className="text-white text-xl mb-4 font-bold">Score: {score}</div>

      <div
        className="relative border-2 border-primary overflow-hidden"
        style={{
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
          background: "linear-gradient(to bottom, #0f0c29, #302b63, #24243e)",
        }}
        onTouchStart={handleTouch}
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
            className="absolute bg-yellow-400 rounded-full"
            style={{
              left: bullet.x - BULLET_SIZE / 2,
              top: bullet.y,
              width: BULLET_SIZE,
              height: BULLET_SIZE * 2,
              boxShadow: "0 0 10px #fbbf24",
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
          onTouchStart={() => setPlayerX((x) => Math.max(PLAYER_SIZE / 2, x - 25))}
          className="w-16 h-16 bg-primary/80 rounded-xl text-2xl"
        >
          ←
        </button>
        <button
          onTouchStart={shoot}
          className="w-16 h-16 bg-red-500/80 rounded-xl text-2xl"
        >
          🔥
        </button>
        <button
          onTouchStart={() => setPlayerX((x) => Math.min(GAME_WIDTH - PLAYER_SIZE / 2, x + 25))}
          className="w-16 h-16 bg-primary/80 rounded-xl text-2xl"
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