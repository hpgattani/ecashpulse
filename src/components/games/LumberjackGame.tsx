import { useState, useEffect, useCallback, useRef } from "react";
import { useHaptic } from "@/hooks/useHaptic";
import useGameSounds from "@/hooks/useGameSounds";

interface LumberjackGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

type Side = "left" | "right";
type TreeSegment = { hasBranch: Side | null };

// Wood chip particle type
interface WoodChip {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  color: string;
  life: number;
}

const LumberjackGame = ({ onGameEnd, isPlaying }: LumberjackGameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playerSide, setPlayerSide] = useState<Side>("right");
  const [tree, setTree] = useState<TreeSegment[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(100);
  const [chopPhase, setChopPhase] = useState(0); // 0-5 for swing animation phases
  const timerRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const chopAnimRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const gameOverRef = useRef(false);
  const particlesRef = useRef<WoodChip[]>([]);
  const haptic = useHaptic();
  const { play } = useGameSounds();

  // Spawn wood chip particles
  const spawnWoodChips = useCallback((side: Side) => {
    const trunkX = 140; // Center of canvas
    const impactY = 320; // Where axe hits
    const chipColors = ['#D4A574', '#C4956A', '#B8865A', '#A67B52', '#8B6914', '#CD853F'];
    
    const newChips: WoodChip[] = [];
    const chipCount = 8 + Math.floor(Math.random() * 5); // 8-12 chips
    
    for (let i = 0; i < chipCount; i++) {
      const angle = side === "left" 
        ? -Math.PI / 4 + (Math.random() - 0.3) * Math.PI / 2  // Spray right-ish
        : Math.PI / 4 + Math.PI / 2 + (Math.random() - 0.3) * Math.PI / 2; // Spray left-ish
      
      const speed = 3 + Math.random() * 5;
      
      newChips.push({
        x: trunkX + (side === "left" ? -25 : 25),
        y: impactY + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed * (side === "left" ? 1 : -1),
        vy: -Math.abs(Math.sin(angle)) * speed - Math.random() * 2,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.4,
        size: 3 + Math.random() * 6,
        color: chipColors[Math.floor(Math.random() * chipColors.length)],
        life: 1.0
      });
    }
    
    particlesRef.current = [...particlesRef.current, ...newChips];
  }, []);

  // Update particles physics
  const updateParticles = useCallback(() => {
    particlesRef.current = particlesRef.current
      .map(chip => ({
        ...chip,
        x: chip.x + chip.vx,
        y: chip.y + chip.vy,
        vy: chip.vy + 0.25, // Gravity
        vx: chip.vx * 0.99, // Air resistance
        rotation: chip.rotation + chip.rotationSpeed,
        life: chip.life - 0.02
      }))
      .filter(chip => chip.life > 0 && chip.y < 500);
  }, []);

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
      if (chopAnimRef.current) clearTimeout(chopAnimRef.current);
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

  // Canvas rendering - Natural cartoon style matching reference image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const trunkWidth = 55;
    const segmentHeight = 50;
    const groundY = height - 85;

    const render = () => {
      // Sky - Light blue gradient with subtle clouds in background
      const skyGradient = ctx.createLinearGradient(0, 0, 0, groundY);
      skyGradient.addColorStop(0, "#9ED9F2");
      skyGradient.addColorStop(0.6, "#C5E8F7");
      skyGradient.addColorStop(1, "#E8F5FC");
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, width, groundY + 20);

      // Background trees (faded)
      ctx.fillStyle = "rgba(200, 220, 200, 0.4)";
      const drawBgTree = (x: number, h: number) => {
        ctx.beginPath();
        ctx.moveTo(x, groundY);
        ctx.lineTo(x - 30, groundY);
        ctx.lineTo(x - 15, groundY - h);
        ctx.lineTo(x, groundY - h * 0.7);
        ctx.lineTo(x + 15, groundY - h);
        ctx.lineTo(x + 30, groundY);
        ctx.closePath();
        ctx.fill();
      };
      drawBgTree(40, 180);
      drawBgTree(width - 50, 150);
      drawBgTree(width - 20, 120);

      // Distant clouds
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      const drawCloud = (x: number, y: number, scale: number) => {
        ctx.beginPath();
        ctx.arc(x, y, 18 * scale, 0, Math.PI * 2);
        ctx.arc(x + 22 * scale, y - 8 * scale, 22 * scale, 0, Math.PI * 2);
        ctx.arc(x + 45 * scale, y, 18 * scale, 0, Math.PI * 2);
        ctx.fill();
      };
      drawCloud(30, 50, 1);
      drawCloud(width - 70, 35, 0.8);

      // Ground - Floating island style
      // Dirt/earth layer
      ctx.fillStyle = "#8B6914";
      ctx.beginPath();
      ctx.moveTo(20, groundY + 25);
      ctx.quadraticCurveTo(width / 2, groundY + 60, width - 20, groundY + 25);
      ctx.lineTo(width - 30, groundY + 45);
      ctx.quadraticCurveTo(width / 2, groundY + 80, 30, groundY + 45);
      ctx.closePath();
      ctx.fill();

      // Grass layer - bright green
      ctx.fillStyle = "#7BC043";
      ctx.beginPath();
      ctx.moveTo(15, groundY + 5);
      ctx.quadraticCurveTo(width / 4, groundY - 8, width / 2, groundY);
      ctx.quadraticCurveTo(3 * width / 4, groundY + 8, width - 15, groundY + 5);
      ctx.lineTo(width - 20, groundY + 30);
      ctx.quadraticCurveTo(width / 2, groundY + 45, 20, groundY + 30);
      ctx.closePath();
      ctx.fill();

      // Grass highlight
      ctx.fillStyle = "#8FD14F";
      ctx.beginPath();
      ctx.moveTo(25, groundY + 2);
      ctx.quadraticCurveTo(width / 2, groundY - 5, width - 25, groundY + 2);
      ctx.lineTo(width - 30, groundY + 12);
      ctx.quadraticCurveTo(width / 2, groundY + 5, 30, groundY + 12);
      ctx.closePath();
      ctx.fill();

      // Decorative elements - rocks and grass tufts
      ctx.fillStyle = "#9E9E9E";
      ctx.beginPath();
      ctx.ellipse(width / 2 + 50, groundY + 18, 10, 6, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#757575";
      ctx.beginPath();
      ctx.ellipse(width / 2 + 65, groundY + 20, 6, 4, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Tree trunk with bark texture
      const trunkX = (width - trunkWidth) / 2;
      const trunkBaseY = groundY - 5;

      // Main trunk gradient - richer brown
      const trunkGradient = ctx.createLinearGradient(trunkX, 0, trunkX + trunkWidth, 0);
      trunkGradient.addColorStop(0, "#5D4037");
      trunkGradient.addColorStop(0.2, "#795548");
      trunkGradient.addColorStop(0.5, "#8D6E63");
      trunkGradient.addColorStop(0.8, "#795548");
      trunkGradient.addColorStop(1, "#5D4037");

      // Draw tree segments with branches
      tree.forEach((segment, index) => {
        const segY = trunkBaseY - (index + 1) * segmentHeight;
        
        // Trunk segment
        ctx.fillStyle = trunkGradient;
        ctx.fillRect(trunkX, segY, trunkWidth, segmentHeight + 2);

        // Bark texture - vertical lines
        ctx.strokeStyle = "rgba(62, 39, 35, 0.4)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const lineX = trunkX + 8 + i * 12;
          ctx.beginPath();
          ctx.moveTo(lineX, segY + 2);
          ctx.lineTo(lineX + (Math.random() - 0.5) * 3, segY + segmentHeight);
          ctx.stroke();
        }

        // Bark horizontal marks
        ctx.strokeStyle = "rgba(62, 39, 35, 0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(trunkX + 5, segY + segmentHeight / 2);
        ctx.lineTo(trunkX + trunkWidth - 5, segY + segmentHeight / 2 + 3);
        ctx.stroke();

        // Branches - natural cartoon style
        if (segment.hasBranch) {
          const branchY = segY + segmentHeight / 2;
          
          if (segment.hasBranch === "left") {
            // Left branch wood
            ctx.fillStyle = "#6D4C41";
            ctx.beginPath();
            ctx.moveTo(trunkX, branchY - 6);
            ctx.lineTo(trunkX - 55, branchY - 3);
            ctx.lineTo(trunkX - 58, branchY + 6);
            ctx.lineTo(trunkX, branchY + 10);
            ctx.closePath();
            ctx.fill();
            
            // Branch highlight
            ctx.fillStyle = "#8D6E63";
            ctx.beginPath();
            ctx.moveTo(trunkX, branchY - 4);
            ctx.lineTo(trunkX - 50, branchY - 1);
            ctx.lineTo(trunkX - 50, branchY + 2);
            ctx.lineTo(trunkX, branchY + 4);
            ctx.closePath();
            ctx.fill();
            
            // Foliage - layered circles for cartoon look
            ctx.fillStyle = "#5BAD3D";
            ctx.beginPath();
            ctx.arc(trunkX - 45, branchY - 12, 22, 0, Math.PI * 2);
            ctx.arc(trunkX - 68, branchY - 2, 18, 0, Math.PI * 2);
            ctx.arc(trunkX - 52, branchY + 10, 16, 0, Math.PI * 2);
            ctx.fill();
            
            // Highlight layer
            ctx.fillStyle = "#7BC043";
            ctx.beginPath();
            ctx.arc(trunkX - 45, branchY - 16, 14, 0, Math.PI * 2);
            ctx.arc(trunkX - 65, branchY - 8, 10, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Right branch wood
            ctx.fillStyle = "#6D4C41";
            ctx.beginPath();
            ctx.moveTo(trunkX + trunkWidth, branchY - 6);
            ctx.lineTo(trunkX + trunkWidth + 55, branchY - 3);
            ctx.lineTo(trunkX + trunkWidth + 58, branchY + 6);
            ctx.lineTo(trunkX + trunkWidth, branchY + 10);
            ctx.closePath();
            ctx.fill();
            
            // Branch highlight
            ctx.fillStyle = "#8D6E63";
            ctx.beginPath();
            ctx.moveTo(trunkX + trunkWidth, branchY - 4);
            ctx.lineTo(trunkX + trunkWidth + 50, branchY - 1);
            ctx.lineTo(trunkX + trunkWidth + 50, branchY + 2);
            ctx.lineTo(trunkX + trunkWidth, branchY + 4);
            ctx.closePath();
            ctx.fill();
            
            // Foliage
            ctx.fillStyle = "#5BAD3D";
            ctx.beginPath();
            ctx.arc(trunkX + trunkWidth + 45, branchY - 12, 22, 0, Math.PI * 2);
            ctx.arc(trunkX + trunkWidth + 68, branchY - 2, 18, 0, Math.PI * 2);
            ctx.arc(trunkX + trunkWidth + 52, branchY + 10, 16, 0, Math.PI * 2);
            ctx.fill();
            
            // Highlight
            ctx.fillStyle = "#7BC043";
            ctx.beginPath();
            ctx.arc(trunkX + trunkWidth + 45, branchY - 16, 14, 0, Math.PI * 2);
            ctx.arc(trunkX + trunkWidth + 65, branchY - 8, 10, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });

      // Tree stump base
      ctx.fillStyle = "#4E342E";
      ctx.fillRect(trunkX - 8, trunkBaseY, trunkWidth + 16, 18);
      ctx.fillStyle = "#5D4037";
      ctx.fillRect(trunkX - 4, trunkBaseY, trunkWidth + 8, 12);

      // Timer bar at top
      const timerWidth = 90;
      const timerX = (width - timerWidth) / 2;
      const timerY = trunkBaseY - tree.length * segmentHeight - 35;
      
      // Timer container - rounded pill shape
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.strokeStyle = "#795548";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(timerX - 8, timerY - 8, timerWidth + 16, 26, 13);
      ctx.fill();
      ctx.stroke();
      
      // Timer fill
      ctx.fillStyle = timeLeft > 30 ? "#7BC043" : timeLeft > 15 ? "#FFB300" : "#E53935";
      ctx.beginPath();
      ctx.roundRect(timerX, timerY, timerWidth * (timeLeft / 100), 10, 5);
      ctx.fill();

      // Score display
      ctx.font = "bold 26px Arial, sans-serif";
      ctx.fillStyle = "#5D4037";
      ctx.textAlign = "center";
      ctx.fillText(score.toString(), width / 2, timerY - 12);

      // ===== LUMBERJACK CHARACTER - Cartoonish proportions =====
      const playerX = playerSide === "left" ? trunkX - 60 : trunkX + trunkWidth + 5;
      const playerY = trunkBaseY - 60;
      const facingLeft = playerSide === "left";
      const flip = facingLeft ? 1 : -1;
      const centerX = playerX + 30;

      ctx.save();
      ctx.translate(centerX, playerY);
      if (!facingLeft) {
        ctx.scale(-1, 1);
      }
      ctx.translate(-centerX, -playerY);

      // === Body proportions - stocky lumberjack ===
      
      // Shadow under character
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.beginPath();
      ctx.ellipse(playerX + 30, playerY + 88, 25, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Black boots
      ctx.fillStyle = "#1A1A1A";
      ctx.beginPath();
      ctx.roundRect(playerX + 8, playerY + 78, 18, 12, [0, 0, 4, 4]);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(playerX + 32, playerY + 78, 18, 12, [0, 0, 4, 4]);
      ctx.fill();

      // Blue jeans - slightly baggy
      ctx.fillStyle = "#4A7DB8";
      ctx.beginPath();
      ctx.moveTo(playerX + 12, playerY + 55);
      ctx.lineTo(playerX + 8, playerY + 80);
      ctx.lineTo(playerX + 26, playerY + 80);
      ctx.lineTo(playerX + 28, playerY + 55);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(playerX + 32, playerY + 55);
      ctx.lineTo(playerX + 32, playerY + 80);
      ctx.lineTo(playerX + 50, playerY + 80);
      ctx.lineTo(playerX + 48, playerY + 55);
      ctx.closePath();
      ctx.fill();
      
      // Jean details
      ctx.strokeStyle = "#3D6A9E";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(playerX + 17, playerY + 58);
      ctx.lineTo(playerX + 17, playerY + 78);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(playerX + 41, playerY + 58);
      ctx.lineTo(playerX + 41, playerY + 78);
      ctx.stroke();

      // Plaid shirt body - rounder, stockier
      ctx.fillStyle = "#C62828";
      ctx.beginPath();
      ctx.moveTo(playerX + 10, playerY + 28);
      ctx.quadraticCurveTo(playerX + 5, playerY + 42, playerX + 10, playerY + 58);
      ctx.lineTo(playerX + 50, playerY + 58);
      ctx.quadraticCurveTo(playerX + 55, playerY + 42, playerX + 50, playerY + 28);
      ctx.closePath();
      ctx.fill();
      
      // Plaid pattern - darker red lines
      ctx.strokeStyle = "#8B0000";
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(playerX + 15 + i * 10, playerY + 28);
        ctx.lineTo(playerX + 13 + i * 10, playerY + 58);
        ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(playerX + 10, playerY + 35 + i * 10);
        ctx.lineTo(playerX + 50, playerY + 35 + i * 10);
        ctx.stroke();
      }
      
      // Shirt collar
      ctx.fillStyle = "#FFCC80";
      ctx.beginPath();
      ctx.moveTo(playerX + 22, playerY + 26);
      ctx.lineTo(playerX + 38, playerY + 26);
      ctx.lineTo(playerX + 35, playerY + 32);
      ctx.lineTo(playerX + 25, playerY + 32);
      ctx.closePath();
      ctx.fill();

      // Arms (skin)
      ctx.fillStyle = "#FFCC80";
      // Left arm (away from tree) - at rest
      ctx.beginPath();
      ctx.ellipse(playerX + 5, playerY + 38, 7, 12, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Right arm - holding axe, raised position
      ctx.beginPath();
      ctx.ellipse(playerX + 55, playerY + 32, 7, 12, -0.5, 0, Math.PI * 2);
      ctx.fill();

      // Head - rounder, friendlier
      ctx.fillStyle = "#FFCC80";
      ctx.beginPath();
      ctx.arc(playerX + 30, playerY + 10, 20, 0, Math.PI * 2);
      ctx.fill();

      // Ears
      ctx.beginPath();
      ctx.arc(playerX + 10, playerY + 10, 5, 0, Math.PI * 2);
      ctx.arc(playerX + 50, playerY + 10, 5, 0, Math.PI * 2);
      ctx.fill();

      // Big bushy beard
      ctx.fillStyle = "#3E2723";
      ctx.beginPath();
      ctx.moveTo(playerX + 14, playerY + 12);
      ctx.quadraticCurveTo(playerX + 10, playerY + 28, playerX + 20, playerY + 32);
      ctx.lineTo(playerX + 40, playerY + 32);
      ctx.quadraticCurveTo(playerX + 50, playerY + 28, playerX + 46, playerY + 12);
      ctx.quadraticCurveTo(playerX + 30, playerY + 20, playerX + 14, playerY + 12);
      ctx.fill();

      // Eyes - friendly with whites
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.ellipse(playerX + 23, playerY + 6, 5, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(playerX + 37, playerY + 6, 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1A1A1A";
      ctx.beginPath();
      ctx.arc(playerX + 24, playerY + 6, 2.5, 0, Math.PI * 2);
      ctx.arc(playerX + 38, playerY + 6, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Eyebrows
      ctx.strokeStyle = "#3E2723";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(playerX + 18, playerY);
      ctx.lineTo(playerX + 27, playerY + 1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(playerX + 33, playerY + 1);
      ctx.lineTo(playerX + 42, playerY);
      ctx.stroke();

      // Green beanie hat
      ctx.fillStyle = "#2E7D32";
      ctx.beginPath();
      ctx.arc(playerX + 30, playerY - 2, 18, Math.PI, 0, false);
      ctx.fill();
      ctx.fillRect(playerX + 12, playerY - 6, 36, 10);
      
      // Hat rim
      ctx.fillStyle = "#1B5E20";
      ctx.fillRect(playerX + 10, playerY + 2, 40, 5);

      ctx.restore();

      // ===== AXE - Natural ready position, held over shoulder =====
      ctx.save();
      
      // Axe anchor point (hand position)
      const handX = playerSide === "left" ? playerX + 55 : playerX + 5;
      const handY = playerY + 28;
      
      // Natural ready stance: axe resting on shoulder, blade behind head
      // Swing phases animate from this position
      let axeAngle = facingLeft ? -2.0 : 2.0; // Ready: blade behind, angled back
      let axeOffsetX = facingLeft ? 15 : -15;
      let axeOffsetY = -25; // Raised up on shoulder
      
      if (chopPhase > 0) {
        if (chopPhase === 1) {
          // Wind up - pulling back further
          axeAngle = facingLeft ? -2.3 : 2.3;
          axeOffsetX = facingLeft ? 20 : -20;
          axeOffsetY = -35;
        } else if (chopPhase === 2) {
          // Peak - maximum backswing
          axeAngle = facingLeft ? -2.6 : 2.6;
          axeOffsetX = facingLeft ? 22 : -22;
          axeOffsetY = -40;
        } else if (chopPhase === 3) {
          // Swing forward
          axeAngle = facingLeft ? -0.8 : 0.8;
          axeOffsetX = facingLeft ? -5 : 5;
          axeOffsetY = -10;
        } else if (chopPhase === 4) {
          // Impact - axe hitting tree
          axeAngle = facingLeft ? -0.2 : 0.2;
          axeOffsetX = facingLeft ? -20 : 20;
          axeOffsetY = 5;
        } else if (chopPhase === 5) {
          // Recoil
          axeAngle = facingLeft ? -0.5 : 0.5;
          axeOffsetX = facingLeft ? -10 : 10;
          axeOffsetY = 0;
        }
      }
      
      ctx.translate(handX + axeOffsetX, handY + axeOffsetY);
      ctx.rotate(axeAngle);
      
      // Axe handle - warm wood color
      const handleGrad = ctx.createLinearGradient(-4, 0, 4, 0);
      handleGrad.addColorStop(0, "#8D6E63");
      handleGrad.addColorStop(0.5, "#BCAAA4");
      handleGrad.addColorStop(1, "#8D6E63");
      ctx.fillStyle = handleGrad;
      ctx.beginPath();
      ctx.roundRect(-4, -5, 8, 55, 2);
      ctx.fill();
      
      // Handle grip lines
      ctx.strokeStyle = "#6D4C41";
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-3, 35 + i * 5);
        ctx.lineTo(3, 35 + i * 5);
        ctx.stroke();
      }
      
      // Red axe head (matching reference)
      ctx.fillStyle = "#C62828";
      ctx.beginPath();
      ctx.moveTo(-4, -5);
      ctx.lineTo(-4, -25);
      ctx.quadraticCurveTo(-25, -28, -28, -15);
      ctx.quadraticCurveTo(-30, -5, -25, 5);
      ctx.lineTo(-4, 8);
      ctx.closePath();
      ctx.fill();
      
      // Axe head shine
      ctx.fillStyle = "#E53935";
      ctx.beginPath();
      ctx.moveTo(-6, -18);
      ctx.quadraticCurveTo(-18, -20, -20, -12);
      ctx.quadraticCurveTo(-18, -8, -6, -5);
      ctx.closePath();
      ctx.fill();
      
      // Blade edge - silver
      ctx.strokeStyle = "#E0E0E0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-28, -15);
      ctx.quadraticCurveTo(-30, -5, -25, 5);
      ctx.stroke();
      
      ctx.restore();

      // ===== WOOD CHIP PARTICLES =====
      updateParticles();
      
      particlesRef.current.forEach(chip => {
        ctx.save();
        ctx.translate(chip.x, chip.y);
        ctx.rotate(chip.rotation);
        ctx.globalAlpha = chip.life;
        
        // Draw wood chip - irregular polygon shape
        ctx.fillStyle = chip.color;
        ctx.beginPath();
        ctx.moveTo(-chip.size / 2, -chip.size / 3);
        ctx.lineTo(chip.size / 2, -chip.size / 4);
        ctx.lineTo(chip.size / 2 + 1, chip.size / 3);
        ctx.lineTo(-chip.size / 3, chip.size / 2);
        ctx.closePath();
        ctx.fill();
        
        // Highlight edge
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-chip.size / 2, -chip.size / 3);
        ctx.lineTo(chip.size / 2, -chip.size / 4);
        ctx.stroke();
        
        ctx.restore();
      });

      // Game over overlay
      if (gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.fillRect(0, 0, width, height);
        ctx.font = "bold 32px Arial, sans-serif";
        ctx.fillStyle = "#E53935";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", width / 2, height / 2 - 20);
        ctx.font = "bold 22px Arial, sans-serif";
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(`Score: ${score}`, width / 2, height / 2 + 20);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [tree, playerSide, chopPhase, gameOver, score, timeLeft, updateParticles]);

  const chop = useCallback((side: Side) => {
    if (gameOverRef.current || !isPlaying || !gameStarted || chopPhase > 0) return;
    setPlayerSide(side);
    
    // Start multi-phase swing animation
    const animateSwing = () => {
      let phase = 1;
      const runPhase = () => {
        setChopPhase(phase);
        if (phase === 4) {
          // Impact phase - play sound, haptic, and spawn wood chips
          haptic.chop();
          play("chop");
          spawnWoodChips(side);
        }
        phase++;
        if (phase <= 5) {
          chopAnimRef.current = window.setTimeout(runPhase, 35);
        } else {
          // Reset after animation completes
          setTimeout(() => setChopPhase(0), 50);
        }
      };
      runPhase();
    };
    
    animateSwing();

    if (tree[0]?.hasBranch === side) {
      gameOverRef.current = true;
      setGameOver(true);
      haptic.error();
      play("gameOver");
      onGameEnd(scoreRef.current);
      return;
    }

    setTree((prevTree) => [...prevTree.slice(1), generateSegment()]);
    const newScore = scoreRef.current + 1;
    scoreRef.current = newScore;
    setScore(newScore);
    setTimeLeft((t) => Math.min(100, t + 3));
  }, [tree, isPlaying, gameStarted, chopPhase, haptic, play, onGameEnd, spawnWoodChips]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-3" style={{ background: "linear-gradient(180deg, #87CEEB 0%, #E0F6FF 100%)" }}>
      <canvas
        ref={canvasRef}
        width={280}
        height={450}
        className="rounded-xl shadow-lg"
        style={{ touchAction: 'none' }}
      />

      {/* Wood slice buttons - natural log cross-section style */}
      <div className="flex gap-12 mt-5">
        <button
          onTouchStart={(e) => { e.preventDefault(); chop("left"); }}
          onMouseDown={() => chop("left")}
          className="w-24 h-24 rounded-full flex items-center justify-center select-none active:scale-95 transition-transform relative overflow-hidden"
          style={{ 
            background: 'radial-gradient(ellipse at 40% 40%, #F5E6D3 0%, #E8D4B8 25%, #D4B896 50%, #C4A574 75%, #A68B5B 100%)',
            boxShadow: '0 6px 12px rgba(0,0,0,0.35), inset 0 2px 8px rgba(255,255,255,0.3), inset 0 -2px 6px rgba(0,0,0,0.15)',
            border: '5px solid #8B7355',
            touchAction: 'manipulation'
          }}
        >
          {/* Wood grain rings */}
          <div className="absolute inset-3 rounded-full opacity-30" style={{
            background: 'radial-gradient(circle, transparent 20%, rgba(139,115,85,0.3) 22%, transparent 24%, transparent 40%, rgba(139,115,85,0.2) 42%, transparent 44%, transparent 60%, rgba(139,115,85,0.2) 62%, transparent 64%)'
          }} />
          <span className="text-3xl font-bold relative z-10" style={{ color: '#5D4037', textShadow: '1px 1px 0 rgba(255,255,255,0.5)' }}>◀</span>
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); chop("right"); }}
          onMouseDown={() => chop("right")}
          className="w-24 h-24 rounded-full flex items-center justify-center select-none active:scale-95 transition-transform relative overflow-hidden"
          style={{ 
            background: 'radial-gradient(ellipse at 60% 40%, #F5E6D3 0%, #E8D4B8 25%, #D4B896 50%, #C4A574 75%, #A68B5B 100%)',
            boxShadow: '0 6px 12px rgba(0,0,0,0.35), inset 0 2px 8px rgba(255,255,255,0.3), inset 0 -2px 6px rgba(0,0,0,0.15)',
            border: '5px solid #8B7355',
            touchAction: 'manipulation'
          }}
        >
          {/* Wood grain rings */}
          <div className="absolute inset-3 rounded-full opacity-30" style={{
            background: 'radial-gradient(circle, transparent 20%, rgba(139,115,85,0.3) 22%, transparent 24%, transparent 40%, rgba(139,115,85,0.2) 42%, transparent 44%, transparent 60%, rgba(139,115,85,0.2) 62%, transparent 64%)'
          }} />
          <span className="text-3xl font-bold relative z-10" style={{ color: '#5D4037', textShadow: '1px 1px 0 rgba(255,255,255,0.5)' }}>▶</span>
        </button>
      </div>
    </div>
  );
};

export default LumberjackGame;