import { useState, useEffect, useCallback, useRef } from "react";
import { Application, Graphics, Container, Text, TextStyle } from "pixi.js";
import { useHaptic } from "@/hooks/useHaptic";
import useGameSounds from "@/hooks/useGameSounds";

interface TetrisGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 18;
const CELL_SIZE = 18;
const GAME_WIDTH = BOARD_WIDTH * CELL_SIZE;
const GAME_HEIGHT = BOARD_HEIGHT * CELL_SIZE;

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

const COLORS: Record<number, { main: number; light: number; glow: number }> = {
  0: { main: 0x000000, light: 0x000000, glow: 0x000000 },
  1: { main: 0x06b6d4, light: 0x22d3ee, glow: 0x06b6d4 },
  2: { main: 0xeab308, light: 0xfacc15, glow: 0xeab308 },
  3: { main: 0xa855f7, light: 0xc084fc, glow: 0xa855f7 },
  4: { main: 0xf97316, light: 0xfb923c, glow: 0xf97316 },
  5: { main: 0x3b82f6, light: 0x60a5fa, glow: 0x3b82f6 },
  6: { main: 0x22c55e, light: 0x4ade80, glow: 0x22c55e },
  7: { main: 0xef4444, light: 0xf87171, glow: 0xef4444 },
};

