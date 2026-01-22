import { useState, useEffect, useCallback, useRef } from "react";
import { useHaptic } from "@/hooks/useHaptic";
import useGameSounds from "@/hooks/useGameSounds";

interface TetrisGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 18;
const CELL_SIZE = 18;

type CellValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Board = CellValue[][];
type Position = { x: number; y: number };

const TETROMINOES = [
  { shape: [[1, 1, 1, 1]], color: 1 },
  { shape: [[1, 1], [1, 1]], color: 2 },
  { shape: [[0, 1, 0], [1, 1, 1]], color: 3 },
  { shape: [[1, 0, 0], [1, 1, 1]], color: 4 },
  { shape: [[0, 0, 1], [1, 1, 1]], color: 5 },
  { shape: [[0, 1, 1], [1, 1, 0]], color: 6 },
  { shape: [[1, 1, 0], [0, 1, 1]], color: 7 },
];

const COLORS: Record<number, { main: string; light: string; dark: string; glow: string }> = {
  0: { main: "transparent", light: "transparent", dark: "transparent", glow: "transparent" },
  1: { main: "#06b6d4", light: "#22d3ee", dark: "#0891b2", glow: "rgba(6, 182, 212, 0.6)" },
  2: { main: "#eab308", light: "#facc15", dark: "#ca8a04", glow: "rgba(234, 179, 8, 0.6)" },
  3: { main: "#a855f7", light: "#c084fc", dark: "#9333ea", glow: "rgba(168, 85, 247, 0.6)" },
  4: { main: "#f97316", light: "#fb923c", dark: "#ea580c", glow: "rgba(249, 115, 22, 0.6)" },
  5: { main: "#3b82f6", light: "#60a5fa", dark: "#2563eb", glow: "rgba(59, 130, 246, 0.6)" },
  6: { main: "#22c55e", light: "#4ade80", dark: "#16a34a", glow: "rgba(34, 197, 94, 0.6)" },
  7: { main: "#ef4444", light: "#f87171", dark: "#dc2626", glow: "rgba(239, 68, 68, 0.6)" },
};

