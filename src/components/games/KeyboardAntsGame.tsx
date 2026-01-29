import { useState, useEffect, useCallback, useRef } from "react";
import { useHaptic } from "@/hooks/useHaptic";
import useGameSounds from "@/hooks/useGameSounds";

interface KeyboardAntsGameProps {
  onGameEnd: (score: number) => void;
  isPlaying: boolean;
}

// QWERTY keyboard layout
const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

// Common 5-letter words by starting letter
const WORDS_5: Record<string, string[]> = {
  A: ['APPLE', 'ANGEL', 'ANGRY', 'ASSET', 'AWARD', 'ALARM', 'ALBUM', 'ABOVE', 'ABUSE', 'ADULT'],
  B: ['BEACH', 'BRAIN', 'BRAVE', 'BREAD', 'BREAK', 'BRIEF', 'BROWN', 'BUILT', 'BUNCH', 'BURST'],
  C: ['CHAIN', 'CHAIR', 'CHEAP', 'CHECK', 'CHESS', 'CHIEF', 'CHILD', 'CHINA', 'CLAIM', 'CLASS'],
  D: ['DANCE', 'DEATH', 'DELAY', 'DEPTH', 'DISCO', 'DOUBT', 'DRAFT', 'DRAIN', 'DRAMA', 'DREAM'],
  E: ['EAGER', 'EARLY', 'EARTH', 'EMPTY', 'ENEMY', 'ENJOY', 'ENTER', 'ENTRY', 'EQUAL', 'ERROR'],
  F: ['FAITH', 'FALSE', 'FANCY', 'FAULT', 'FEAST', 'FIELD', 'FIGHT', 'FINAL', 'FIRST', 'FLAME'],
  G: ['GAMES', 'GHOST', 'GIANT', 'GIVEN', 'GLASS', 'GLOBE', 'GLORY', 'GOING', 'GRACE', 'GRAIN'],
  H: ['HABIT', 'HAPPY', 'HEART', 'HEAVY', 'HELLO', 'HELPS', 'HENCE', 'HONEY', 'HORSE', 'HOTEL'],
  I: ['IDEAL', 'IMAGE', 'INDEX', 'INNER', 'INPUT', 'INTRO', 'ISSUE', 'ITEMS', 'IVORY', 'INBOX'],
  J: ['JAPAN', 'JELLY', 'JEWEL', 'JOINT', 'JOKES', 'JUDGE', 'JUICE', 'JUMBO', 'JUMPS', 'JUICY'],
  K: ['KARMA', 'KAYAK', 'KEEPS', 'KETCH', 'KICKS', 'KINDS', 'KINGS', 'KNIFE', 'KNOCK', 'KNOWN'],
  L: ['LABEL', 'LABOR', 'LARGE', 'LASER', 'LATER', 'LAUGH', 'LAYER', 'LEARN', 'LEAST', 'LEAVE'],
  M: ['MAGIC', 'MAJOR', 'MAKER', 'MARCH', 'MATCH', 'MAYBE', 'MAYOR', 'MEANT', 'MEDIA', 'MERCY'],
  N: ['NAIVE', 'NAMES', 'NASTY', 'NAVAL', 'NEEDS', 'NERVE', 'NEVER', 'NEWER', 'NIGHT', 'NOISE'],
  O: ['OCCUR', 'OCEAN', 'OFFER', 'OFTEN', 'OLIVE', 'ONION', 'OPENS', 'OPERA', 'ORDER', 'ORGAN'],
  P: ['PAINT', 'PANIC', 'PAPER', 'PARTY', 'PATCH', 'PEACE', 'PEARL', 'PENNY', 'PHASE', 'PHONE'],
  Q: ['QUACK', 'QUEEN', 'QUERY', 'QUEST', 'QUEUE', 'QUICK', 'QUIET', 'QUILT', 'QUIRK', 'QUITE'],
  R: ['RADAR', 'RADIO', 'RAISE', 'RANCH', 'RANGE', 'RAPID', 'RATIO', 'REACH', 'REACT', 'READY'],
  S: ['SAINT', 'SALAD', 'SCALE', 'SCARE', 'SCENE', 'SCOPE', 'SCORE', 'SCREW', 'SENSE', 'SERVE'],
  T: ['TABLE', 'TAKEN', 'TASTE', 'TEACH', 'TEETH', 'TEMPO', 'THANK', 'THEME', 'THICK', 'THINK'],
  U: ['ULTRA', 'UNCLE', 'UNDER', 'UNIFY', 'UNION', 'UNITE', 'UNITY', 'UNTIL', 'UPPER', 'URBAN'],
  V: ['VAGUE', 'VALID', 'VALUE', 'VALVE', 'VAPOR', 'VAULT', 'VENUE', 'VERSE', 'VIDEO', 'VINYL'],
  W: ['WAGES', 'WAGON', 'WATCH', 'WATER', 'WAVES', 'WEARY', 'WHEAT', 'WHEEL', 'WHERE', 'WHITE'],
  X: ['XEROX', 'XENIA', 'XENON', 'XYLAN', 'XEBEC', 'XERIC', 'XINCA', 'XYLEM', 'XYLON', 'XYSTS'],
  Y: ['YACHT', 'YARDS', 'YEARN', 'YEAST', 'YIELD', 'YOUNG', 'YOURS', 'YOUTH', 'YUMMY', 'YODEL'],
  Z: ['ZEBRA', 'ZESTY', 'ZLOTY', 'ZONES', 'ZOMBI', 'ZOOMS', 'ZIPPY', 'ZILCH', 'ZONAL', 'ZINGS'],
};