const TetrisGame = ({ onGameEnd, isPlaying }: TetrisGameProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const boardRef = useRef<Board>(
    Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0) as CellValue[])
  );
  const currentPieceRef = useRef<{ shape: number[][]; color: number } | null>(null);
  const positionRef = useRef<Position>({ x: 4, y: 0 });
  const scoreRef = useRef(0);
  const gameOverRef = useRef(false);
  const gameStartedRef = useRef(false);
  const linesClearingRef = useRef<number[]>([]);
  const gameLoopRef = useRef<number | null>(null);
  
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  
  const haptic = useHaptic();
  const { play } = useGameSounds();

  const createEmptyBoard = (): Board => 
    Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0) as CellValue[]);

  const getRandomPiece = () => {
    const piece = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
    return { ...piece, shape: piece.shape.map(row => [...row]) };
  };

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current) return;
    
    let mounted = true;
    
    const initPixi = async () => {
      if (!mounted || !containerRef.current) return;
      
      const app = new Application();
      await app.init({
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        backgroundColor: 0x0f0f23,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      
      if (!mounted || !containerRef.current) {
        app.destroy(true);
        return;
      }
      
      containerRef.current.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;
      
      // Create layers
      const gridLayer = new Container();
      const gameLayer = new Container();
      const ghostLayer = new Container();
      const uiLayer = new Container();
      
      gridLayer.label = 'grid';
      gameLayer.label = 'game';
      ghostLayer.label = 'ghost';
      uiLayer.label = 'ui';
      
      app.stage.addChild(gridLayer, ghostLayer, gameLayer, uiLayer);
      
      // Draw grid
      const gridGraphics = new Graphics();
      gridGraphics.setStrokeStyle({ width: 0.5, color: 0xffffff, alpha: 0.05 });
      for (let i = 0; i <= BOARD_WIDTH; i++) {
        gridGraphics.moveTo(i * CELL_SIZE, 0);
        gridGraphics.lineTo(i * CELL_SIZE, GAME_HEIGHT);
        gridGraphics.stroke();
      }
      for (let i = 0; i <= BOARD_HEIGHT; i++) {
        gridGraphics.moveTo(0, i * CELL_SIZE);
        gridGraphics.lineTo(GAME_WIDTH, i * CELL_SIZE);
        gridGraphics.stroke();
      }
      gridLayer.addChild(gridGraphics);
      
      // Render loop
      app.ticker.add(() => {
        if (!gameStartedRef.current) return;
        
        gameLayer.removeChildren();
        ghostLayer.removeChildren();
        
        const board = boardRef.current;
        const currentPiece = currentPieceRef.current;
        const position = positionRef.current;
        const linesClearing = linesClearingRef.current;
        
        // Draw placed pieces
        for (let y = 0; y < BOARD_HEIGHT; y++) {
          for (let x = 0; x < BOARD_WIDTH; x++) {
            const cell = board[y][x];
            if (cell !== 0) {
              const isFlashing = linesClearing.includes(y);
              const graphics = new Graphics();
              const px = x * CELL_SIZE + 1;
              const py = y * CELL_SIZE + 1;
              const size = CELL_SIZE - 2;
              
              if (isFlashing) {
                const flashAlpha = 0.5 + Math.sin(Date.now() / 50) * 0.5;
                graphics.roundRect(px, py, size, size, 3);
                graphics.fill({ color: 0xffffff, alpha: flashAlpha });
              } else {
                // Glow
                graphics.roundRect(px - 2, py - 2, size + 4, size + 4, 4);
                graphics.fill({ color: COLORS[cell].glow, alpha: 0.2 });
                
                // Main block
                graphics.roundRect(px, py, size, size, 3);
                graphics.fill({ color: COLORS[cell].main });
                
                // Highlight
                graphics.roundRect(px + 2, py + 2, size - 4, 4, 2);
                graphics.fill({ color: COLORS[cell].light, alpha: 0.5 });
              }
              
              gameLayer.addChild(graphics);
            }
          }
        }
        
        // Draw ghost and current piece
        if (currentPiece) {
          // Find ghost position
          let ghostY = position.y;
          while (canMoveFunc(currentPiece.shape, { x: position.x, y: ghostY + 1 }, board)) {
            ghostY++;
          }
          
          // Draw ghost
          for (let py = 0; py < currentPiece.shape.length; py++) {
            for (let px = 0; px < currentPiece.shape[py].length; px++) {
              if (currentPiece.shape[py][px]) {
                const graphics = new Graphics();
                const gx = (position.x + px) * CELL_SIZE + 2;
                const gy = (ghostY + py) * CELL_SIZE + 2;
                
                graphics.setStrokeStyle({ width: 2, color: COLORS[currentPiece.color].glow, alpha: 0.5 });
                graphics.rect(gx, gy, CELL_SIZE - 4, CELL_SIZE - 4);
                graphics.stroke();
                
                ghostLayer.addChild(graphics);
              }
            }
          }
          
          // Draw current piece
          for (let py = 0; py < currentPiece.shape.length; py++) {
            for (let px = 0; px < currentPiece.shape[py].length; px++) {
              if (currentPiece.shape[py][px]) {
                const graphics = new Graphics();
                const bx = (position.x + px) * CELL_SIZE + 1;
                const by = (position.y + py) * CELL_SIZE + 1;
                const size = CELL_SIZE - 2;
                
                // Glow
                graphics.roundRect(bx - 2, by - 2, size + 4, size + 4, 4);
                graphics.fill({ color: COLORS[currentPiece.color].glow, alpha: 0.3 });
                
                // Main block
                graphics.roundRect(bx, by, size, size, 3);
                graphics.fill({ color: COLORS[currentPiece.color].main });
                
                // Highlight
                graphics.roundRect(bx + 2, by + 2, size - 4, 4, 2);
                graphics.fill({ color: COLORS[currentPiece.color].light, alpha: 0.5 });
                
                gameLayer.addChild(graphics);
              }
            }
          }
        }
        
        // Game over overlay
        if (gameOverRef.current) {
          uiLayer.removeChildren();
          const overlay = new Graphics();
          overlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
          overlay.fill({ color: 0x000000, alpha: 0.7 });
          uiLayer.addChild(overlay);
          
          const gameOverText = new Text({
            text: 'GAME OVER',
            style: new TextStyle({
              fontSize: 18,
              fontWeight: 'bold',
              fill: 0xef4444,
            }),
          });
          gameOverText.anchor.set(0.5);
          gameOverText.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2);
          uiLayer.addChild(gameOverText);
        }
      });
    };
    
    initPixi();
    
    return () => {
      mounted = false;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, []);

  const canMoveFunc = useCallback((piece: number[][], pos: Position, boardState: Board): boolean => {
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

  const resetGame = useCallback(() => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
    boardRef.current = createEmptyBoard();
    currentPieceRef.current = getRandomPiece();
    positionRef.current = { x: 4, y: 0 };
    scoreRef.current = 0;
    setScore(0);
    gameOverRef.current = false;
    setGameOver(false);
    gameStartedRef.current = true;
    linesClearingRef.current = [];
    
    if (appRef.current) {
      const uiLayer = appRef.current.stage.children.find(c => c.label === 'ui');
      if (uiLayer) uiLayer.removeChildren();
    }
  }, []);

  useEffect(() => {
    if (isPlaying) {
      resetGame();
    } else {
      gameStartedRef.current = false;
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

  const placePiece = useCallback(() => {
    const currentPiece = currentPieceRef.current;
    const position = positionRef.current;
    if (!currentPiece || gameOverRef.current) return;

    const newBoard = boardRef.current.map(row => [...row]) as Board;
    
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
      linesClearingRef.current = linesToClear;
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
        boardRef.current = clearedBoard;
        linesClearingRef.current = [];

        spawnNewPiece(clearedBoard);
      }, 300);
    } else {
      boardRef.current = newBoard;
      spawnNewPiece(newBoard);
    }
  }, [haptic, play]);

  const spawnNewPiece = (boardState: Board) => {
    const newPiece = getRandomPiece();
    const newPos = { x: 4, y: 0 };
    
    if (!canMoveFunc(newPiece.shape, newPos, boardState)) {
      gameOverRef.current = true;
      setGameOver(true);
      haptic.error();
      play("gameOver");
      onGameEnd(scoreRef.current);
    } else {
      currentPieceRef.current = newPiece;
      positionRef.current = newPos;
    }
  };

  // Game loop
  useEffect(() => {
    if (!isPlaying || gameOverRef.current || !currentPieceRef.current || !gameStartedRef.current || linesClearingRef.current.length > 0) return;

    gameLoopRef.current = window.setInterval(() => {
      if (gameOverRef.current) return;
      
      const currentPiece = currentPieceRef.current;
      const position = positionRef.current;
      if (!currentPiece) return;
      
      if (canMoveFunc(currentPiece.shape, { x: position.x, y: position.y + 1 }, boardRef.current)) {
        positionRef.current = { ...position, y: position.y + 1 };
      } else {
        placePiece();
      }
    }, 500);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPlaying, canMoveFunc, placePiece]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOverRef.current || !currentPieceRef.current || !gameStartedRef.current) return;

      const currentPiece = currentPieceRef.current;
      const position = positionRef.current;

      switch (e.key) {
        case "ArrowLeft":
        case "a":
          if (canMoveFunc(currentPiece.shape, { x: position.x - 1, y: position.y }, boardRef.current)) {
            positionRef.current = { ...position, x: position.x - 1 };
            haptic.light();
            play("move");
          }
          break;
        case "ArrowRight":
        case "d":
          if (canMoveFunc(currentPiece.shape, { x: position.x + 1, y: position.y }, boardRef.current)) {
            positionRef.current = { ...position, x: position.x + 1 };
            haptic.light();
            play("move");
          }
          break;
        case "ArrowDown":
        case "s":
          if (canMoveFunc(currentPiece.shape, { x: position.x, y: position.y + 1 }, boardRef.current)) {
            positionRef.current = { ...position, y: position.y + 1 };
          }
          break;
        case "ArrowUp":
        case "w":
          const rotated = rotatePiece(currentPiece.shape);
          if (canMoveFunc(rotated, position, boardRef.current)) {
            currentPieceRef.current = { ...currentPiece, shape: rotated };
            haptic.light();
            play("rotate");
          }
          break;
        case " ":
          let newY = position.y;
          while (canMoveFunc(currentPiece.shape, { x: position.x, y: newY + 1 }, boardRef.current)) {
            newY++;
          }
          positionRef.current = { ...position, y: newY };
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, canMoveFunc, rotatePiece, haptic, play]);

  const handleRotate = useCallback(() => {
    if (!currentPieceRef.current || !gameStartedRef.current || gameOverRef.current) return;
    const rotated = rotatePiece(currentPieceRef.current.shape);
    if (canMoveFunc(rotated, positionRef.current, boardRef.current)) {
      currentPieceRef.current = { ...currentPieceRef.current, shape: rotated };
      haptic.light();
      play("rotate");
    }
  }, [canMoveFunc, rotatePiece, haptic, play]);

  const handleMoveLeft = useCallback(() => {
    if (!currentPieceRef.current || !gameStartedRef.current || gameOverRef.current) return;
    if (canMoveFunc(currentPieceRef.current.shape, { x: positionRef.current.x - 1, y: positionRef.current.y }, boardRef.current)) {
      positionRef.current = { ...positionRef.current, x: positionRef.current.x - 1 };
      haptic.light();
      play("move");
    }
  }, [canMoveFunc, haptic, play]);

  const handleMoveRight = useCallback(() => {
    if (!currentPieceRef.current || !gameStartedRef.current || gameOverRef.current) return;
    if (canMoveFunc(currentPieceRef.current.shape, { x: positionRef.current.x + 1, y: positionRef.current.y }, boardRef.current)) {
      positionRef.current = { ...positionRef.current, x: positionRef.current.x + 1 };
      haptic.light();
      play("move");
    }
  }, [canMoveFunc, haptic, play]);

  const handleHardDrop = useCallback(() => {
    if (!currentPieceRef.current || !gameStartedRef.current || gameOverRef.current) return;
    let newY = positionRef.current.y;
    while (canMoveFunc(currentPieceRef.current.shape, { x: positionRef.current.x, y: newY + 1 }, boardRef.current)) {
      newY++;
    }
    positionRef.current = { ...positionRef.current, y: newY };
    haptic.heavy();
  }, [canMoveFunc, haptic]);

  return (
    <div className="flex flex-col items-center justify-center h-full p-3" style={{ background: "linear-gradient(180deg, #1e1b4b 0%, #0f0f23 100%)" }}>
      {/* Score */}
      <div className="text-xl mb-2 font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">
        Score: {score}
      </div>
      
      {/* PixiJS Game Container */}
      <div 
        ref={containerRef}
        className="rounded-lg border-2 border-purple-500/50 overflow-hidden"
        style={{
          width: GAME_WIDTH,
          height: GAME_HEIGHT,
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
