import { useEffect, useState, useRef } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isAnimating, setIsAnimating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
    setIsAnimating(true);
    
    // Create diagonal brush stroke overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 9999;
      pointer-events: none;
      background: ${newTheme === 'light' ? 'hsl(210 40% 98%)' : 'hsl(220 20% 4%)'};
      clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
      transition: clip-path 0.6s cubic-bezier(0.65, 0, 0.35, 1);
    `;
    document.body.appendChild(overlay);
    
    // Start the diagonal wipe animation
    requestAnimationFrame(() => {
      // Brush stroke sweeps from left to right with a slight angle
      overlay.style.clipPath = 'polygon(0 0, 115% 0, 100% 100%, -15% 100%)';
    });
    
    // Apply theme change when brush is at ~40% (visible transition point)
    setTimeout(() => {
      setTheme(newTheme);
      localStorage.setItem('theme', newTheme);
      document.documentElement.classList.toggle('light', newTheme === 'light');
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
    }, 240);
    
    // Slide the overlay off screen to reveal new theme
    setTimeout(() => {
      overlay.style.transition = 'clip-path 0.4s cubic-bezier(0.65, 0, 0.35, 1)';
      overlay.style.clipPath = 'polygon(100% 0, 115% 0, 100% 100%, 85% 100%)';
    }, 350);
    
    // Remove overlay after animation
    setTimeout(() => {
      overlay.remove();
      setIsAnimating(false);
    }, 750);
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