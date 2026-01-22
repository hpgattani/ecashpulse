import { useState, useEffect, useCallback, useRef } from "react";
import { useTouchSwipe, SwipeDirection } from "@/hooks/useTouchSwipe";
import { useHaptic } from "@/hooks/useHaptic";
import useGameSounds from "@/hooks/useGameSounds";

interface SpaceShooterGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

type Position = { x: number; y: number };
type Bullet = Position & { id: number };
type Enemy = Position & { id: number; type: number };
type Particle = Position & { id: number; vx: number; vy: number; life: number; color: string };

const GAME_WIDTH = 300;
const GAME_HEIGHT = 400;
const PLAYER_SIZE = 30;
const BULLET_SIZE = 4;
const ENEMY_SIZE = 28;

const SpaceShooterGame = ({ onGameEnd, isPlaying }: SpaceShooterGameProps) => {
  const [playerX, setPlayerX] = useState(GAME_WIDTH / 2);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const gameLoopRef = useRef<number | null>(null);
  const enemyIdRef = useRef(0);
  const bulletIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const lastShotRef = useRef(0);
  const haptic = useHaptic();
  const { play } = useGameSounds();

  const spawnParticles = useCallback((x: number, y: number, count: number, color: string) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      newParticles.push({
        id: particleIdRef.current++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 20 + Math.random() * 10,
        color,
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);
  }, []);

  const resetGame = useCallback(() => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    setPlayerX(GAME_WIDTH / 2);
    setBullets([]);
    setEnemies([]);
    setParticles([]);
    setScore(0);
    setGameOver(false);
    setGameStarted(true);
    enemyIdRef.current = 0;
    bulletIdRef.current = 0;
    particleIdRef.current = 0;
  }, []);

  // Reset game when isPlaying changes to true
  useEffect(() => {
    if (isPlaying) {
      resetGame();
    } else {
      setGameStarted(false);
    }
  }, [isPlaying, resetGame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, []);

  const shoot = useCallback(() => {
    if (!gameStarted || gameOver) return;
    const now = Date.now();
    if (now - lastShotRef.current < 150) return;
    lastShotRef.current = now;

    // Double shot
    setBullets((prev) => [
      ...prev,
      { id: bulletIdRef.current++, x: playerX - 8, y: GAME_HEIGHT - 60 },
      { id: bulletIdRef.current++, x: playerX + 8, y: GAME_HEIGHT - 60 },
    ]);
    haptic.light();
    play("shoot");
  }, [playerX, haptic, play, gameStarted, gameOver]);

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
      // Update particles
      setParticles((prev) =>
        prev
          .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 1 }))
          .filter((p) => p.life > 0)
      );

      // Move bullets up
      setBullets((prev) => prev.filter((b) => b.y > 0).map((b) => ({ ...b, y: b.y - 12 })));

      // Move enemies down
      setEnemies((prev) => {
        const moved = prev.map((e) => ({ ...e, y: e.y + 2.5 + e.type * 0.5 }));

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

      // Spawn new enemies with variety
      if (Math.random() < 0.04) {
        const newEnemy: Enemy = {
          id: enemyIdRef.current++,
          x: Math.random() * (GAME_WIDTH - ENEMY_SIZE) + ENEMY_SIZE / 2,
          y: -20,
          type: Math.floor(Math.random() * 3),
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
                const pointValue = 10 + enemy.type * 5;
                setScore((s) => s + pointValue);
                haptic.medium();
                play("hit");
                // Spawn explosion particles
                const colors = ["#f59e0b", "#ef4444", "#f97316", "#fbbf24"];
                spawnParticles(enemy.x, enemy.y, 8, colors[Math.floor(Math.random() * colors.length)]);
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
  }, [isPlaying, gameOver, gameStarted, score, onGameEnd, haptic, play, spawnParticles]);

  // Touch swipe controls
  const handleSwipe = useCallback(
    (swipeDir: SwipeDirection) => {
      if (!isPlaying || gameOver || !gameStarted) return;

      if (swipeDir === "left") {
        setPlayerX((x) => Math.max(PLAYER_SIZE / 2, x - 35));
        haptic.light();
      } else if (swipeDir === "right") {
        setPlayerX((x) => Math.min(GAME_WIDTH - PLAYER_SIZE / 2, x + 35));
        haptic.light();
      } else if (swipeDir === "up") {
        shoot();
      }
    },
    [isPlaying, gameOver, gameStarted, shoot, haptic]
  );

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
    if (!gameStarted || gameOver) return;
    setPlayerX((x) => Math.max(PLAYER_SIZE / 2, x - 35));
    haptic.light();
  };

  const handleMoveRight = () => {
    if (!gameStarted || gameOver) return;
    setPlayerX((x) => Math.min(GAME_WIDTH - PLAYER_SIZE / 2, x + 35));
    haptic.light();
  };

  const getEnemyStyle = (type: number) => {
    const styles = [
      { emoji: "👾", shadow: "0 0 15px rgba(139, 92, 246, 0.8)" },
      { emoji: "🛸", shadow: "0 0 15px rgba(34, 197, 94, 0.8)" },
      { emoji: "☄️", shadow: "0 0 15px rgba(239, 68, 68, 0.8)" },
    ];
    return styles[type] || styles[0];
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900 p-2">
      {/* HUD */}
      <div className="flex items-center justify-between w-full max-w-[300px] mb-2">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-primary/30">
          <span className="text-amber-400 text-sm">⭐</span>
          <span className="text-white font-bold text-lg">{score}</span>
        </div>
        <div className="text-xs text-primary/60 uppercase tracking-wider">Space Defense</div>
      </div>

      {/* Swipe hint for mobile */}
      <p className="text-xs text-cyan-400/70 mb-1 md:hidden">Swipe to move • Tap to shoot</p>

      {/* Game area */}
      <div
        className="relative border-2 border-cyan-500/50 rounded-lg overflow-hidden touch-none"
        style={{
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
          background: "linear-gradient(180deg, #0a0a1a 0%, #1a0a2e 50%, #0f172a 100%)",
          boxShadow: "inset 0 0 60px rgba(6, 182, 212, 0.1), 0 0 30px rgba(6, 182, 212, 0.2)",
        }}
        {...touchHandlers}
      >
        {/* Animated stars background */}
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-pulse"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 23 + i * 7) % 100}%`,
              width: i % 3 === 0 ? 2 : 1,
              height: i % 3 === 0 ? 2 : 1,
              backgroundColor: i % 5 === 0 ? "#67e8f9" : "#ffffff",
              opacity: 0.3 + (i % 4) * 0.2,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}

        {/* Nebula effects */}
        <div
          className="absolute opacity-20 pointer-events-none"
          style={{
            width: 150,
            height: 150,
            left: 20,
            top: 50,
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)",
            filter: "blur(20px)",
          }}
        />
        <div
          className="absolute opacity-20 pointer-events-none"
          style={{
            width: 100,
            height: 100,
            right: 10,
            top: 200,
            background: "radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, transparent 70%)",
            filter: "blur(15px)",
          }}
        />

        {/* Particles */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: p.x,
              top: p.y,
              width: 4,
              height: 4,
              backgroundColor: p.color,
              opacity: p.life / 30,
              boxShadow: `0 0 6px ${p.color}`,
            }}
          />
        ))}

        {/* Enemies */}
        {enemies.map((enemy) => {
          const style = getEnemyStyle(enemy.type);
          return (
            <div
              key={enemy.id}
              className="absolute text-2xl transition-transform"
              style={{
                left: enemy.x - ENEMY_SIZE / 2,
                top: enemy.y,
                filter: `drop-shadow(${style.shadow})`,
                transform: `rotate(${Math.sin(Date.now() / 200 + enemy.id) * 10}deg)`,
              }}
            >
              {style.emoji}
            </div>
          );
        })}

        {/* Bullets */}
        {bullets.map((bullet) => (
          <div
            key={bullet.id}
            className="absolute"
            style={{
              left: bullet.x - BULLET_SIZE / 2,
              top: bullet.y,
              width: BULLET_SIZE,
              height: 14,
              background: "linear-gradient(to top, #f59e0b, #fcd34d)",
              borderRadius: "2px",
              boxShadow: "0 0 10px #f59e0b, 0 0 20px #fbbf24",
            }}
          />
        ))}

        {/* Player spaceship */}
        <div
          className="absolute transition-all duration-75"
          style={{
            left: playerX - PLAYER_SIZE / 2,
            bottom: 15,
          }}
        >
          {/* Engine glow */}
          <div
            className="absolute animate-pulse"
            style={{
              width: 16,
              height: 20,
              left: 7,
              bottom: -12,
              background: "linear-gradient(to bottom, #3b82f6, #06b6d4, transparent)",
              borderRadius: "0 0 50% 50%",
              filter: "blur(3px)",
              opacity: 0.9,
            }}
          />
          {/* Ship body */}
          <div
            style={{
              fontSize: 32,
              filter: "drop-shadow(0 0 10px rgba(6, 182, 212, 0.8))",
            }}
          >
            🚀
          </div>
          {/* Shield effect */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 45,
              height: 45,
              left: -6,
              top: -5,
              border: "1px solid rgba(6, 182, 212, 0.3)",
              boxShadow: "inset 0 0 15px rgba(6, 182, 212, 0.2)",
            }}
          />
        </div>

        {/* Game over overlay */}
        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-4xl mb-2">💥</div>
              <div className="text-2xl font-bold text-red-400">GAME OVER</div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile controls */}
      <div className="flex gap-3 mt-3 md:hidden">
        <button
          onTouchStart={handleMoveLeft}
          className="w-14 h-14 bg-cyan-500/20 active:bg-cyan-500/40 rounded-xl text-xl transition-colors border border-cyan-500/30 flex items-center justify-center"
        >
          ◀
        </button>
        <button
          onTouchStart={shoot}
          className="w-14 h-14 bg-amber-500/20 active:bg-amber-500/40 rounded-xl text-xl transition-colors border border-amber-500/30 flex items-center justify-center"
        >
          🔥
        </button>
        <button
          onTouchStart={handleMoveRight}
          className="w-14 h-14 bg-cyan-500/20 active:bg-cyan-500/40 rounded-xl text-xl transition-colors border border-cyan-500/30 flex items-center justify-center"
        >
          ▶
        </button>
      </div>

      <p className="text-xs text-cyan-400/50 mt-2 hidden md:block">← → to move | Space to shoot</p>
    </div>
  );
};

export default SpaceShooterGame;
