import { useState, useEffect, useCallback, useRef } from "react";
import { useHaptic } from "@/hooks/useHaptic";
import useGameSounds from "@/hooks/useGameSounds";

interface SpaceShooterGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

type Bullet = { id: number; x: number; y: number };
type Enemy = { id: number; x: number; y: number; type: number };
type Star = { x: number; y: number; size: number; speed: number };
type Explosion = { id: number; x: number; y: number; particles: ExplosionParticle[] };
type ExplosionParticle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

const GAME_WIDTH = 300;
const GAME_HEIGHT = 400;

const SpaceShooterGame = ({ onGameEnd, isPlaying }: SpaceShooterGameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const playerXRef = useRef(GAME_WIDTH / 2);
  const playerYRef = useRef(GAME_HEIGHT - 50);
  const bulletsRef = useRef<Bullet[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const starsRef = useRef<Star[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  
  const gameLoopRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const enemyIdRef = useRef(0);
  const bulletIdRef = useRef(0);
  const explosionIdRef = useRef(0);
  const lastShotRef = useRef(0);
  const scoreRef = useRef(0);
  const gameOverRef = useRef(false);
  const keysRef = useRef<Set<string>>(new Set());
  
  const haptic = useHaptic();
  const { play } = useGameSounds();

  // Initialize stars
  const initStars = useCallback(() => {
    const stars: Star[] = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 2 + 1,
      });
    }
    starsRef.current = stars;
  }, []);

  const resetGame = useCallback(() => {
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    
    playerXRef.current = GAME_WIDTH / 2;
    playerYRef.current = GAME_HEIGHT - 50;
    bulletsRef.current = [];
    enemiesRef.current = [];
    explosionsRef.current = [];
    initStars();
    
    setScore(0);
    scoreRef.current = 0;
    setGameOver(false);
    gameOverRef.current = false;
    setGameStarted(true);
    enemyIdRef.current = 0;
    bulletIdRef.current = 0;
    explosionIdRef.current = 0;
  }, [initStars]);

  useEffect(() => {
    if (isPlaying) resetGame();
    else {
      setGameStarted(false);
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    }
  }, [isPlaying, resetGame]);

  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const createExplosion = useCallback((x: number, y: number) => {
    const particles: ExplosionParticle[] = [];
    const colors = ['#fbbf24', '#f59e0b', '#ef4444', '#ffffff', '#fcd34d'];
    
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 / 12) * i + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      particles.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 3,
      });
    }
    
    explosionsRef.current.push({
      id: explosionIdRef.current++,
      x, y,
      particles
    });
  }, []);

  const shoot = useCallback(() => {
    if (!gameStarted || gameOverRef.current) return;
    const now = Date.now();
    if (now - lastShotRef.current < 120) return;
    lastShotRef.current = now;

    bulletsRef.current.push(
      { id: bulletIdRef.current++, x: playerXRef.current - 8, y: playerYRef.current - 15 },
      { id: bulletIdRef.current++, x: playerXRef.current + 8, y: playerYRef.current - 15 }
    );
    
    haptic.light();
    play("shoot");
  }, [haptic, play, gameStarted]);

  // Keyboard controls - WASD + Arrows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        shoot();
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [shoot]);

  // Render loop
  useEffect(() => {
    if (!isPlaying || !gameStarted) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      if (gameOverRef.current) return;
      
      // Clear
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      // Draw nebula gradient
      const nebula = ctx.createRadialGradient(50, 80, 0, 50, 80, 100);
      nebula.addColorStop(0, 'rgba(139, 92, 246, 0.15)');
      nebula.addColorStop(1, 'transparent');
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      const nebula2 = ctx.createRadialGradient(250, 300, 0, 250, 300, 80);
      nebula2.addColorStop(0, 'rgba(6, 182, 212, 0.1)');
      nebula2.addColorStop(1, 'transparent');
      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      
      // Update & draw stars
      starsRef.current.forEach(star => {
        star.y += star.speed;
        if (star.y > GAME_HEIGHT) {
          star.y = 0;
          star.x = Math.random() * GAME_WIDTH;
        }
        
        ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + star.size / 3})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
      
      // Process keyboard input
      if (keysRef.current.has('a') || keysRef.current.has('arrowleft')) {
        playerXRef.current = Math.max(20, playerXRef.current - 4);
      }
      if (keysRef.current.has('d') || keysRef.current.has('arrowright')) {
        playerXRef.current = Math.min(GAME_WIDTH - 20, playerXRef.current + 4);
      }
      if (keysRef.current.has('s') || keysRef.current.has('arrowdown')) {
        playerYRef.current = Math.min(GAME_HEIGHT - 20, playerYRef.current + 3);
      }
      if (keysRef.current.has('w') || keysRef.current.has('arrowup')) {
        playerYRef.current = Math.max(50, playerYRef.current - 3);
      }
      
      // Draw player ship
      const px = playerXRef.current;
      const py = playerYRef.current;
      
      // Engine flame
      const flameHeight = 12 + Math.sin(Date.now() / 50) * 4;
      const flameGrad = ctx.createLinearGradient(px, py + 8, px, py + 8 + flameHeight);
      flameGrad.addColorStop(0, '#fbbf24');
      flameGrad.addColorStop(0.5, '#f59e0b');
      flameGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(px - 6, py + 8);
      ctx.lineTo(px, py + 8 + flameHeight);
      ctx.lineTo(px + 6, py + 8);
      ctx.fill();
      
      // Ship body
      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.moveTo(px, py - 18);
      ctx.lineTo(px - 12, py + 10);
      ctx.lineTo(px + 12, py + 10);
      ctx.closePath();
      ctx.fill();
      
      // Ship highlight
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(px, py - 18);
      ctx.lineTo(px - 6, py + 5);
      ctx.lineTo(px + 6, py + 5);
      ctx.closePath();
      ctx.fill();
      
      // Wings
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(px - 12, py + 8);
      ctx.lineTo(px - 22, py + 12);
      ctx.lineTo(px - 10, py + 2);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(px + 12, py + 8);
      ctx.lineTo(px + 22, py + 12);
      ctx.lineTo(px + 10, py + 2);
      ctx.closePath();
      ctx.fill();
      
      // Cockpit
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(px, py - 5, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.5)';
      ctx.beginPath();
      ctx.arc(px, py - 5, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw bullets
      bulletsRef.current.forEach(bullet => {
        const bulletGrad = ctx.createLinearGradient(bullet.x, bullet.y - 8, bullet.x, bullet.y + 4);
        bulletGrad.addColorStop(0, '#fcd34d');
        bulletGrad.addColorStop(1, 'rgba(251, 191, 36, 0.3)');
        ctx.fillStyle = bulletGrad;
        ctx.beginPath();
        ctx.ellipse(bullet.x, bullet.y, 2, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      
      // Draw enemies
      enemiesRef.current.forEach(enemy => {
        const colors = ['#8b5cf6', '#22c55e', '#ef4444'];
        const color = colors[enemy.type] || colors[0];
        
        if (enemy.type === 0) {
          // UFO
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(enemy.x, enemy.y, 18, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = 'rgba(34, 211, 238, 0.7)';
          ctx.beginPath();
          ctx.arc(enemy.x, enemy.y - 4, 8, Math.PI, 0);
          ctx.fill();
        } else if (enemy.type === 1) {
          // Fighter
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(enemy.x, enemy.y + 15);
          ctx.lineTo(enemy.x - 10, enemy.y - 10);
          ctx.lineTo(enemy.x + 10, enemy.y - 10);
          ctx.closePath();
          ctx.fill();
          
          ctx.fillStyle = '#1e3a5f';
          ctx.beginPath();
          ctx.moveTo(enemy.x - 10, enemy.y - 5);
          ctx.lineTo(enemy.x - 18, enemy.y);
          ctx.lineTo(enemy.x - 8, enemy.y - 8);
          ctx.closePath();
          ctx.fill();
          
          ctx.beginPath();
          ctx.moveTo(enemy.x + 10, enemy.y - 5);
          ctx.lineTo(enemy.x + 18, enemy.y);
          ctx.lineTo(enemy.x + 8, enemy.y - 8);
          ctx.closePath();
          ctx.fill();
        } else {
          // Asteroid
          ctx.fillStyle = color;
          ctx.beginPath();
          const sides = 7;
          for (let i = 0; i < sides; i++) {
            const angle = (Math.PI * 2 / sides) * i;
            const radius = 12 + (i % 2) * 4;
            const x = enemy.x + Math.cos(angle) * radius;
            const y = enemy.y + Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
        }
      });
      
      // Draw explosions
      explosionsRef.current.forEach(exp => {
        exp.particles.forEach(p => {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(exp.x + p.x, exp.y + p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      ctx.globalAlpha = 1;
      
      animationRef.current = requestAnimationFrame(render);
    };
    
    render();
    
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, gameStarted]);

  // Game logic loop
  useEffect(() => {
    if (!isPlaying || gameOverRef.current || !gameStarted) return;

    gameLoopRef.current = window.setInterval(() => {
      if (gameOverRef.current) return;

      // Update explosions
      explosionsRef.current = explosionsRef.current.filter(exp => {
        exp.particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.03;
        });
        return exp.particles.some(p => p.life > 0);
      });

      // Move bullets up
      bulletsRef.current = bulletsRef.current
        .filter(b => b.y > 0)
        .map(b => ({ ...b, y: b.y - 12 }));

      // Move enemies down
      let hitBottom = false;
      enemiesRef.current = enemiesRef.current
        .map(e => ({ ...e, y: e.y + 2 + e.type * 0.5 }))
        .filter(e => {
          if (e.y > GAME_HEIGHT - 30) {
            hitBottom = true;
            return false;
          }
          return e.y < GAME_HEIGHT;
        });

      if (hitBottom && !gameOverRef.current) {
        gameOverRef.current = true;
        setGameOver(true);
        haptic.error();
        play("gameOver");
        onGameEnd(scoreRef.current);
        return;
      }

      // Spawn new enemies
      if (Math.random() < 0.04) {
        enemiesRef.current.push({
          id: enemyIdRef.current++,
          x: Math.random() * (GAME_WIDTH - 60) + 30,
          y: -20,
          type: Math.floor(Math.random() * 3),
        });
      }

      // Check collisions
      const remainingBullets: Bullet[] = [];
      bulletsRef.current.forEach(bullet => {
        let hit = false;
        enemiesRef.current = enemiesRef.current.filter(enemy => {
          const dx = Math.abs(bullet.x - enemy.x);
          const dy = Math.abs(bullet.y - enemy.y);
          if (dx < 20 && dy < 20) {
            hit = true;
            const pointValue = 10 + enemy.type * 5;
            scoreRef.current += pointValue;
            setScore(scoreRef.current);
            haptic.medium();
            play("hit");
            createExplosion(enemy.x, enemy.y);
            return false;
          }
          return true;
        });
        if (!hit) remainingBullets.push(bullet);
      });
      bulletsRef.current = remainingBullets;
    }, 40);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPlaying, gameStarted, onGameEnd, haptic, play, createExplosion]);

  const handleMoveLeft = useCallback(() => {
    if (!gameStarted || gameOverRef.current) return;
    playerXRef.current = Math.max(20, playerXRef.current - 30);
    haptic.light();
  }, [gameStarted, haptic]);

  const handleMoveRight = useCallback(() => {
    if (!gameStarted || gameOverRef.current) return;
    playerXRef.current = Math.min(GAME_WIDTH - 20, playerXRef.current + 30);
    haptic.light();
  }, [gameStarted, haptic]);

  const handleShoot = useCallback(() => {
    shoot();
  }, [shoot]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-3" style={{ background: "linear-gradient(180deg, #0a0a1a 0%, #1a0a2e 50%, #0f172a 100%)" }}>
      {/* Score */}
      <div className="text-xl mb-2 font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-red-400">
        Score: {score}
      </div>
      
      {/* 2D Game Canvas */}
      <div 
        className="relative rounded-lg border-2 border-purple-500/50 overflow-hidden"
        style={{
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
          boxShadow: "0 0 30px rgba(139, 92, 246, 0.3), inset 0 0 20px rgba(139, 92, 246, 0.1)",
          touchAction: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="block"
        />
        
        {/* Game Over Overlay */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
            <div className="text-5xl mb-4">💥</div>
            <div className="text-2xl font-bold text-red-500">GAME OVER</div>
          </div>
        )}
      </div>

      {/* Mobile controls */}
      <div className="flex gap-4 mt-3">
        <button
          onTouchStart={(e) => { e.preventDefault(); handleMoveLeft(); }}
          onMouseDown={handleMoveLeft}
          className="w-16 h-16 bg-gradient-to-b from-purple-500/40 to-purple-600/30 active:from-purple-400/60 active:to-purple-500/50 rounded-xl flex items-center justify-center text-3xl text-white/90 border border-purple-500/30 select-none"
          style={{ touchAction: 'manipulation' }}
        >
          ←
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); handleShoot(); }}
          onMouseDown={handleShoot}
          className="w-20 h-16 bg-gradient-to-b from-amber-500/40 to-amber-600/30 active:from-amber-400/60 active:to-amber-500/50 rounded-xl flex items-center justify-center text-2xl text-white/90 border border-amber-500/30 select-none"
          style={{ touchAction: 'manipulation' }}
        >
          🔥
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); handleMoveRight(); }}
          onMouseDown={handleMoveRight}
          className="w-16 h-16 bg-gradient-to-b from-purple-500/40 to-purple-600/30 active:from-purple-400/60 active:to-purple-500/50 rounded-xl flex items-center justify-center text-3xl text-white/90 border border-purple-500/30 select-none"
          style={{ touchAction: 'manipulation' }}
        >
          →
        </button>
      </div>
      
      {/* Desktop controls hint */}
      <div className="text-xs text-muted-foreground mt-2 text-center">
        Desktop: WASD or Arrow keys to move, Space to shoot
      </div>
    </div>
  );
};

export default SpaceShooterGame;
