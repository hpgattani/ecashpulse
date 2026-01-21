import { useState, useEffect, useCallback, useRef } from "react";
import { useTouchSwipe, SwipeDirection } from "@/hooks/useTouchSwipe";

interface TetrisGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const CELL_SIZE = 20;

type CellValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Board = CellValue[][];
type Position = { x: number; y: number };

const TETROMINOES = [
  { shape: [[1, 1, 1, 1]], color: 1 }, // I
  { shape: [[1, 1], [1, 1]], color: 2 }, // O
  { shape: [[0, 1, 0], [1, 1, 1]], color: 3 }, // T
  { shape: [[1, 0, 0], [1, 1, 1]], color: 4 }, // L
  { shape: [[0, 0, 1], [1, 1, 1]], color: 5 }, // J
  { shape: [[0, 1, 1], [1, 1, 0]], color: 6 }, // S
  { shape: [[1, 1, 0], [0, 1, 1]], color: 7 }, // Z
];

const COLORS: Record<number, string> = {
  0: "transparent",
  1: "#00f0f0", // I - cyan
  2: "#f0f000", // O - yellow
  3: "#a000f0", // T - purple
  4: "#f0a000", // L - orange
  5: "#0000f0", // J - blue
  6: "#00f000", // S - green
  7: "#f00000", // Z - red
};