const TetrisGame = ({ onGameEnd, isPlaying }: TetrisGameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [board, setBoard] = useState<Board>(() => 
    Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0))
  );
  const [currentPiece, setCurrentPiece] = useState<{ shape: number[][]; color: number } | null>(null);
  const [position, setPosition] = useState<Position>({ x: 4, y: 0 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [linesClearing, setLinesClearing] = useState<number[]>([]);
  const gameLoopRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const scoreRef = useRef(0);
  const gameOverRef = useRef(false);
  const haptic = useHaptic();
  const { play } = useGameSounds();

  const createEmptyBoard = (): Board => 
    Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0) as CellValue[]);

  const getRandomPiece = () => {
    const piece = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
    return { ...piece, shape: piece.shape.map(row => [...row]) };
  };

  const resetGame = useCallback(() => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    setBoard(createEmptyBoard());
    setCurrentPiece(getRandomPiece());
    setPosition({ x: 4, y: 0 });
    setScore(0);
    scoreRef.current = 0;
    setGameOver(false);
    gameOverRef.current = false;
    setGameStarted(true);
    setLinesClearing([]);
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
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const canMove = useCallback((piece: number[][], pos: Position, boardState: Board): boolean => {
    for (let y = 0; y < piece.length; y++) {
      for (let x = 0; x < piece[y].length; x++) {
        if (piece[y][x]) {
          const newX = pos.x + x;
          const newY = pos.y + y;
          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) return false;
          if (newY >= 0 && boardState[newY][newX]) return false;
        }
      }
    }
    return true;
  }, []);

  const rotatePiece = useCallback((piece: number[][]): number[][] => {
    const rows = piece.length;
    const cols = piece[0].length;
    const rotated: number[][] = [];
    for (let i = 0; i < cols; i++) {
      rotated.push([]);
      for (let j = rows - 1; j >= 0; j--) {
        rotated[i].push(piece[j][i]);
      }
    }
    return rotated;
  }, []);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawBlock = (x: number, y: number, color: number, flashing: boolean) => {
      const px = x * CELL_SIZE;
      const py = y * CELL_SIZE;
      const size = CELL_SIZE - 2;
      const colors = COLORS[color];

      if (flashing) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(Date.now() / 50) * 0.5})`;
        ctx.fillRect(px + 1, py + 1, size, size);
        return;
      }

      ctx.shadowColor = colors.glow;
      ctx.shadowBlur = 8;

      const gradient = ctx.createLinearGradient(px, py, px, py + size);
      gradient.addColorStop(0, colors.light);
      gradient.addColorStop(0.5, colors.main);
      gradient.addColorStop(1, colors.dark);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(px + 1, py + 1, size, size, 3);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.beginPath();
      ctx.roundRect(px + 2, py + 2, size - 4, 4, 2);
      ctx.fill();
    };

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, "#0f0f23");
      bgGradient.addColorStop(1, "#1a1a2e");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= BOARD_WIDTH; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i <= BOARD_HEIGHT; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(canvas.width, i * CELL_SIZE);
        ctx.stroke();
      }

      // Placed pieces
      for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
          const cell = board[y][x];
          if (cell !== 0) {
            drawBlock(x, y, cell, linesClearing.includes(y));
          }
        }
      }

      // Ghost and current piece
      if (currentPiece) {
        // Ghost
        let ghostY = position.y;
        while (canMove(currentPiece.shape, { x: position.x, y: ghostY + 1 }, board)) {
          ghostY++;
        }
        
        for (let py = 0; py < currentPiece.shape.length; py++) {
          for (let px = 0; px < currentPiece.shape[py].length; px++) {
            if (currentPiece.shape[py][px]) {
              const gx = (position.x + px) * CELL_SIZE;
              const gy = (ghostY + py) * CELL_SIZE;
              ctx.strokeStyle = COLORS[currentPiece.color].glow;
              ctx.lineWidth = 2;
              ctx.setLineDash([4, 4]);
              ctx.strokeRect(gx + 2, gy + 2, CELL_SIZE - 4, CELL_SIZE - 4);
              ctx.setLineDash([]);
            }
          }
        }

        // Current piece
        for (let py = 0; py < currentPiece.shape.length; py++) {
          for (let px = 0; px < currentPiece.shape[py].length; px++) {
            if (currentPiece.shape[py][px]) {
              drawBlock(position.x + px, position.y + py, currentPiece.color, false);
            }
          }
        }
      }

      // Game over
      if (gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = "bold 18px sans-serif";
        ctx.fillStyle = "#ef4444";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [board, currentPiece, position, linesClearing, gameOver, canMove]);

  const placePiece = useCallback(() => {
    if (!currentPiece || gameOverRef.current) return;

    const newBoard = board.map(row => [...row]) as Board;
    
    for (let y = 0; y < currentPiece.shape.length; y++) {
      for (let x = 0; x < currentPiece.shape[y].length; x++) {
        if (currentPiece.shape[y][x]) {
          const boardY = position.y + y;
          const boardX = position.x + x;
          if (boardY >= 0 && boardY < BOARD_HEIGHT) {
            newBoard[boardY][boardX] = currentPiece.color as CellValue;
          }
        }
      }
    }

    haptic.medium();
    play("drop");

    // Find lines to clear
    const linesToClear: number[] = [];
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
      if (newBoard[y].every(cell => cell !== 0)) {
        linesToClear.push(y);
      }
    }

    if (linesToClear.length > 0) {
      setLinesClearing(linesToClear);
      haptic.success();
      play("lineClear");

      setTimeout(() => {
        const clearedBoard = newBoard.filter((_, y) => !linesToClear.includes(y));
        while (clearedBoard.length < BOARD_HEIGHT) {
          clearedBoard.unshift(Array(BOARD_WIDTH).fill(0) as CellValue[]);
        }
        
        const points = [0, 100, 300, 500, 800][linesToClear.length] || 0;
        const newScore = scoreRef.current + points;
        scoreRef.current = newScore;
        setScore(newScore);
        setBoard(clearedBoard);
        setLinesClearing([]);

        spawnNewPiece(clearedBoard);
      }, 300);
    } else {
      setBoard(newBoard);
      spawnNewPiece(newBoard);
    }
  }, [board, currentPiece, position, haptic, play]);

  const spawnNewPiece = (boardState: Board) => {
    const newPiece = getRandomPiece();
    const newPos = { x: 4, y: 0 };
    
    if (!canMove(newPiece.shape, newPos, boardState)) {
      gameOverRef.current = true;
      setGameOver(true);
      haptic.error();
      play("gameOver");
      onGameEnd(scoreRef.current);
    } else {
      setCurrentPiece(newPiece);
      setPosition(newPos);
    }
  };

  // Game loop
  useEffect(() => {
    if (!isPlaying || gameOverRef.current || !currentPiece || !gameStarted || linesClearing.length > 0) return;

    gameLoopRef.current = window.setInterval(() => {
      if (gameOverRef.current) return;
      
      if (canMove(currentPiece.shape, { x: position.x, y: position.y + 1 }, board)) {
        setPosition(p => ({ ...p, y: p.y + 1 }));
      } else {
        placePiece();
      }
    }, 500);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPlaying, gameStarted, currentPiece, position, board, canMove, placePiece, linesClearing]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOverRef.current || !currentPiece || !gameStarted) return;

      switch (e.key) {
        case "ArrowLeft":
        case "a":
          if (canMove(currentPiece.shape, { x: position.x - 1, y: position.y }, board)) {
            setPosition(p => ({ ...p, x: p.x - 1 }));
            haptic.light();
            play("move");
          }
          break;
        case "ArrowRight":
        case "d":
          if (canMove(currentPiece.shape, { x: position.x + 1, y: position.y }, board)) {
            setPosition(p => ({ ...p, x: p.x + 1 }));
            haptic.light();
            play("move");
          }
          break;
        case "ArrowDown":
        case "s":
          if (canMove(currentPiece.shape, { x: position.x, y: position.y + 1 }, board)) {
            setPosition(p => ({ ...p, y: p.y + 1 }));
          }
          break;
        case "ArrowUp":
        case "w":
          const rotated = rotatePiece(currentPiece.shape);
          if (canMove(rotated, position, board)) {
            setCurrentPiece({ ...currentPiece, shape: rotated });
            haptic.light();
            play("rotate");
          }
          break;
        case " ":
          let newY = position.y;
          while (canMove(currentPiece.shape, { x: position.x, y: newY + 1 }, board)) {
            newY++;
          }
          setPosition(p => ({ ...p, y: newY }));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, gameStarted, currentPiece, position, board, canMove, rotatePiece, haptic, play]);

  const handleRotate = useCallback(() => {
    if (!currentPiece || !gameStarted || gameOverRef.current) return;
    const rotated = rotatePiece(currentPiece.shape);
    if (canMove(rotated, position, board)) {
      setCurrentPiece({ ...currentPiece, shape: rotated });
      haptic.light();
      play("rotate");
    }
  }, [currentPiece, position, board, canMove, rotatePiece, haptic, play, gameStarted]);

  const handleMoveLeft = useCallback(() => {
    if (!currentPiece || !gameStarted || gameOverRef.current) return;
    if (canMove(currentPiece.shape, { x: position.x - 1, y: position.y }, board)) {
      setPosition(p => ({ ...p, x: p.x - 1 }));
      haptic.light();
      play("move");
    }
  }, [currentPiece, position, board, canMove, haptic, play, gameStarted]);

  const handleMoveRight = useCallback(() => {
    if (!currentPiece || !gameStarted || gameOverRef.current) return;
    if (canMove(currentPiece.shape, { x: position.x + 1, y: position.y }, board)) {
      setPosition(p => ({ ...p, x: p.x + 1 }));
      haptic.light();
      play("move");
    }
  }, [currentPiece, position, board, canMove, haptic, play, gameStarted]);

  const handleHardDrop = useCallback(() => {
    if (!currentPiece || !gameStarted || gameOverRef.current) return;
    let newY = position.y;
    while (canMove(currentPiece.shape, { x: position.x, y: newY + 1 }, board)) {
      newY++;
    }
    setPosition(p => ({ ...p, y: newY }));
    haptic.heavy();
  }, [currentPiece, position, board, canMove, haptic, gameStarted]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-3" style={{ background: "linear-gradient(180deg, #1e1b4b 0%, #0f0f23 100%)" }}>
      {/* Score */}
      <div className="text-xl mb-2 font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">
        Score: {score}
      </div>
      
      {/* Game canvas */}
      <canvas
        ref={canvasRef}
        width={BOARD_WIDTH * CELL_SIZE}
        height={BOARD_HEIGHT * CELL_SIZE}
        className="rounded-lg border-2 border-purple-500/50"
        style={{
          boxShadow: "0 0 30px rgba(168, 85, 247, 0.3), inset 0 0 20px rgba(168, 85, 247, 0.1)",
          touchAction: 'none',
        }}
      />

      {/* Mobile controls */}
      <div className="flex gap-3 mt-3">
        <button
          onTouchStart={(e) => { e.preventDefault(); handleMoveLeft(); }}
          onMouseDown={handleMoveLeft}
          className="w-14 h-14 bg-gradient-to-b from-purple-500/40 to-purple-600/30 active:from-purple-400/60 active:to-purple-500/50 rounded-xl flex items-center justify-center text-2xl text-white/90 border border-purple-500/30 select-none"
          style={{ touchAction: 'manipulation' }}
        >
          ←
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); handleRotate(); }}
          onMouseDown={handleRotate}
          className="w-14 h-14 bg-gradient-to-b from-pink-500/40 to-pink-600/30 active:from-pink-400/60 active:to-pink-500/50 rounded-xl flex items-center justify-center text-2xl text-white/90 border border-pink-500/30 select-none"
          style={{ touchAction: 'manipulation' }}
        >
          ↻
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); handleHardDrop(); }}
          onMouseDown={handleHardDrop}
          className="w-14 h-14 bg-gradient-to-b from-amber-500/40 to-amber-600/30 active:from-amber-400/60 active:to-amber-500/50 rounded-xl flex items-center justify-center text-xl text-white/90 border border-amber-500/30 select-none"
          style={{ touchAction: 'manipulation' }}
        >
          ⬇
        </button>
        <button
          onTouchStart={(e) => { e.preventDefault(); handleMoveRight(); }}
          onMouseDown={handleMoveRight}
          className="w-14 h-14 bg-gradient-to-b from-purple-500/40 to-purple-600/30 active:from-purple-400/60 active:to-purple-500/50 rounded-xl flex items-center justify-center text-2xl text-white/90 border border-purple-500/30 select-none"
          style={{ touchAction: 'manipulation' }}
        >
          →
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-2 hidden md:block">
        Use arrow keys | Space to drop
      </p>
    </div>
  );
};

export default TetrisGame;
