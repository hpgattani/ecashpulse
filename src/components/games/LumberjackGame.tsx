import { useState, useEffect, useCallback, useRef } from "react";
import { useHaptic } from "@/hooks/useHaptic";
import useGameSounds from "@/hooks/useGameSounds";

interface LumberjackGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

type Side = "left" | "right";
type TreeSegment = { hasBranch: Side | null };

const LumberjackGame = ({ onGameEnd, isPlaying }: LumberjackGameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerSide, setPlayerSide] = useState<Side>("right");
  const [tree, setTree] = useState<TreeSegment[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(100);
  const [chopAnimation, setChopAnimation] = useState(false);
  const timerRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const gameOverRef = useRef(false);
  const haptic = useHaptic();
  const { play } = useGameSounds();

  const generateSegment = (): TreeSegment => {
    const rand = Math.random();
    if (rand < 0.25) return { hasBranch: "left" };
    if (rand < 0.50) return { hasBranch: "right" };
    return { hasBranch: null };
  };

  const resetGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const initialTree: TreeSegment[] = [];
    for (let i = 0; i < 10; i++) initialTree.push(generateSegment());
    initialTree[0] = { hasBranch: null };
    setTree(initialTree);
    setPlayerSide("right");
    setScore(0);
    scoreRef.current = 0;
    setTimeLeft(100);
    setGameOver(false);
    gameOverRef.current = false;
    setGameStarted(true);
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

  // Canvas rendering - Colorful cartoon style like the reference image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const trunkWidth = 60;
    const segmentHeight = 50;
    const groundY = height - 80;

    const render = () => {
      // Sky - Light blue gradient
      const skyGradient = ctx.createLinearGradient(0, 0, 0, groundY);
      skyGradient.addColorStop(0, "#87CEEB");
      skyGradient.addColorStop(0.5, "#B0E0E6");
      skyGradient.addColorStop(1, "#E0F6FF");
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, groundY);

      // Clouds
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      const drawCloud = (x: number, y: number, scale: number) => {
        ctx.beginPath();
        ctx.arc(x, y, 20 * scale, 0, Math.PI * 2);
        ctx.arc(x + 25 * scale, y - 10 * scale, 25 * scale, 0, Math.PI * 2);
        ctx.arc(x + 50 * scale, y, 20 * scale, 0, Math.PI * 2);
        ctx.arc(x + 25 * scale, y + 5 * scale, 18 * scale, 0, Math.PI * 2);
        ctx.fill();
      };
      drawCloud(30, 60, 1);
      drawCloud(width - 80, 40, 0.8);
      drawCloud(width / 2, 30, 0.6);

      // Ground - Grassy island with dirt
      // Dirt base
      ctx.fillStyle = "#8B4513";
      ctx.beginPath();
      ctx.moveTo(0, groundY + 20);
      ctx.lineTo(width, groundY + 20);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      // Green grass
      ctx.fillStyle = "#4CAF50";
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.quadraticCurveTo(width / 4, groundY - 10, width / 2, groundY);
      ctx.quadraticCurveTo(3 * width / 4, groundY + 10, width, groundY);
      ctx.lineTo(width, groundY + 30);
      ctx.lineTo(0, groundY + 30);
      ctx.closePath();
      ctx.fill();

      // Light grass highlight
      ctx.fillStyle = "#66BB6A";
      ctx.beginPath();
      ctx.moveTo(20, groundY);
      ctx.quadraticCurveTo(width / 2, groundY - 8, width - 20, groundY);
      ctx.lineTo(width - 20, groundY + 10);
      ctx.lineTo(20, groundY + 10);
      ctx.closePath();
      ctx.fill();

      // Small rocks/pebbles
      ctx.fillStyle = "#757575";
      ctx.beginPath();
      ctx.ellipse(60, groundY + 15, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(90, groundY + 18, 5, 3, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Tree trunk
      const trunkX = (width - trunkWidth) / 2;
      const trunkBaseY = groundY - 10;

      // Main trunk gradient
      const trunkGradient = ctx.createLinearGradient(trunkX, 0, trunkX + trunkWidth, 0);
      trunkGradient.addColorStop(0, "#6D4C41");
      trunkGradient.addColorStop(0.3, "#8D6E63");
      trunkGradient.addColorStop(0.7, "#A1887F");
      trunkGradient.addColorStop(1, "#6D4C41");

      // Draw tree segments with branches
      tree.forEach((segment, index) => {
        const segY = trunkBaseY - (index + 1) * segmentHeight;
        
        // Trunk segment
        ctx.fillStyle = trunkGradient;
        ctx.fillRect(trunkX, segY, trunkWidth, segmentHeight + 2);

        // Wood grain lines
        ctx.strokeStyle = "rgba(93, 64, 55, 0.3)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const lineX = trunkX + 15 + i * 15;
          ctx.beginPath();
          ctx.moveTo(lineX, segY);
          ctx.lineTo(lineX + 2, segY + segmentHeight);
          ctx.stroke();
        }

        // Branches - cartoon style with green foliage
        if (segment.hasBranch) {
          const branchY = segY + segmentHeight / 2;
          
          // Branch wood
          ctx.fillStyle = "#6D4C41";
          if (segment.hasBranch === "left") {
            // Left branch
            ctx.beginPath();
            ctx.moveTo(trunkX, branchY - 8);
            ctx.lineTo(trunkX - 60, branchY - 5);
            ctx.lineTo(trunkX - 65, branchY + 5);
            ctx.lineTo(trunkX, branchY + 10);
            ctx.closePath();
            ctx.fill();
            
            // Foliage - cartoon cloud-like leaves
            ctx.fillStyle = "#66BB6A";
            ctx.beginPath();
            ctx.arc(trunkX - 50, branchY - 15, 20, 0, Math.PI * 2);
            ctx.arc(trunkX - 70, branchY - 5, 18, 0, Math.PI * 2);
            ctx.arc(trunkX - 55, branchY + 8, 16, 0, Math.PI * 2);
            ctx.fill();
            
            // Lighter highlight on foliage
            ctx.fillStyle = "#81C784";
            ctx.beginPath();
            ctx.arc(trunkX - 50, branchY - 18, 12, 0, Math.PI * 2);
            ctx.arc(trunkX - 70, branchY - 10, 10, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Right branch
            ctx.beginPath();
            ctx.moveTo(trunkX + trunkWidth, branchY - 8);
            ctx.lineTo(trunkX + trunkWidth + 60, branchY - 5);
            ctx.lineTo(trunkX + trunkWidth + 65, branchY + 5);
            ctx.lineTo(trunkX + trunkWidth, branchY + 10);
            ctx.closePath();
            ctx.fill();
            
            // Foliage
            ctx.fillStyle = "#66BB6A";
            ctx.beginPath();
            ctx.arc(trunkX + trunkWidth + 50, branchY - 15, 20, 0, Math.PI * 2);
            ctx.arc(trunkX + trunkWidth + 70, branchY - 5, 18, 0, Math.PI * 2);
            ctx.arc(trunkX + trunkWidth + 55, branchY + 8, 16, 0, Math.PI * 2);
            ctx.fill();
            
            // Lighter highlight
            ctx.fillStyle = "#81C784";
            ctx.beginPath();
            ctx.arc(trunkX + trunkWidth + 50, branchY - 18, 12, 0, Math.PI * 2);
            ctx.arc(trunkX + trunkWidth + 70, branchY - 10, 10, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      // Stump base at ground
      ctx.fillStyle = "#5D4037";
      ctx.fillRect(trunkX - 5, trunkBaseY, trunkWidth + 10, 15);

      // Timer bar at top of tree
      const timerWidth = 80;
      const timerX = (width - timerWidth) / 2;
      const timerY = trunkBaseY - tree.length * segmentHeight - 30;
      
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.strokeStyle = "#5D4037";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(timerX - 5, timerY - 5, timerWidth + 10, 20, 8);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = timeLeft > 30 ? "#4CAF50" : timeLeft > 15 ? "#FFC107" : "#F44336";
      ctx.beginPath();
      ctx.roundRect(timerX, timerY, timerWidth * (timeLeft / 100), 10, 5);
      ctx.fill();

      // Score display
      ctx.font = "bold 28px Arial";
      ctx.fillStyle = "#5D4037";
      ctx.textAlign = "center";
      ctx.fillText(score.toString(), width / 2, timerY - 15);

      // Lumberjack character
      const playerX = playerSide === "left" ? trunkX - 55 : trunkX + trunkWidth + 10;
      const playerY = trunkBaseY - 50;
      const facingLeft = playerSide === "left";

      // Body - plaid red shirt
      ctx.fillStyle = "#D32F2F";
      ctx.beginPath();
      ctx.roundRect(playerX + 5, playerY + 25, 40, 35, 5);
      ctx.fill();
      
      // Plaid pattern
      ctx.strokeStyle = "#B71C1C";
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(playerX + 10 + i * 10, playerY + 25);
        ctx.lineTo(playerX + 10 + i * 10, playerY + 60);
        ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(playerX + 5, playerY + 35 + i * 10);
        ctx.lineTo(playerX + 45, playerY + 35 + i * 10);
        ctx.stroke();
      }

      // Blue jeans
      ctx.fillStyle = "#1976D2";
      ctx.beginPath();
      ctx.roundRect(playerX + 8, playerY + 58, 15, 25, 3);
      ctx.roundRect(playerX + 27, playerY + 58, 15, 25, 3);
      ctx.fill();

      // Black boots
      ctx.fillStyle = "#212121";
      ctx.beginPath();
      ctx.roundRect(playerX + 6, playerY + 80, 18, 10, 3);
      ctx.roundRect(playerX + 26, playerY + 80, 18, 10, 3);
      ctx.fill();

      // Head - skin color
      ctx.fillStyle = "#FFCC80";
      ctx.beginPath();
      ctx.arc(playerX + 25, playerY + 12, 18, 0, Math.PI * 2);
      ctx.fill();

      // Beard - brown
      ctx.fillStyle = "#5D4037";
      ctx.beginPath();
      ctx.arc(playerX + 25, playerY + 20, 14, 0, Math.PI, false);
      ctx.fill();

      // Eyes
      ctx.fillStyle = "#212121";
      const eyeOffsetX = facingLeft ? -4 : 4;
      ctx.beginPath();
      ctx.arc(playerX + 20 + eyeOffsetX, playerY + 8, 3, 0, Math.PI * 2);
      ctx.arc(playerX + 30 + eyeOffsetX, playerY + 8, 3, 0, Math.PI * 2);
      ctx.fill();

      // Hat - green beanie
      ctx.fillStyle = "#2E7D32";
      ctx.beginPath();
      ctx.arc(playerX + 25, playerY + 2, 16, Math.PI, 0, false);
      ctx.fill();
      ctx.fillRect(playerX + 9, playerY - 2, 32, 8);

      // Axe
      ctx.save();
      const axeX = facingLeft ? playerX - 5 : playerX + 45;
      const axeY = playerY + 40;
      const axeRotation = chopAnimation ? (facingLeft ? -0.8 : 0.8) : (facingLeft ? -0.2 : 0.2);
      
      ctx.translate(axeX, axeY);
      ctx.rotate(axeRotation);
      
      // Handle
      ctx.fillStyle = "#8D6E63";
      ctx.fillRect(-3, -5, 6, 45);
      
      // Axe head - red/gray
      ctx.fillStyle = "#757575";
      ctx.beginPath();
      if (facingLeft) {
        ctx.moveTo(-3, 35);
        ctx.lineTo(-25, 40);
        ctx.lineTo(-25, 50);
        ctx.lineTo(-3, 48);
      } else {
        ctx.moveTo(3, 35);
        ctx.lineTo(25, 40);
        ctx.lineTo(25, 50);
        ctx.lineTo(3, 48);
      }
      ctx.closePath();
      ctx.fill();
      
      // Axe blade shine
      ctx.fillStyle = "#9E9E9E";
      if (facingLeft) {
        ctx.fillRect(-20, 41, 10, 6);
      } else {
        ctx.fillRect(10, 41, 10, 6);
      }
      
      ctx.restore();

      // Game over overlay
      if (gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(0, 0, width, height);
        ctx.font = "bold 28px Arial";
        ctx.fillStyle = "#F44336";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", width / 2, height / 2 - 20);
        ctx.font = "bold 20px Arial";
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(`Score: ${score}`, width / 2, height / 2 + 15);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [tree, playerSide, chopAnimation, gameOver, score, timeLeft]);

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

    haptic.chop();
    play("chop");

    setTree((prevTree) => [...prevTree.slice(1), generateSegment()]);
    const newScore = scoreRef.current + 1;
    scoreRef.current = newScore;
    setScore(newScore);
    setTimeLeft((t) => Math.min(100, t + 3));
  }, [tree, isPlaying, gameStarted, haptic, play, onGameEnd]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-3" style={{ background: "linear-gradient(180deg, #87CEEB 0%, #E0F6FF 100%)" }}>
      <canvas
        ref={canvasRef}
        width={280}
        height={450}
        className="rounded-xl shadow-lg"
        style={{ touchAction: 'none' }}
      />

      <div className="flex gap-8 mt-4">
        <button
          onTouchStart={(e) => { e.preventDefault(); chop("left"); }}
          onMouseDown={() => chop("left")}
          className="w-24 h-24 rounded-full flex items-center justify-center select-none active:scale-95 transition-transform"
          style={{ 
            background: 'linear-gradient(180deg, #D7CCC8 0%, #A1887F 100%)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.4)',
            border: '4px solid #8D6E63',
            touchAction: 'manipulation'
          }}
        >
          <span className="text-4xl" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}>◀</span>
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); chop("right"); }}
          onMouseDown={() => chop("right")}
          className="w-24 h-24 rounded-full flex items-center justify-center select-none active:scale-95 transition-transform"
          style={{ 
            background: 'linear-gradient(180deg, #D7CCC8 0%, #A1887F 100%)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.4)',
            border: '4px solid #8D6E63',
            touchAction: 'manipulation'
          }}
        >
          <span className="text-4xl" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}>▶</span>
        </button>
      </div>
    </div>
  );
};

export default LumberjackGame;