// Common 7-letter words by starting letter
const WORDS_7: Record<string, string[]> = {
  A: ['AWESOME', 'ANCIENT', 'ANIMALS', 'ADVANCE', 'AMAZING', 'ACCOUNT', 'ACHIEVE', 'ACQUIRE'],
  B: ['BALANCE', 'BANKING', 'BARRIER', 'BATTERY', 'BEACHES', 'BECOMES', 'BELIEVE', 'BENEFITS'],
  C: ['CABINET', 'CAMPING', 'CAPTAIN', 'CAPTURE', 'CAREFUL', 'CARRIER', 'CENTRAL', 'CENTURY'],
  D: ['DANCING', 'DEALING', 'DECIDED', 'DECLARE', 'DEFENSE', 'DELIVER', 'DEPOSIT', 'DESKTOP'],
  E: ['EARLIER', 'EARNING', 'EASTERN', 'ECONOMY', 'EDITION', 'EFFECTS', 'ELDERLY', 'ELEMENT'],
  F: ['FABRICS', 'FACTORY', 'FAILING', 'FALLING', 'FASHION', 'FASTEST', 'FATHERS', 'FEATURE'],
  G: ['GALLERY', 'GARBAGE', 'GARDENS', 'GATEWAY', 'GENERAL', 'GENUINE', 'GERMANY', 'GETTING'],
  H: ['HABITAT', 'HACKERS', 'HALTING', 'HANDLER', 'HANGING', 'HAPPENS', 'HAPPIER', 'HARMFUL'],
  I: ['IMAGINE', 'IMPACTS', 'IMPROVE', 'INCLUDE', 'INDEXED', 'INITIAL', 'INSIGHT', 'INSTALL'],
  J: ['JACKETS', 'JANUARY', 'JEALOUS', 'JERSEYS', 'JEWELRY', 'JOINING', 'JOURNAL', 'JOURNEY'],
  K: ['KEEPING', 'KERNELS', 'KETCHUP', 'KEYWORD', 'KICKERS', 'KIDDING', 'KILLING', 'KINGDOM'],
  L: ['LANDING', 'LARGEST', 'LASTING', 'LATERAL', 'LAUGHTER', 'LAWYERS', 'LEADING', 'LEARNED'],
  M: ['MACHINE', 'MADNESS', 'MAGICAL', 'MAILBOX', 'MANAGER', 'MANKIND', 'MANSION', 'MAPPING'],
  N: ['NATIONS', 'NATURAL', 'NEAREST', 'NERVOUS', 'NETWORK', 'NEUTRAL', 'NEWBORN', 'NOTHING'],
  O: ['OBJECTS', 'OBSERVE', 'OBVIOUS', 'OCTOBER', 'OFFENSE', 'OFFERED', 'OFFICER', 'OPINION'],
  P: ['PACIFIC', 'PACKAGE', 'PAINFUL', 'PAINTED', 'PARKING', 'PARTIAL', 'PARTNER', 'PASSAGE'],
  Q: ['QUALIFY', 'QUALITY', 'QUANTUM', 'QUARTER', 'QUERIES', 'QUICKER', 'QUICKLY', 'QUIETER'],
  R: ['RADICAL', 'RAILWAY', 'RAINBOW', 'RAISING', 'RANGERS', 'RANKING', 'READING', 'REALITY'],
  S: ['SAILING', 'SAVINGS', 'SCALING', 'SCANNER', 'SCENERY', 'SCHOOLS', 'SCIENCE', 'SCORING'],
  T: ['TABLETS', 'TACTICS', 'TALKING', 'TEACHER', 'TEAMING', 'TELLING', 'TEMPLES', 'TESTING'],
  U: ['UPGRADE', 'UPLOADS', 'URANIUM', 'USEABLE', 'USUALLY', 'UTILITY', 'UTOPIAN', 'UNIFIED'],
  V: ['VACANCY', 'VACCINE', 'VARIETY', 'VARIOUS', 'VENDORS', 'VENTURE', 'VERSION', 'VIBRANT'],
  W: ['WAITING', 'WALKING', 'WARNING', 'WASHING', 'WASTING', 'WATCHES', 'WEALTHY', 'WEATHER'],
  X: ['XEROXED', 'XYLOPHONES'],
  Y: ['YANKEES', 'YELLING', 'YOUNGER', 'YOURSEL', 'YOUTUBE', 'YAWNING', 'YIELDED', 'YOGHURT'],
  Z: ['ZEALAND', 'ZEALOUS', 'ZENLIKE', 'ZEPHYRS', 'ZEROING', 'ZIPPERS', 'ZODIACS', 'ZOMBIES'],
};

