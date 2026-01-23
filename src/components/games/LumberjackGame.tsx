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
    if (timerRef.current) clearInterval(timerRef.current);
    const initialTree: TreeSegment[] = [];
    for (let i = 0; i < 8; i++) initialTree.push(generateSegment());
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
    if (isPlaying) resetGame();
    else {
      setGameStarted(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isPlaying, resetGame]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, gameStarted, onGameEnd, haptic, play]);

  // Canvas rendering - keeping the enhanced 2D canvas for this game as it works well
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const trunkWidth = 50;
    const segmentHeight = 36;

    const render = () => {
      // Sky gradient
      const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
      skyGradient.addColorStop(0, "#1e3a5f");
      skyGradient.addColorStop(0.5, "#2d4a6f");
      skyGradient.addColorStop(1, "#3d5a7f");
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, height);

      // Stars
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 30; i++) {
        const sx = (i * 37) % width;
        const sy = (i * 23) % (height * 0.4);
        ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 500 + i) * 0.2;
        ctx.beginPath();
        ctx.arc(sx, sy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Moon
      ctx.fillStyle = "#fef3c7";
      ctx.shadowColor = "#fef3c7";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(width - 40, 40, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Ground
      const groundY = height - 35;
      ctx.fillStyle = "#1a472a";
      ctx.fillRect(0, groundY, width, 35);

      // Tree
      const trunkX = (width - trunkWidth) / 2;
      const trunkBaseY = groundY - 25;

      tree.forEach((segment, index) => {
        const segY = trunkBaseY - (index + 1) * segmentHeight;
        const trunkGradient = ctx.createLinearGradient(trunkX, segY, trunkX + trunkWidth, segY);
        trunkGradient.addColorStop(0, "#5d4037");
        trunkGradient.addColorStop(0.5, "#795548");
        trunkGradient.addColorStop(1, "#4e342e");
        ctx.fillStyle = trunkGradient;
        ctx.fillRect(trunkX, segY, trunkWidth, segmentHeight);

        if (segment.hasBranch) {
          const branchY = segY + segmentHeight / 2;
          ctx.fillStyle = "#5d4037";
          if (segment.hasBranch === "left") {
            ctx.beginPath();
            ctx.moveTo(trunkX, branchY - 8);
            ctx.lineTo(trunkX - 50, branchY);
            ctx.lineTo(trunkX, branchY + 8);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.moveTo(trunkX + trunkWidth, branchY - 8);
            ctx.lineTo(trunkX + trunkWidth + 50, branchY);
            ctx.lineTo(trunkX + trunkWidth, branchY + 8);
            ctx.fill();
          }
        }
      });

      // Player
      const playerX = playerSide === "left" ? trunkX - 50 : trunkX + trunkWidth + 10;
      const playerY = trunkBaseY - 20;
      
      ctx.fillStyle = "#fcd9b6";
      ctx.beginPath();
      ctx.arc(playerX + 20, playerY - 5, 15, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(playerX + 5, playerY + 10, 30, 30);
      
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(playerX + 8, playerY + 40, 24, 20);

      // Axe
      const axeRot = chopAnimation ? (playerSide === "left" ? -0.6 : 0.6) : 0;
      ctx.save();
      ctx.translate(playerX + 20, playerY + 25);
      ctx.rotate(axeRot);
      ctx.fillStyle = "#8b4513";
      ctx.fillRect(-3, 0, 6, 40);
      ctx.fillStyle = "#6b7280";
      ctx.beginPath();
      ctx.moveTo(0, 35);
      ctx.lineTo(playerSide === "left" ? -20 : 20, 40);
      ctx.lineTo(playerSide === "left" ? -20 : 20, 50);
      ctx.lineTo(0, 48);
      ctx.fill();
      ctx.restore();

      // Wood chips
      setWoodChips(prev => prev.filter(chip => {
        chip.x += chip.vx;
        chip.y += chip.vy;
        chip.vy += 0.3;
        chip.life -= 0.02;
        if (chip.life > 0) {
          ctx.globalAlpha = chip.life;
          ctx.fillStyle = "#b45309";
          ctx.fillRect(chip.x - 3, chip.y - 2, 6, 4);
          ctx.globalAlpha = 1;
          return true;
        }
        return false;
      }));

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
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
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

    if (tree[0]?.hasBranch === side) {
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

    setTree((prevTree) => [...prevTree.slice(1), generateSegment()]);
    const newScore = scoreRef.current + 1;
    scoreRef.current = newScore;
    setScore(newScore);
    setTimeLeft((t) => Math.min(100, t + 3));
  }, [tree, isPlaying, gameStarted, haptic, play, onGameEnd, spawnWoodChips]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-3" style={{ background: "linear-gradient(180deg, #1e3a5f 0%, #0f172a 100%)" }}>
      <div className="flex items-center gap-4 mb-2">
        <div className="text-lg font-bold text-amber-400">Score: {score}</div>
        <div className="w-24 h-3 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all" style={{ width: `${timeLeft}%` }} />
        </div>
      </div>
      
      <canvas
        ref={canvasRef}
        width={220}
        height={350}
        className="rounded-lg border-2 border-amber-500/50"
        style={{ boxShadow: "0 0 30px rgba(245, 158, 11, 0.3)", touchAction: 'none' }}
      />

      <div className="flex gap-6 mt-4">
        <button
          onTouchStart={(e) => { e.preventDefault(); chop("left"); }}
          onMouseDown={() => chop("left")}
          className="w-20 h-20 bg-gradient-to-b from-amber-500/50 to-amber-600/40 active:from-amber-400/70 rounded-2xl flex items-center justify-center text-4xl border border-amber-500/40 select-none"
          style={{ touchAction: 'manipulation' }}
        >
          🪓
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); chop("right"); }}
          onMouseDown={() => chop("right")}
          className="w-20 h-20 bg-gradient-to-b from-amber-500/50 to-amber-600/40 active:from-amber-400/70 rounded-2xl flex items-center justify-center text-4xl border border-amber-500/40 select-none transform scale-x-[-1]"
          style={{ touchAction: 'manipulation' }}
        >
          🪓
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-2 hidden md:block">Tap left or right to chop!</p>
    </div>
  );
};

export default LumberjackGame;
