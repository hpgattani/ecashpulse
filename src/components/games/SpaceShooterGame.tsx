import { useState, useEffect, useCallback, useRef } from "react";
import { useHaptic } from "@/hooks/useHaptic";
import useGameSounds from "@/hooks/useGameSounds";

interface SpaceShooterGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

type Position = { x: number; y: number };
type Bullet = Position & { id: number };
type Enemy = Position & { id: number; type: number; hp: number };
type Particle = Position & { id: number; vx: number; vy: number; life: number; color: string; size: number };
type Star = { x: number; y: number; size: number; speed: number; brightness: number };

const GAME_WIDTH = 300;
const GAME_HEIGHT = 400;
const PLAYER_SIZE = 30;
const BULLET_SIZE = 4;
const ENEMY_SIZE = 28;

const SpaceShooterGame = ({ onGameEnd, isPlaying }: SpaceShooterGameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerX, setPlayerX] = useState(GAME_WIDTH / 2);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [stars, setStars] = useState<Star[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const gameLoopRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const enemyIdRef = useRef(0);
  const bulletIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const lastShotRef = useRef(0);
  const scoreRef = useRef(0);
  const gameOverRef = useRef(false);
  const haptic = useHaptic();
  const { play } = useGameSounds();

  // Initialize stars
  useEffect(() => {
    const newStars: Star[] = [];
    for (let i = 0; i < 50; i++) {
      newStars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 2 + 0.5,
        brightness: Math.random() * 0.5 + 0.5,
      });
    }
    setStars(newStars);
  }, []);

  const spawnParticles = useCallback((x: number, y: number, count: number, color: string) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 4;
      newParticles.push({
        id: particleIdRef.current++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 25 + Math.random() * 15,
        color,
        size: 2 + Math.random() * 3,
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
    scoreRef.current = 0;
    setGameOver(false);
    gameOverRef.current = false;
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
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    }
  }, [isPlaying, resetGame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const shoot = useCallback(() => {
    if (!gameStarted || gameOverRef.current) return;
    const now = Date.now();
    if (now - lastShotRef.current < 120) return;
    lastShotRef.current = now;

    setPlayerX(currentX => {
      setBullets((prev) => [
        ...prev,
        { id: bulletIdRef.current++, x: currentX - 10, y: GAME_HEIGHT - 60 },
        { id: bulletIdRef.current++, x: currentX + 10, y: GAME_HEIGHT - 60 },
      ]);
      return currentX;
    });
    
    haptic.light();
    play("shoot");
  }, [haptic, play, gameStarted]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      // Background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      bgGradient.addColorStop(0, "#0a0a1a");
      bgGradient.addColorStop(0.5, "#1a0a2e");
      bgGradient.addColorStop(1, "#0f172a");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      // Stars parallax
      stars.forEach((star, i) => {
        const newY = (star.y + star.speed) % GAME_HEIGHT;
        stars[i].y = newY;
        
        ctx.globalAlpha = star.brightness;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Nebula effects
      ctx.fillStyle = "rgba(139, 92, 246, 0.15)";
      ctx.beginPath();
      ctx.arc(60, 100, 80, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = "rgba(6, 182, 212, 0.1)";
      ctx.beginPath();
      ctx.arc(250, 280, 60, 0, Math.PI * 2);
      ctx.fill();

      // Particles
      particles.forEach((p) => {
        ctx.globalAlpha = p.life / 40;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Enemies with glow
      enemies.forEach((enemy) => {
        const colors = ["#8b5cf6", "#22c55e", "#ef4444"];
        const color = colors[enemy.type] || colors[0];
        const emojis = ["👾", "🛸", "☄️"];
        
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.font = "28px serif";
        ctx.textAlign = "center";
        ctx.fillText(emojis[enemy.type] || emojis[0], enemy.x, enemy.y + 10);
        ctx.shadowBlur = 0;
      });

      // Bullets with trail
      bullets.forEach((bullet) => {
        // Trail
        const trailGradient = ctx.createLinearGradient(
          bullet.x, bullet.y + 20,
          bullet.x, bullet.y
        );
        trailGradient.addColorStop(0, "transparent");
        trailGradient.addColorStop(1, "#f59e0b");
        ctx.fillStyle = trailGradient;
        ctx.fillRect(bullet.x - 2, bullet.y, 4, 20);
        
        // Bullet
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 15;
        ctx.fillStyle = "#fcd34d";
        ctx.beginPath();
        ctx.ellipse(bullet.x, bullet.y, BULLET_SIZE, BULLET_SIZE * 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Player ship (real rendered rocket)
      const shipX = playerX;
      const shipY = GAME_HEIGHT - 50;

      // Engine flames (animated)
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 25;
      const flameHeight = 18 + Math.random() * 8;
      
      // Outer flame
      const flameGradient = ctx.createLinearGradient(shipX, shipY + 12, shipX, shipY + 12 + flameHeight);
      flameGradient.addColorStop(0, "#fbbf24");
      flameGradient.addColorStop(0.3, "#f97316");
      flameGradient.addColorStop(0.7, "#ef4444");
      flameGradient.addColorStop(1, "transparent");
      ctx.fillStyle = flameGradient;
      ctx.beginPath();
      ctx.moveTo(shipX - 6, shipY + 12);
      ctx.quadraticCurveTo(shipX, shipY + 12 + flameHeight, shipX + 6, shipY + 12);
      ctx.fill();
      
      // Inner flame (blue/white core)
      const innerFlameGradient = ctx.createLinearGradient(shipX, shipY + 12, shipX, shipY + 12 + flameHeight * 0.6);
      innerFlameGradient.addColorStop(0, "#fff");
      innerFlameGradient.addColorStop(0.5, "#38bdf8");
      innerFlameGradient.addColorStop(1, "transparent");
      ctx.fillStyle = innerFlameGradient;
      ctx.beginPath();
      ctx.moveTo(shipX - 3, shipY + 12);
      ctx.quadraticCurveTo(shipX, shipY + 12 + flameHeight * 0.6, shipX + 3, shipY + 12);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Ship body (sleek rocket)
      ctx.shadowColor = "#06b6d4";
      ctx.shadowBlur = 15;
      
      // Main hull
      const hullGradient = ctx.createLinearGradient(shipX - 12, shipY, shipX + 12, shipY);
      hullGradient.addColorStop(0, "#475569");
      hullGradient.addColorStop(0.3, "#94a3b8");
      hullGradient.addColorStop(0.5, "#e2e8f0");
      hullGradient.addColorStop(0.7, "#94a3b8");
      hullGradient.addColorStop(1, "#475569");
      ctx.fillStyle = hullGradient;
      ctx.beginPath();
      ctx.moveTo(shipX, shipY - 18); // Nose
      ctx.lineTo(shipX + 10, shipY + 5);
      ctx.lineTo(shipX + 8, shipY + 14);
      ctx.lineTo(shipX - 8, shipY + 14);
      ctx.lineTo(shipX - 10, shipY + 5);
      ctx.closePath();
      ctx.fill();
      
      // Cockpit window
      const cockpitGradient = ctx.createRadialGradient(shipX, shipY - 5, 0, shipX, shipY - 5, 6);
      cockpitGradient.addColorStop(0, "#67e8f9");
      cockpitGradient.addColorStop(0.5, "#06b6d4");
      cockpitGradient.addColorStop(1, "#0891b2");
      ctx.fillStyle = cockpitGradient;
      ctx.beginPath();
      ctx.ellipse(shipX, shipY - 4, 5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Cockpit shine
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.beginPath();
      ctx.ellipse(shipX - 1, shipY - 6, 2, 3, -0.3, 0, Math.PI * 2);
      ctx.fill();
      
      // Wings
      ctx.fillStyle = "#dc2626";
      // Left wing
      ctx.beginPath();
      ctx.moveTo(shipX - 8, shipY + 8);
      ctx.lineTo(shipX - 18, shipY + 16);
      ctx.lineTo(shipX - 16, shipY + 10);
      ctx.lineTo(shipX - 8, shipY + 2);
      ctx.closePath();
      ctx.fill();
      // Right wing
      ctx.beginPath();
      ctx.moveTo(shipX + 8, shipY + 8);
      ctx.lineTo(shipX + 18, shipY + 16);
      ctx.lineTo(shipX + 16, shipY + 10);
      ctx.lineTo(shipX + 8, shipY + 2);
      ctx.closePath();
      ctx.fill();
      
      // Wing accents
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(shipX - 14, shipY + 12);
      ctx.lineTo(shipX - 16, shipY + 14);
      ctx.lineTo(shipX - 12, shipY + 11);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(shipX + 14, shipY + 12);
      ctx.lineTo(shipX + 16, shipY + 14);
      ctx.lineTo(shipX + 12, shipY + 11);
      ctx.closePath();
      ctx.fill();
      
      // Nose tip (chrome)
      ctx.fillStyle = "#f1f5f9";
      ctx.beginPath();
      ctx.moveTo(shipX, shipY - 18);
      ctx.lineTo(shipX + 4, shipY - 12);
      ctx.lineTo(shipX - 4, shipY - 12);
      ctx.closePath();
      ctx.fill();
      
      // Shield ring (energy field)
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(6, 182, 212, 0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(shipX, shipY, 24, 0, Math.PI * 2);
      ctx.stroke();
      
      // Shield pulse effect
      const pulseAlpha = (Math.sin(Date.now() / 200) + 1) * 0.15;
      ctx.strokeStyle = `rgba(6, 182, 212, ${pulseAlpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(shipX, shipY, 28, 0, Math.PI * 2);
      ctx.stroke();

      // Game over overlay
      if (gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        ctx.font = "48px serif";
        ctx.textAlign = "center";
        ctx.fillText("💥", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30);
        
        ctx.font = "bold 24px sans-serif";
        ctx.fillStyle = "#ef4444";
        ctx.fillText("GAME OVER", GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [playerX, bullets, enemies, particles, stars, gameOver]);

  // Game loop
  useEffect(() => {
    if (!isPlaying || gameOverRef.current || !gameStarted) return;

    gameLoopRef.current = window.setInterval(() => {
      if (gameOverRef.current) return;

      // Update particles
      setParticles((prev) =>
        prev
          .map((p) => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 1 }))
          .filter((p) => p.life > 0)
      );

      // Move bullets up
      setBullets((prev) => prev.filter((b) => b.y > 0).map((b) => ({ ...b, y: b.y - 14 })));

      // Move enemies down
      setEnemies((prev) => {
        if (gameOverRef.current) return prev;
        
        const moved = prev.map((e) => ({ ...e, y: e.y + 2.5 + e.type * 0.5 }));

        // Check if any enemy reached bottom
        const reachedBottom = moved.some((e) => e.y > GAME_HEIGHT - 50);
        if (reachedBottom && !gameOverRef.current) {
          gameOverRef.current = true;
          setGameOver(true);
          haptic.error();
          play("gameOver");
          onGameEnd(scoreRef.current);
          return prev;
        }

        return moved.filter((e) => e.y < GAME_HEIGHT);
      });

      // Spawn new enemies
      if (Math.random() < 0.045) {
        const newEnemy: Enemy = {
          id: enemyIdRef.current++,
          x: Math.random() * (GAME_WIDTH - ENEMY_SIZE * 2) + ENEMY_SIZE,
          y: -20,
          type: Math.floor(Math.random() * 3),
          hp: 1,
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
              if (dx < (BULLET_SIZE + ENEMY_SIZE) / 2 + 5 && dy < (BULLET_SIZE + ENEMY_SIZE) / 2 + 5) {
                hit = true;
                const pointValue = 10 + enemy.type * 5;
                setScore((s) => {
                  const newScore = s + pointValue;
                  scoreRef.current = newScore;
                  return newScore;
                });
                haptic.medium();
                play("hit");
                // Spawn explosion particles
                const colors = ["#f59e0b", "#ef4444", "#f97316", "#fbbf24", "#ec4899"];
                spawnParticles(enemy.x, enemy.y, 12, colors[Math.floor(Math.random() * colors.length)]);
                return false;
              }
              return true;
            });
          });
          if (!hit) remainingBullets.push(bullet);
        });

        return remainingBullets;
      });
    }, 45);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPlaying, gameStarted, onGameEnd, haptic, play, spawnParticles]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOverRef.current || !gameStarted) return;

      if (e.key === "ArrowLeft" || e.key === "a") {
        setPlayerX((x) => Math.max(PLAYER_SIZE / 2, x - 25));
        haptic.light();
      } else if (e.key === "ArrowRight" || e.key === "d") {
        setPlayerX((x) => Math.min(GAME_WIDTH - PLAYER_SIZE / 2, x + 25));
        haptic.light();
      } else if (e.key === " " || e.key === "ArrowUp") {
        shoot();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, gameStarted, shoot, haptic]);

  const handleMoveLeft = useCallback(() => {
    if (!gameStarted || gameOverRef.current) return;
    setPlayerX((x) => Math.max(PLAYER_SIZE / 2, x - 35));
    haptic.light();
  }, [gameStarted, haptic]);

  const handleMoveRight = useCallback(() => {
    if (!gameStarted || gameOverRef.current) return;
    setPlayerX((x) => Math.min(GAME_WIDTH - PLAYER_SIZE / 2, x + 35));
    haptic.light();
  }, [gameStarted, haptic]);

  const handleShoot = useCallback(() => {
    shoot();
  }, [shoot]);

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

      {/* Game canvas */}
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        className="rounded-lg border-2 border-cyan-500/50"
        style={{
          boxShadow: "inset 0 0 60px rgba(6, 182, 212, 0.1), 0 0 30px rgba(6, 182, 212, 0.2)",
          touchAction: 'none',
        }}
      />

      {/* Mobile controls - always visible */}
      <div className="flex gap-4 mt-3">
        <button
          onTouchStart={(e) => { e.preventDefault(); handleMoveLeft(); }}
          onMouseDown={handleMoveLeft}
          className="w-16 h-16 bg-cyan-500/20 active:bg-cyan-500/50 rounded-xl text-2xl transition-colors border-2 border-cyan-500/40 flex items-center justify-center select-none"
          style={{ touchAction: 'manipulation' }}
        >
          ◀
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); handleShoot(); }}
          onMouseDown={handleShoot}
          className="w-16 h-16 bg-amber-500/20 active:bg-amber-500/50 rounded-xl text-2xl transition-colors border-2 border-amber-500/40 flex items-center justify-center select-none"
          style={{ touchAction: 'manipulation' }}
        >
          🔥
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); handleMoveRight(); }}
          onMouseDown={handleMoveRight}
          className="w-16 h-16 bg-cyan-500/20 active:bg-cyan-500/50 rounded-xl text-2xl transition-colors border-2 border-cyan-500/40 flex items-center justify-center select-none"
          style={{ touchAction: 'manipulation' }}
        >
          ▶
        </button>
      </div>

      <p className="text-xs text-cyan-400/50 mt-2 hidden md:block">← → to move | Space to shoot</p>
    </div>
  );
};

export default SpaceShooterGame;