const KeyboardAntsGame = ({ onGameEnd, isPlaying }: KeyboardAntsGameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [antKey, setAntKey] = useState('A');
  const [typedWord, setTypedWord] = useState('');
  const [requiredLength, setRequiredLength] = useState(5);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameOver, setGameOver] = useState(false);
  const [combo, setCombo] = useState(0);
  const [message, setMessage] = useState('');
  
  // Avoid React re-renders for ant animation (prevents mobile input/caret glitches)
  const rafRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef<number>(0);
  const antKeyRef = useRef<string>('A');
  const isPlayingRef = useRef<boolean>(false);
  
  const scoreRef = useRef(0);
  const gameOverRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const haptic = useHaptic();
  const { play } = useGameSounds();

  // Get a random key from the keyboard
  const getRandomKey = useCallback(() => {
    const allKeys = KEYBOARD_ROWS.flat();
    return allKeys[Math.floor(Math.random() * allKeys.length)];
  }, []);

  // Validate word
  const validateWord = useCallback((word: string, startLetter: string, length: number): boolean => {
    if (word.length !== length) return false;
    if (!word.startsWith(startLetter)) return false;
    
    const wordList = length === 5 ? WORDS_5 : WORDS_7;
    const validWords = wordList[startLetter] || [];
    return validWords.includes(word.toUpperCase());
  }, []);

  // Reset game
  const resetGame = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    scoreRef.current = 0;
    gameOverRef.current = false;
    setScore(0);
    setLevel(1);
    setRequiredLength(5);
    setTimeLeft(30);
    setGameOver(false);
    setTypedWord('');
    setCombo(0);
    setMessage('');
    setAntKey(getRandomKey());
    
    // Start timer
    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          gameOverRef.current = true;
          setGameOver(true);
          haptic.error();
          play("gameOver");
          onGameEnd(scoreRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Ensure the input reliably grabs focus (especially inside modals)
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [getRandomKey, haptic, play, onGameEnd]);

  // Handle word submission
  const handleSubmit = useCallback(() => {
    if (gameOverRef.current) return;
    
    const word = typedWord.toUpperCase();
    if (validateWord(word, antKey, requiredLength)) {
      // Correct word!
      const basePoints = requiredLength === 5 ? 100 : 200;
      const comboMultiplier = 1 + (combo * 0.5);
      const timeBonus = Math.floor(timeLeft * 2);
      const points = Math.floor((basePoints + timeBonus) * comboMultiplier);
      
      scoreRef.current += points;
      setScore(scoreRef.current);
      setCombo(prev => prev + 1);
      setMessage(`+${points} pts!`);
      
      haptic.success();
      play("eat");
      
      // Progress level
      if (scoreRef.current >= level * 500 && requiredLength === 5) {
        setLevel(prev => prev + 1);
        setRequiredLength(7);
        setTimeLeft(prev => Math.min(prev + 15, 45));
        setMessage('Level Up! 7-letter words!');
      } else {
        setTimeLeft(prev => Math.min(prev + 5, 45)); // Bonus time
      }
      
      // New ant position
      setAntKey(getRandomKey());
      setTypedWord('');
    } else {
      // Wrong word
      setCombo(0);
      setMessage('Invalid word!');
      haptic.error();
      setTimeLeft(prev => Math.max(prev - 3, 0)); // Time penalty
    }
    
    setTimeout(() => setMessage(''), 1500);
  }, [typedWord, antKey, requiredLength, combo, timeLeft, level, validateWord, getRandomKey, haptic, play]);

  // Handle input
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (gameOverRef.current) return;
    
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Backspace') {
      // Allow backspace
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      haptic.light();
    }
  }, [handleSubmit, haptic]);

  // Start game when isPlaying changes
  useEffect(() => {
    if (isPlaying) {
      resetGame();
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, resetGame]);

  // Keep refs in sync for the canvas animation loop
  useEffect(() => {
    antKeyRef.current = antKey;
  }, [antKey]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Canvas animation loop (no React state updates)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const keyWidth = 32;
    const keyHeight = 38;
    const keyGap = 4;
    const startY = 30;

    const drawFrame = (t: number) => {
      // Throttle to ~20fps to keep input/caret stable on mobile
      if (t - lastFrameAtRef.current < 50) {
        rafRef.current = requestAnimationFrame(drawFrame);
        return;
      }
      lastFrameAtRef.current = t;

      // Always render a stable frame when visible; avoid depending on React state
      const currentAntKey = antKeyRef.current;
      const wiggle = Math.sin(t * 0.012) * 1.5;
      const legPhase = Math.sin(t * 0.02);

      // Clear
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, width, height);

      KEYBOARD_ROWS.forEach((row, rowIndex) => {
        const rowOffset = rowIndex * 15;
        const rowWidth = row.length * (keyWidth + keyGap);
        const startX = (width - rowWidth) / 2 + rowOffset;

        row.forEach((key, keyIndex) => {
          const x = startX + keyIndex * (keyWidth + keyGap);
          const y = startY + rowIndex * (keyHeight + keyGap);

          const isAntKey = key === currentAntKey;

          // Key shadow
          ctx.fillStyle = "#0a0a15";
          ctx.beginPath();
          ctx.roundRect(x, y + 3, keyWidth, keyHeight, 6);
          ctx.fill();

          // Key background
          const gradient = ctx.createLinearGradient(x, y, x, y + keyHeight);
          if (isAntKey) {
            gradient.addColorStop(0, "#22c55e");
            gradient.addColorStop(1, "#15803d");
          } else {
            gradient.addColorStop(0, "#3b3b5c");
            gradient.addColorStop(1, "#2a2a40");
          }
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, y, keyWidth, keyHeight, 6);
          ctx.fill();

          // Key border
          ctx.strokeStyle = isAntKey ? "#4ade80" : "#4a4a6a";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Key letter
          ctx.fillStyle = isAntKey ? "#fff" : "#c0c0d0";
          ctx.font = "bold 16px Space Grotesk, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(key, x + keyWidth / 2, y + keyHeight / 2);

          if (isAntKey) {
            const antX = x + keyWidth / 2;
            const antY = y - 8;

            // Body
            ctx.fillStyle = "#1a1a2e";
            ctx.beginPath();
            ctx.ellipse(antX - 8 + wiggle, antY, 5, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(antX + wiggle, antY, 6, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(antX + 9 + wiggle, antY, 5, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Legs
            ctx.strokeStyle = "#1a1a2e";
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 3; i++) {
              const legX = antX - 6 + i * 6 + wiggle;
              const legOffset = (i % 2 === 0 ? 1 : -1) * legPhase * 2;
              ctx.beginPath();
              ctx.moveTo(legX, antY + 3);
              ctx.lineTo(legX - 4, antY + 10 + legOffset);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(legX, antY + 3);
              ctx.lineTo(legX + 4, antY + 10 - legOffset);
              ctx.stroke();
            }

            // Antennae
            ctx.beginPath();
            ctx.moveTo(antX + 12 + wiggle, antY - 2);
            ctx.lineTo(antX + 18 + wiggle, antY - 8 + legPhase * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(antX + 12 + wiggle, antY + 2);
            ctx.lineTo(antX + 18 + wiggle, antY + 6 - legPhase * 2);
            ctx.stroke();

            // Eyes
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(antX + 11 + wiggle, antY, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      });

      rafRef.current = requestAnimationFrame(drawFrame);
    };

    rafRef.current = requestAnimationFrame(drawFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  return (
    <div
      className="flex flex-col items-center justify-center h-full p-4"
      style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)" }}
      onPointerDown={() => inputRef.current?.focus()}
    >
      {/* Header */}
      <div className="flex justify-between items-center w-full max-w-md mb-4">
        <div className="text-left">
          <p className="text-xs text-muted-foreground">Score</p>
          <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">
            {score}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Level {level}</p>
          <p className="text-lg font-bold text-primary">{requiredLength} letters</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Time</p>
          <p className={`text-2xl font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
            {timeLeft}s
          </p>
        </div>
      </div>
      
      {/* Combo indicator */}
      {combo > 0 && (
        <div className="text-sm text-amber-400 mb-2">
          🔥 Combo x{combo}
        </div>
      )}
      
      {/* Message */}
      {message && (
        <div className={`text-lg font-bold mb-2 ${message.includes('+') ? 'text-green-400' : message.includes('Level') ? 'text-amber-400' : 'text-red-400'}`}>
          {message}
        </div>
      )}
      
      {/* Keyboard canvas */}
      <canvas
        ref={canvasRef}
        width={380}
        height={180}
        className="rounded-lg border border-primary/30 mb-4"
        style={{ boxShadow: "0 0 20px rgba(34, 197, 94, 0.2)" }}
      />
      
      {/* Instructions */}
      <p className="text-sm text-muted-foreground mb-3">
        Type a {requiredLength}-letter word starting with <span className="text-primary font-bold">{antKey}</span>
      </p>
      
      {/* Input field */}
      <div className="flex gap-2 w-full max-w-sm">
        <input
          ref={inputRef}
          type="text"
          value={typedWord}
          onChange={(e) => setTypedWord(e.target.value.toUpperCase().slice(0, requiredLength))}
          onKeyDown={handleKeyDown}
          disabled={gameOver}
          placeholder={`${antKey}____${requiredLength === 7 ? '__' : ''}`}
          maxLength={requiredLength}
          className="flex-1 px-4 py-3 bg-background/50 border border-primary/30 rounded-lg text-center text-xl font-mono uppercase tracking-widest focus:outline-none focus:border-primary"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          onClick={handleSubmit}
          disabled={gameOver || typedWord.length !== requiredLength}
          className="px-6 py-3 bg-gradient-to-r from-primary to-accent rounded-lg font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          ✓
        </button>
      </div>
      
      {/* Game Over overlay */}
      {gameOver && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg">
          <div className="text-center">
            <p className="text-3xl font-bold text-red-400 mb-2">GAME OVER</p>
            <p className="text-xl text-foreground">Final Score: {score}</p>
          </div>
        </div>
      )}
      
      {/* Hint */}
      <p className="text-xs text-muted-foreground mt-3">
        Press Enter to submit • Valid words only!
      </p>
    </div>
  );
};

export default KeyboardAntsGame;
