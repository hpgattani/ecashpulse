import { useEffect, useState, useRef } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isAnimating, setIsAnimating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const stored = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.classList.toggle('light', stored === 'light');
      document.documentElement.classList.toggle('dark', stored === 'dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isAnimating) return;

    const newTheme = theme === 'dark' ? 'light' : 'dark';

    // Fast path for reduced motion / low-power devices
    if (reduceMotion) {
      setTheme(newTheme);
      localStorage.setItem('theme', newTheme);
      document.documentElement.classList.toggle('light', newTheme === 'light');
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
      return;
    }

    setIsAnimating(true);

    // Create liquid glass brush stroke overlay (lighter for performance)
    const overlay = document.createElement('div');
    const glowColor = '166, 100%, 50%';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 9999;
      pointer-events: none;
      background: ${newTheme === 'light'
        ? 'linear-gradient(135deg, hsla(210, 40%, 98%, 0.88), hsla(210, 40%, 96%, 0.92))'
        : 'linear-gradient(135deg, hsla(220, 20%, 6%, 0.88), hsla(220, 20%, 4%, 0.92))'};
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      clip-path: polygon(-20% 0, -20% 0, -20% 100%, -40% 100%);
      will-change: clip-path;
      contain: paint;
      transition: clip-path 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: inset 0 0 60px hsla(${glowColor}, 0.12);
    `;
    document.body.appendChild(overlay);

    // Create edge glow effect (reduced blur)
    const edgeGlow = document.createElement('div');
    edgeGlow.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
      pointer-events: none;
      background: linear-gradient(
        115deg,
        transparent 0%,
        hsla(${glowColor}, 0.35) 46%,
        hsla(${glowColor}, 0.55) 50%,
        hsla(${glowColor}, 0.35) 54%,
        transparent 100%
      );
      clip-path: polygon(-20% 0, -5% 0, -5% 100%, -25% 100%);
      will-change: clip-path;
      contain: paint;
      transition: clip-path 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      filter: blur(4px);
    `;
    document.body.appendChild(edgeGlow);

    // Start the diagonal wipe animation
    requestAnimationFrame(() => {
      overlay.style.clipPath = 'polygon(0 0, 120% 0, 100% 100%, -20% 100%)';
      edgeGlow.style.clipPath = 'polygon(0 0, 135% 0, 115% 100%, -20% 100%)';
    });

    // Apply theme change early (feels snappier)
    setTimeout(() => {
      setTheme(newTheme);
      localStorage.setItem('theme', newTheme);
      document.documentElement.classList.toggle('light', newTheme === 'light');
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
    }, 120);

    // Slide overlay off screen
    setTimeout(() => {
      overlay.style.transition = 'clip-path 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
      edgeGlow.style.transition = 'clip-path 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
      overlay.style.clipPath = 'polygon(100% 0, 120% 0, 100% 100%, 80% 100%)';
      edgeGlow.style.clipPath = 'polygon(115% 0, 135% 0, 115% 100%, 95% 100%)';
    }, 220);

    // Cleanup
    setTimeout(() => {
      overlay.remove();
      edgeGlow.remove();
      setIsAnimating(false);
    }, 420);
  };

  return (
    <Button
      ref={buttonRef}
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      disabled={isAnimating}
      className="relative w-9 h-9 rounded-full hover:bg-primary/10 dark:hover:bg-primary/10 overflow-hidden"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <AnimatePresence mode="wait">
        {theme === 'dark' ? (
          <motion.div
            key="moon"
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 90 }}
            transition={{ duration: 0.15 }}
          >
            <Moon className="w-4 h-4" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ scale: 0, rotate: 90 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: -90 }}
            transition={{ duration: 0.15 }}
          >
            <Sun className="w-4 h-4" />
          </motion.div>
        )}
      </AnimatePresence>
    </Button>
  );
};