const TetrisGame = ({ onGameEnd, isPlaying }: TetrisGameProps) => {
  const [board, setBoard] = useState<Board>(() => 
    Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0))
  );
  const [currentPiece, setCurrentPiece] = useState<{ shape: number[][]; color: number } | null>(null);
  const [position, setPosition] = useState<Position>({ x: 4, y: 0 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const gameLoopRef = useRef<number | null>(null);

  const createEmptyBoard = (): Board => 
    Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0) as CellValue[]);

  const getRandomPiece = () => {
    const piece = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
    return { ...piece, shape: piece.shape.map(row => [...row]) };
  };

  const resetGame = useCallback(() => {
    setBoard(createEmptyBoard());
    setCurrentPiece(getRandomPiece());
    setPosition({ x: 4, y: 0 });
    setScore(0);
    setGameOver(false);
  }, []);

  useEffect(() => {
    if (isPlaying && !gameOver) {
      resetGame();
    }
  }, [isPlaying]);

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

  const placePiece = useCallback(() => {
    if (!currentPiece) return;

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

    // Clear lines
    let linesCleared = 0;
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
      if (newBoard[y].every(cell => cell !== 0)) {
        newBoard.splice(y, 1);
        newBoard.unshift(Array(BOARD_WIDTH).fill(0) as CellValue[]);
        linesCleared++;
        y++;
      }
    }

    const points = [0, 100, 300, 500, 800][linesCleared] || 0;
    setScore(s => s + points);
    setBoard(newBoard);

    // New piece
    const newPiece = getRandomPiece();
    const newPos = { x: 4, y: 0 };
    
    if (!canMove(newPiece.shape, newPos, newBoard)) {
      setGameOver(true);
      onGameEnd(score + points);
    } else {
      setCurrentPiece(newPiece);
      setPosition(newPos);
    }
  }, [board, currentPiece, position, score, canMove, onGameEnd]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOver || !currentPiece) return;

      switch (e.key) {
        case "ArrowLeft":
        case "a":
          if (canMove(currentPiece.shape, { x: position.x - 1, y: position.y }, board)) {
            setPosition(p => ({ ...p, x: p.x - 1 }));
          }
          break;
        case "ArrowRight":
        case "d":
          if (canMove(currentPiece.shape, { x: position.x + 1, y: position.y }, board)) {
            setPosition(p => ({ ...p, x: p.x + 1 }));
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
          }
          break;
        case " ":
          // Hard drop
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
  }, [isPlaying, gameOver, currentPiece, position, board, canMove, rotatePiece]);

  useEffect(() => {
    if (!isPlaying || gameOver || !currentPiece) return;

    gameLoopRef.current = window.setInterval(() => {
      if (canMove(currentPiece.shape, { x: position.x, y: position.y + 1 }, board)) {
        setPosition(p => ({ ...p, y: p.y + 1 }));
      } else {
        placePiece();
      }
    }, 500);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPlaying, gameOver, currentPiece, position, board, canMove, placePiece]);

  // Touch swipe controls
  const handleSwipe = useCallback((swipeDir: SwipeDirection) => {
    if (!isPlaying || gameOver || !currentPiece) return;

    switch (swipeDir) {
      case "left":
        if (canMove(currentPiece.shape, { x: position.x - 1, y: position.y }, board)) {
          setPosition(p => ({ ...p, x: p.x - 1 }));
        }
        break;
      case "right":
        if (canMove(currentPiece.shape, { x: position.x + 1, y: position.y }, board)) {
          setPosition(p => ({ ...p, x: p.x + 1 }));
        }
        break;
      case "down":
        // Soft drop
        if (canMove(currentPiece.shape, { x: position.x, y: position.y + 1 }, board)) {
          setPosition(p => ({ ...p, y: p.y + 1 }));
        }
        break;
      case "up":
        // Rotate
        const rotated = rotatePiece(currentPiece.shape);
        if (canMove(rotated, position, board)) {
          setCurrentPiece({ ...currentPiece, shape: rotated });
        }
        break;
    }
  }, [isPlaying, gameOver, currentPiece, position, board, canMove, rotatePiece]);

  const handleTap = useCallback(() => {
    if (!isPlaying || gameOver || !currentPiece) return;
    // Tap to rotate
    const rotated = rotatePiece(currentPiece.shape);
    if (canMove(rotated, position, board)) {
      setCurrentPiece({ ...currentPiece, shape: rotated });
    }
  }, [isPlaying, gameOver, currentPiece, position, board, canMove, rotatePiece]);

  const touchHandlers = useTouchSwipe({
    onSwipe: handleSwipe,
    onTap: handleTap,
    threshold: 25,
  });

  // Button controls for mobile
  const handleHardDrop = () => {
    if (!currentPiece) return;
    let newY = position.y;
    while (canMove(currentPiece.shape, { x: position.x, y: newY + 1 }, board)) {
      newY++;
    }
    setPosition(p => ({ ...p, y: newY }));
  };

  const renderBoard = () => {
    const displayBoard = board.map(row => [...row]) as Board;
    
    if (currentPiece) {
      for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
          if (currentPiece.shape[y][x]) {
            const boardY = position.y + y;
            const boardX = position.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              displayBoard[boardY][boardX] = currentPiece.color as CellValue;
            }
          }
        }
      }
    }

    return displayBoard;
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-900 p-4">
      <div className="text-white text-xl mb-4 font-bold">Score: {score}</div>
      
      {/* Swipe hint for mobile */}
      <p className="text-xs text-primary/70 mb-2 md:hidden">Swipe to move • Tap to rotate</p>
      
      <div
        className="border-2 border-primary touch-none"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${BOARD_WIDTH}, ${CELL_SIZE}px)`,
          backgroundColor: "#1a1a2e",
        }}
        {...touchHandlers}
      >
        {renderBoard().flatMap((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${x}-${y}`}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                backgroundColor: COLORS[cell],
                border: cell ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.05)",
              }}
            />
          ))
        )}
      </div>

      {/* Mobile button controls */}
      <div className="flex gap-3 mt-4 md:hidden">
        <button
          onTouchStart={() => currentPiece && canMove(currentPiece.shape, { x: position.x - 1, y: position.y }, board) && setPosition(p => ({ ...p, x: p.x - 1 }))}
          className="w-14 h-14 bg-primary/30 active:bg-primary/50 rounded-lg flex items-center justify-center text-2xl transition-colors"
        >
          ←
        </button>
        <button
          onTouchStart={handleTap}
          className="w-14 h-14 bg-purple-500/30 active:bg-purple-500/50 rounded-lg flex items-center justify-center text-2xl transition-colors"
        >
          ↻
        </button>
        <button
          onTouchStart={handleHardDrop}
          className="w-14 h-14 bg-yellow-500/30 active:bg-yellow-500/50 rounded-lg flex items-center justify-center text-xl transition-colors"
        >
          ⬇
        </button>
        <button
          onTouchStart={() => currentPiece && canMove(currentPiece.shape, { x: position.x + 1, y: position.y }, board) && setPosition(p => ({ ...p, x: p.x + 1 }))}
          className="w-14 h-14 bg-primary/30 active:bg-primary/50 rounded-lg flex items-center justify-center text-2xl transition-colors"
        >
          →
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-4 hidden md:block">
        ←→ Move | ↑ Rotate | ↓ Soft drop | Space: Hard drop
      </p>
    </div>
  );
};

export default TetrisGame;