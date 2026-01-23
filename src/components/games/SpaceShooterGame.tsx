import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, Trail, Float } from "@react-three/drei";
import * as THREE from "three";
import { useHaptic } from "@/hooks/useHaptic";
import useGameSounds from "@/hooks/useGameSounds";

interface SpaceShooterGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

type Bullet = { id: number; x: number; y: number };
type Enemy = { id: number; x: number; y: number; type: number };
type Explosion = { id: number; x: number; y: number; progress: number };

const GAME_WIDTH = 300;
const GAME_HEIGHT = 400;

// Player Ship Component
const PlayerShip = ({ position }: { position: [number, number, number] }) => {
  const meshRef = useRef<THREE.Group>(null);
  const engineRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (engineRef.current) {
      const scale = 0.8 + Math.sin(state.clock.elapsedTime * 20) * 0.2;
      engineRef.current.scale.y = scale;
    }
  });
  
  return (
    <group ref={meshRef} position={position}>
      {/* Main body */}
      <mesh position={[0, 0.2, 0]}>
        <coneGeometry args={[0.3, 1, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Cockpit */}
      <mesh position={[0, 0.4, 0.15]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={0.5} />
      </mesh>
      
      {/* Left wing */}
      <mesh position={[-0.4, -0.1, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.5, 0.05, 0.3]} />
        <meshStandardMaterial color="#dc2626" metalness={0.6} roughness={0.3} />
      </mesh>
      
      {/* Right wing */}
      <mesh position={[0.4, -0.1, 0]} rotation={[0, 0, 0.3]}>
        <boxGeometry args={[0.5, 0.05, 0.3]} />
        <meshStandardMaterial color="#dc2626" metalness={0.6} roughness={0.3} />
      </mesh>
      
      {/* Engine flame */}
      <mesh ref={engineRef} position={[0, -0.5, 0]}>
        <coneGeometry args={[0.12, 0.4, 8]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, -0.4, 0]}>
        <coneGeometry args={[0.08, 0.3, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
      </mesh>
      
      {/* Engine glow */}
      <pointLight position={[0, -0.5, 0]} color="#f59e0b" intensity={2} distance={2} />
    </group>
  );
};

// Bullet Component
const Bullet3D = ({ position }: { position: [number, number, number] }) => {
  return (
    <Trail
      width={0.5}
      length={3}
      color="#fbbf24"
      attenuation={(t) => t * t}
    >
      <mesh position={position}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color="#fcd34d" />
      </mesh>
    </Trail>
  );
};

// Enemy Component
const Enemy3D = ({ position, type }: { position: [number, number, number]; type: number }) => {
  const meshRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 2;
      meshRef.current.position.x = position[0] + Math.sin(state.clock.elapsedTime * 3 + position[1]) * 0.1;
    }
  });
  
  const colors = [0x8b5cf6, 0x22c55e, 0xef4444];
  const color = colors[type] || colors[0];
  
  return (
    <group ref={meshRef} position={position}>
      {type === 0 && (
        <>
          {/* UFO type */}
          <mesh>
            <cylinderGeometry args={[0.4, 0.4, 0.1, 16]} />
            <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color="#22d3ee" emissive="#06b6d4" emissiveIntensity={0.3} transparent opacity={0.7} />
          </mesh>
          <pointLight position={[0, -0.2, 0]} color={color} intensity={1} distance={1.5} />
        </>
      )}
      {type === 1 && (
        <>
          {/* Alien fighter type */}
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.3, 0.6, 6]} />
            <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[-0.25, 0, 0]} rotation={[0, 0, 0.5]}>
            <boxGeometry args={[0.3, 0.05, 0.15]} />
            <meshStandardMaterial color="#1e3a5f" metalness={0.5} />
          </mesh>
          <mesh position={[0.25, 0, 0]} rotation={[0, 0, -0.5]}>
            <boxGeometry args={[0.3, 0.05, 0.15]} />
            <meshStandardMaterial color="#1e3a5f" metalness={0.5} />
          </mesh>
        </>
      )}
      {type === 2 && (
        <>
          {/* Asteroid type */}
          <mesh>
            <icosahedronGeometry args={[0.35, 0]} />
            <meshStandardMaterial color={color} metalness={0.2} roughness={0.8} />
          </mesh>
          <pointLight position={[0, 0, 0.3]} color="#ff6b6b" intensity={0.5} distance={1} />
        </>
      )}
    </group>
  );
};

