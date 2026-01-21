import { useState, useEffect, useCallback, useRef } from "react";

interface SnakeGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const INITIAL_SPEED = 150;

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Position = { x: number; y: number };

const SnakeGame = ({ onGameEnd, isPlaying }: SnakeGameProps) => {
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Direction>("RIGHT");
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const gameLoopRef = useRef<number | null>(null);
  const directionRef = useRef<Direction>("RIGHT");

  const generateFood = useCallback((): Position => {
    return {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  }, []);

  const resetGame = useCallback(() => {
    setSnake([{ x: 10, y: 10 }]);
    setFood(generateFood());
    setDirection("RIGHT");
    directionRef.current = "RIGHT";
    setScore(0);
    setGameOver(false);
  }, [generateFood]);

  useEffect(() => {
    if (isPlaying) {
      resetGame();
    }
  }, [isPlaying, resetGame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOver) return;

      switch (e.key) {
        case "ArrowUp":
        case "w":
          if (directionRef.current !== "DOWN") {
            directionRef.current = "UP";
            setDirection("UP");
          }
          break;
        case "ArrowDown":
        case "s":
          if (directionRef.current !== "UP") {
            directionRef.current = "DOWN";
            setDirection("DOWN");
          }
          break;
        case "ArrowLeft":
        case "a":
          if (directionRef.current !== "RIGHT") {
            directionRef.current = "LEFT";
            setDirection("LEFT");
          }
          break;
        case "ArrowRight":
        case "d":
          if (directionRef.current !== "LEFT") {
            directionRef.current = "RIGHT";
            setDirection("RIGHT");
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, gameOver]);

  useEffect(() => {
    if (!isPlaying || gameOver) return;

    const moveSnake = () => {
      setSnake((prevSnake) => {
        const head = { ...prevSnake[0] };

        switch (directionRef.current) {
          case "UP":
            head.y -= 1;
            break;
          case "DOWN":
            head.y += 1;
            break;
          case "LEFT":
            head.x -= 1;
            break;
          case "RIGHT":
            head.x += 1;
            break;
        }

        // Check wall collision
        if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
          setGameOver(true);
          onGameEnd(score);
          return prevSnake;
        }

        // Check self collision
        if (prevSnake.some((segment) => segment.x === head.x && segment.y === head.y)) {
          setGameOver(true);
          onGameEnd(score);
          return prevSnake;
        }

        const newSnake = [head, ...prevSnake];

        // Check food collision
        if (head.x === food.x && head.y === food.y) {
          setScore((s) => s + 10);
          setFood(generateFood());
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    };

    gameLoopRef.current = window.setInterval(moveSnake, INITIAL_SPEED - Math.min(score, 100));

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPlaying, gameOver, food, score, onGameEnd, generateFood]);

  // Touch controls for mobile
  const handleTouch = (newDirection: Direction) => {
    if (!isPlaying || gameOver) return;
    
    if (
      (newDirection === "UP" && directionRef.current !== "DOWN") ||
      (newDirection === "DOWN" && directionRef.current !== "UP") ||
      (newDirection === "LEFT" && directionRef.current !== "RIGHT") ||
      (newDirection === "RIGHT" && directionRef.current !== "LEFT")
    ) {
      directionRef.current = newDirection;
      setDirection(newDirection);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-gray-900 p-4">
      <div className="text-white text-xl mb-4 font-bold">Score: {score}</div>
      
      <div
        className="relative border-2 border-primary"
        style={{
          width: GRID_SIZE * CELL_SIZE,
          height: GRID_SIZE * CELL_SIZE,
          backgroundColor: "#1a1a2e",
        }}
      >
        {/* Snake */}
        {snake.map((segment, index) => (
          <div
            key={index}
            className={`absolute rounded-sm ${index === 0 ? "bg-primary" : "bg-primary/70"}`}
            style={{
              left: segment.x * CELL_SIZE,
              top: segment.y * CELL_SIZE,
              width: CELL_SIZE - 2,
              height: CELL_SIZE - 2,
            }}
          />
        ))}

        {/* Food */}
        <div
          className="absolute bg-red-500 rounded-full"
          style={{
            left: food.x * CELL_SIZE,
            top: food.y * CELL_SIZE,
            width: CELL_SIZE - 2,
            height: CELL_SIZE - 2,
          }}
        />
      </div>

      {/* Mobile controls */}
      <div className="mt-4 grid grid-cols-3 gap-2 md:hidden">
        <div />
        <button
          onClick={() => handleTouch("UP")}
          className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center text-2xl"
        >
          ↑
        </button>
        <div />
        <button
          onClick={() => handleTouch("LEFT")}
          className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center text-2xl"
        >
          ←
        </button>
        <button
          onClick={() => handleTouch("DOWN")}
          className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center text-2xl"
        >
          ↓
        </button>
        <button
          onClick={() => handleTouch("RIGHT")}
          className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center text-2xl"
        >
          →
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-4 hidden md:block">
        Use arrow keys or WASD to move
      </p>
    </div>
  );
};

export default SnakeGame;