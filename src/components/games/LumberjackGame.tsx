import { useState, useEffect, useCallback, useRef } from "react";
import { useHaptic } from "@/hooks/useHaptic";
import useGameSounds from "@/hooks/useGameSounds";

interface LumberjackGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

type Side = "left" | "right";
type TreeSegment = { hasBranch: Side | null };
type WoodChip = { x: number; y: number; vx: number; vy: number; rot: number; life: number };

const LumberjackGame = ({ onGameEnd, isPlaying }: LumberjackGameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerSide, setPlayerSide] = useState<Side>("left");
  const [tree, setTree] = useState<TreeSegment[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(100);
  const [chopAnimation, setChopAnimation] = useState(false);
  const [woodChips, setWoodChips] = useState<WoodChip[]>([]);
  const timerRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const gameOverRef = useRef(false);
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
    scoreRef.current = 0;
    setTimeLeft(100);
    setGameOver(false);
    gameOverRef.current = false;
    setGameStarted(true);
    setWoodChips([]);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      resetGame();
    } else {
      setGameStarted(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isPlaying, resetGame]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Timer
  useEffect(() => {
    if (!isPlaying || gameOverRef.current || !gameStarted) return;

    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0) {
          if (!gameOverRef.current) {
            gameOverRef.current = true;
            setGameOver(true);
            haptic.error();
            play("gameOver");
            onGameEnd(scoreRef.current);
          }
          return 0;
        }
        return t - 1;
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, gameStarted, onGameEnd, haptic, play]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const trunkWidth = 50;
    const segmentHeight = 36;

    const drawCloud = (x: number, y: number, size: number) => {
      ctx.beginPath();
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      ctx.arc(x + size * 0.4, y - size * 0.1, size * 0.4, 0, Math.PI * 2);
      ctx.arc(x + size * 0.8, y, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    };

    const render = () => {
      // Sky
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
      ctx.arc(width - 35, 35, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Clouds
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      drawCloud(30, 30, 35);
      drawCloud(100, 45, 28);
      drawCloud(180, 25, 32);

      // Ground
      const groundY = height - 35;
      const groundGradient = ctx.createLinearGradient(0, groundY, 0, height);
      groundGradient.addColorStop(0, "#22c55e");
      groundGradient.addColorStop(1, "#16a34a");
      ctx.fillStyle = groundGradient;
      ctx.fillRect(0, groundY, width, 35);

      // Grass
      ctx.strokeStyle = "#15803d";
      ctx.lineWidth = 2;
      for (let i = 0; i < width; i += 10) {
        const grassHeight = 4 + Math.random() * 6;
        ctx.beginPath();
        ctx.moveTo(i, groundY);
        ctx.lineTo(i + Math.sin(Date.now() / 500 + i) * 2, groundY - grassHeight);
        ctx.stroke();
      }

      // Tree
      const trunkX = (width - trunkWidth) / 2;
      const trunkBaseY = groundY - 25;

      // Shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.beginPath();
      ctx.ellipse(width / 2 + 15, groundY + 5, 50, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tree segments
      tree.forEach((segment, index) => {
        const segY = trunkBaseY - (index + 1) * segmentHeight;
        
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
        for (let r = 0; r < 2; r++) {
          ctx.beginPath();
          ctx.moveTo(trunkX + 5, segY + 10 + r * 14);
          ctx.lineTo(trunkX + trunkWidth - 5, segY + 10 + r * 14);
          ctx.stroke();
        }

        // Branches
        if (segment.hasBranch) {
          const branchY = segY + segmentHeight / 2;
          const branchLength = 55;
          
          ctx.fillStyle = "#92400e";
          ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = 2;
          
          if (segment.hasBranch === "left") {
            ctx.beginPath();
            ctx.moveTo(trunkX, branchY - 7);
            ctx.lineTo(trunkX - branchLength, branchY - 3);
            ctx.lineTo(trunkX - branchLength, branchY + 3);
            ctx.lineTo(trunkX, branchY + 7);
            ctx.fill();
            
            // Leaves
            ctx.fillStyle = "#22c55e";
            ctx.shadowColor = "rgba(34, 197, 94, 0.4)";
            for (let i = 0; i < 4; i++) {
              const angle = (i / 4) * Math.PI * 2;
              ctx.beginPath();
              ctx.arc(
                trunkX - branchLength - 8 + Math.cos(angle) * 12,
                branchY + Math.sin(angle) * 10,
                6, 0, Math.PI * 2
              );
              ctx.fill();
            }
          } else {
            ctx.beginPath();
            ctx.moveTo(trunkX + trunkWidth, branchY - 7);
            ctx.lineTo(trunkX + trunkWidth + branchLength, branchY - 3);
            ctx.lineTo(trunkX + trunkWidth + branchLength, branchY + 3);
            ctx.lineTo(trunkX + trunkWidth, branchY + 7);
            ctx.fill();
            
            ctx.fillStyle = "#22c55e";
            ctx.shadowColor = "rgba(34, 197, 94, 0.4)";
            for (let i = 0; i < 4; i++) {
              const angle = (i / 4) * Math.PI * 2;
              ctx.beginPath();
              ctx.arc(
                trunkX + trunkWidth + branchLength + 8 + Math.cos(angle) * 12,
                branchY + Math.sin(angle) * 10,
                6, 0, Math.PI * 2
              );
              ctx.fill();
            }
          }
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
        }
      });

      // Tree top
      const topY = trunkBaseY - tree.length * segmentHeight - 25;
      ctx.fillStyle = "#22c55e";
      ctx.shadowColor = "rgba(34, 197, 94, 0.4)";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(width / 2, topY - 35);
      ctx.lineTo(width / 2 - 45, topY + 25);
      ctx.lineTo(width / 2 + 45, topY + 25);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Stump
      ctx.fillStyle = "#78350f";
      ctx.fillRect(trunkX - 4, trunkBaseY, trunkWidth + 8, 25);

      // Player (Lumberjack with face like reference image)
      const playerX = playerSide === "left" ? trunkX - 55 : trunkX + trunkWidth + 5;
      const playerY = trunkBaseY - 25;
      const flipX = playerSide === "right";
      
      ctx.save();
      if (flipX) {
        ctx.translate(playerX + 50, 0);
        ctx.scale(-1, 1);
        ctx.translate(-playerX, 0);
      }
      
      // Legs (blue jeans)
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(playerX + 8, playerY + 40, 14, 25);
      ctx.fillRect(playerX + 28, playerY + 40, 14, 25);
      
      // Body (red plaid shirt)
      ctx.fillStyle = "#dc2626";
      ctx.beginPath();
      ctx.roundRect(playerX + 5, playerY + 8, 40, 35, 6);
      ctx.fill();
      
      // Plaid pattern on shirt
      ctx.strokeStyle = "#991b1b";
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(playerX + 5, playerY + 14 + i * 8);
        ctx.lineTo(playerX + 45, playerY + 14 + i * 8);
        ctx.stroke();
      }
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(playerX + 10 + i * 8, playerY + 8);
        ctx.lineTo(playerX + 10 + i * 8, playerY + 43);
        ctx.stroke();
      }
      
      // Head (skin tone)
      ctx.fillStyle = "#fcd9b6";
      ctx.beginPath();
      ctx.arc(playerX + 25, playerY - 5, 18, 0, Math.PI * 2);
      ctx.fill();
      
      // Hat (dark cap/beanie)
      ctx.fillStyle = "#1e3a5f";
      ctx.beginPath();
      ctx.ellipse(playerX + 25, playerY - 18, 20, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(playerX + 25, playerY - 12, 16, Math.PI, 0);
      ctx.fill();
      
      // Face features
      // Eyes
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(playerX + 19, playerY - 6, 2.5, 0, Math.PI * 2);
      ctx.arc(playerX + 31, playerY - 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Eye whites
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(playerX + 18, playerY - 7, 1, 0, Math.PI * 2);
      ctx.arc(playerX + 30, playerY - 7, 1, 0, Math.PI * 2);
      ctx.fill();
      
      // Nose
      ctx.fillStyle = "#e5b99a";
      ctx.beginPath();
      ctx.ellipse(playerX + 25, playerY, 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Big bushy beard (black/dark brown)
      ctx.fillStyle = "#2d1810";
      ctx.beginPath();
      ctx.moveTo(playerX + 10, playerY);
      ctx.quadraticCurveTo(playerX + 5, playerY + 5, playerX + 8, playerY + 18);
      ctx.quadraticCurveTo(playerX + 25, playerY + 25, playerX + 42, playerY + 18);
      ctx.quadraticCurveTo(playerX + 45, playerY + 5, playerX + 40, playerY);
      ctx.quadraticCurveTo(playerX + 25, playerY + 5, playerX + 10, playerY);
      ctx.fill();
      
      // Mustache
      ctx.beginPath();
      ctx.moveTo(playerX + 15, playerY + 2);
      ctx.quadraticCurveTo(playerX + 25, playerY + 6, playerX + 35, playerY + 2);
      ctx.quadraticCurveTo(playerX + 25, playerY + 10, playerX + 15, playerY + 2);
      ctx.fill();
      
      ctx.restore();
      
      // Arms and Axe
      const axeRotation = chopAnimation ? (playerSide === "left" ? -0.8 : 0.8) : 0;
      ctx.save();
      
      const armX = playerSide === "left" ? playerX + 42 : playerX + 8;
      ctx.translate(armX, playerY + 20);
      ctx.rotate(axeRotation + (playerSide === "left" ? -0.4 : 0.4));
      
      // Arm (shirt sleeve)
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(-5, -5, 12, 20);
      
      // Hand
      ctx.fillStyle = "#fcd9b6";
      ctx.beginPath();
      ctx.arc(1, 18, 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Axe handle (wood)
      ctx.fillStyle = "#8b4513";
      ctx.fillRect(-3, 12, 8, 45);
      
      // Axe head (metal)
      const axeHeadDir = playerSide === "left" ? -1 : 1;
      ctx.fillStyle = "#6b7280";
      ctx.beginPath();
      ctx.moveTo(0, 50);
      ctx.lineTo(axeHeadDir * 25, 45);
      ctx.lineTo(axeHeadDir * 25, 60);
      ctx.lineTo(0, 58);
      ctx.fill();
      
      // Axe blade shine
      ctx.fillStyle = "#9ca3af";
      ctx.beginPath();
      ctx.moveTo(axeHeadDir * 5, 52);
      ctx.lineTo(axeHeadDir * 20, 48);
      ctx.lineTo(axeHeadDir * 20, 52);
      ctx.lineTo(axeHeadDir * 5, 55);
      ctx.fill();
      
      ctx.restore();

      // Wood chips
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

      // Game over
      if (gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(0, 0, width, height);
        
        ctx.font = "bold 20px sans-serif";
        ctx.fillStyle = "#ef4444";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", width / 2, height / 2);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [tree, playerSide, chopAnimation, gameOver]);

  const spawnWoodChips = useCallback((side: Side) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const centerX = canvas.width / 2;
    const chips: WoodChip[] = [];
    
    for (let i = 0; i < 8; i++) {
      chips.push({
        x: centerX + (side === "left" ? -25 : 25),
        y: canvas.height - 90,
        vx: (side === "left" ? -1 : 1) * (2 + Math.random() * 4),
        vy: -3 - Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        life: 1,
      });
    }
    
    setWoodChips(prev => [...prev, ...chips]);
  }, []);

  const chop = useCallback((side: Side) => {
    if (gameOverRef.current || !isPlaying || !gameStarted) return;

    setPlayerSide(side);
    setChopAnimation(true);
    setTimeout(() => setChopAnimation(false), 100);

    const bottomSegment = tree[0];
    if (bottomSegment?.hasBranch === side) {
      gameOverRef.current = true;
      setGameOver(true);
      haptic.error();
      play("gameOver");
      onGameEnd(scoreRef.current);
      return;
    }

    haptic.medium();
    play("chop");
    spawnWoodChips(side);

    setTree((prevTree) => {
      const newTree = [...prevTree.slice(1), generateSegment()];
      return newTree;
    });

    const newScore = scoreRef.current + 1;
    scoreRef.current = newScore;
    setScore(newScore);
    setTimeLeft((t) => Math.min(t + 5, 100));
  }, [tree, isPlaying, gameStarted, onGameEnd, haptic, play, spawnWoodChips]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOverRef.current || !gameStarted) return;

      if (e.key === "ArrowLeft" || e.key === "a") {
        chop("left");
      } else if (e.key === "ArrowRight" || e.key === "d") {
        chop("right");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, gameStarted, chop]);

  const handleChopLeft = useCallback(() => {
    chop("left");
  }, [chop]);

  const handleChopRight = useCallback(() => {
    chop("right");
  }, [chop]);

  return (
    <div 
      className="flex flex-col items-center justify-center h-full p-3"
      style={{ background: "linear-gradient(180deg, #87ceeb 0%, #bae6fd 100%)" }}
    >
      {/* Timer bar */}
      <div className="w-44 h-4 bg-gray-800/50 rounded-full mb-2 overflow-hidden border-2 border-white/20" style={{ boxShadow: "0 0 15px rgba(0,0,0,0.3)" }}>
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
              ? "0 0 12px rgba(34, 197, 94, 0.7)" 
              : timeLeft > 15 
                ? "0 0 12px rgba(234, 179, 8, 0.7)" 
                : "0 0 12px rgba(239, 68, 68, 0.7)",
          }}
        />
      </div>

      {/* Score */}
      <div className="text-xl mb-2 font-bold text-amber-900" style={{ textShadow: "2px 2px 0 rgba(255,255,255,0.5)" }}>
        Score: {score}
      </div>

      {/* Game canvas */}
      <canvas
        ref={canvasRef}
        width={260}
        height={320}
        className="rounded-xl border-4 border-amber-900/30"
        style={{ boxShadow: "0 8px 30px rgba(0, 0, 0, 0.3)", touchAction: 'none' }}
      />

      {/* Controls */}
      <div className="flex gap-6 mt-3">
        <button
          onTouchStart={(e) => { e.preventDefault(); handleChopLeft(); }}
          onMouseDown={handleChopLeft}
          className="w-20 h-20 bg-gradient-to-b from-amber-500 to-amber-600 active:from-amber-400 active:to-amber-500 rounded-2xl text-3xl text-white font-bold active:scale-95 transition-all border-4 border-amber-700/50 select-none"
          style={{ boxShadow: "0 5px 0 #b45309, 0 6px 15px rgba(180, 83, 9, 0.4)", touchAction: 'manipulation' }}
        >
          ←
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); handleChopRight(); }}
          onMouseDown={handleChopRight}
          className="w-20 h-20 bg-gradient-to-b from-amber-500 to-amber-600 active:from-amber-400 active:to-amber-500 rounded-2xl text-3xl text-white font-bold active:scale-95 transition-all border-4 border-amber-700/50 select-none"
          style={{ boxShadow: "0 5px 0 #b45309, 0 6px 15px rgba(180, 83, 9, 0.4)", touchAction: 'manipulation' }}
        >
          →
        </button>
      </div>

      <p className="text-xs text-amber-800/80 mt-2">
        Tap buttons or use ← → keys. Avoid branches!
      </p>
    </div>
  );
};

export default LumberjackGame;