// Explosion Component
const Explosion3D = ({ position, progress }: { position: [number, number, number]; progress: number }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const scale = progress * 2;
  const opacity = 1 - progress;
  
  return (
    <group position={position}>
      <mesh ref={meshRef} scale={[scale, scale, scale]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={opacity * 0.8} />
      </mesh>
      <mesh scale={[scale * 0.7, scale * 0.7, scale * 0.7]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={opacity * 0.6} />
      </mesh>
      <pointLight color="#f59e0b" intensity={10 * opacity} distance={3} />
    </group>
  );
};

// Game Scene
const GameScene = ({
  playerX,
  bullets,
  enemies,
  explosions,
  gameOver,
}: {
  playerX: number;
  bullets: Bullet[];
  enemies: Enemy[];
  explosions: Explosion[];
  gameOver: boolean;
}) => {
  const { camera } = useThree();
  
  useEffect(() => {
    camera.position.set(0, -3, 8);
    camera.lookAt(0, 2, 0);
  }, [camera]);
  
  // Convert screen coords to 3D world coords
  const screenToWorld = (x: number, y: number): [number, number, number] => {
    const worldX = ((x / GAME_WIDTH) - 0.5) * 6;
    const worldY = ((1 - y / GAME_HEIGHT) - 0.5) * 8;
    return [worldX, worldY, 0];
  };
  
  const playerPos = screenToWorld(playerX, GAME_HEIGHT - 50);
  
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[0, 5, 3]} intensity={0.5} color="#8b5cf6" />
      
      {/* Starfield background */}
      <Stars radius={50} depth={50} count={2000} factor={4} fade speed={1} />
      
      {/* Nebula effects - simple colored spheres */}
      <mesh position={[-3, 3, -10]}>
        <sphereGeometry args={[3, 32, 32]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.1} />
      </mesh>
      <mesh position={[3, -2, -12]}>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.08} />
      </mesh>
      
      {/* Player */}
      {!gameOver && (
        <Float speed={2} rotationIntensity={0.1} floatIntensity={0.2}>
          <PlayerShip position={playerPos} />
        </Float>
      )}
      
      {/* Bullets */}
      {bullets.map((bullet) => {
        const pos = screenToWorld(bullet.x, bullet.y);
        return <Bullet3D key={bullet.id} position={pos} />;
      })}
      
      {/* Enemies */}
      {enemies.map((enemy) => {
        const pos = screenToWorld(enemy.x, enemy.y);
        return <Enemy3D key={enemy.id} position={pos} type={enemy.type} />;
      })}
      
      {/* Explosions */}
      {explosions.map((exp) => {
        const pos = screenToWorld(exp.x, exp.y);
        return <Explosion3D key={exp.id} position={pos} progress={exp.progress} />;
      })}
    </>
  );
};

const SpaceShooterGame = ({ onGameEnd, isPlaying }: SpaceShooterGameProps) => {
  const [playerX, setPlayerX] = useState(GAME_WIDTH / 2);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  
  const gameLoopRef = useRef<number | null>(null);
  const enemyIdRef = useRef(0);
  const bulletIdRef = useRef(0);
  const explosionIdRef = useRef(0);
  const lastShotRef = useRef(0);
  const scoreRef = useRef(0);
  const gameOverRef = useRef(false);
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
    setExplosions([]);
    setScore(0);
    scoreRef.current = 0;
    setGameOver(false);
    gameOverRef.current = false;
    setGameStarted(true);
    enemyIdRef.current = 0;
    bulletIdRef.current = 0;
    explosionIdRef.current = 0;
  }, []);

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

  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
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

  // Game loop
  useEffect(() => {
    if (!isPlaying || gameOverRef.current || !gameStarted) return;

    gameLoopRef.current = window.setInterval(() => {
      if (gameOverRef.current) return;

      // Update explosions
      setExplosions((prev) =>
        prev
          .map((e) => ({ ...e, progress: e.progress + 0.08 }))
          .filter((e) => e.progress < 1)
      );

      // Move bullets up
      setBullets((prev) => prev.filter((b) => b.y > 0).map((b) => ({ ...b, y: b.y - 14 })));

      // Move enemies down
      setEnemies((prev) => {
        if (gameOverRef.current) return prev;
        
        const moved = prev.map((e) => ({ ...e, y: e.y + 2.5 + e.type * 0.5 }));

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
          x: Math.random() * (GAME_WIDTH - 60) + 30,
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
              if (dx < 25 && dy < 25) {
                hit = true;
                const pointValue = 10 + enemy.type * 5;
                setScore((s) => {
                  const newScore = s + pointValue;
                  scoreRef.current = newScore;
                  return newScore;
                });
                haptic.medium();
                play("hit");
                // Add explosion
                setExplosions((prev) => [
                  ...prev,
                  { id: explosionIdRef.current++, x: enemy.x, y: enemy.y, progress: 0 },
                ]);
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
  }, [isPlaying, gameStarted, onGameEnd, haptic, play]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOverRef.current || !gameStarted) return;

      if (e.key === "ArrowLeft" || e.key === "a") {
        setPlayerX((x) => Math.max(30, x - 25));
        haptic.light();
      } else if (e.key === "ArrowRight" || e.key === "d") {
        setPlayerX((x) => Math.min(GAME_WIDTH - 30, x + 25));
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
    setPlayerX((x) => Math.max(30, x - 35));
    haptic.light();
  }, [gameStarted, haptic]);

  const handleMoveRight = useCallback(() => {
    if (!gameStarted || gameOverRef.current) return;
    setPlayerX((x) => Math.min(GAME_WIDTH - 30, x + 35));
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
      
      {/* 3D Game Canvas */}
      <div 
        className="rounded-lg border-2 border-purple-500/50 overflow-hidden"
        style={{
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
          boxShadow: "0 0 30px rgba(139, 92, 246, 0.3), inset 0 0 20px rgba(139, 92, 246, 0.1)",
          touchAction: 'none',
        }}
      >
        <Canvas
          camera={{ position: [0, -3, 8], fov: 60 }}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <GameScene
              playerX={playerX}
              bullets={bullets}
              enemies={enemies}
              explosions={explosions}
              gameOver={gameOver}
            />
          </Suspense>
        </Canvas>
        
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
          className="w-16 h-16 bg-gradient-to-b from-amber-500/40 to-orange-600/30 active:from-amber-400/60 active:to-orange-500/50 rounded-xl flex items-center justify-center text-2xl text-white/90 border border-amber-500/30 select-none"
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

      <p className="text-xs text-muted-foreground mt-2 hidden md:block">
        Use ← → to move | Space to shoot
      </p>
    </div>
  );
};

export default SpaceShooterGame;
