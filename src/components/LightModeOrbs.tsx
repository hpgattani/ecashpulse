import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | null;

export const LightModeOrbs = () => {
  const [theme, setTheme] = useState<Theme>(null);

  useEffect(() => {
    const checkTheme = () => {
      if (document.documentElement.classList.contains('light')) {
        setTheme('light');
      } else {
        setTheme('dark');
      }
    };
    
    checkTheme();
    
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });
    
    return () => observer.disconnect();
  }, []);

  if (!theme) return null;

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 bg-grid-pattern bg-grid"
        style={{
          opacity: theme === 'light' ? 0.4 : 0.25,
        }}
      />
      
      {/* Liquid glass gradient overlays */}
      {theme === 'light' ? (
        <>
          {/* Light mode - soft colored glass overlays */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 80% 60% at 20% 10%, hsla(168, 80%, 70%, 0.15) 0%, transparent 50%)',
            }}
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 70% 50% at 80% 20%, hsla(270, 70%, 75%, 0.12) 0%, transparent 50%)',
            }}
            animate={{ opacity: [1, 0.7, 1] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 60% 40% at 30% 90%, hsla(200, 80%, 70%, 0.1) 0%, transparent 45%)',
            }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      ) : (
        <>
          {/* Dark mode - deeper colored glass overlays */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 80% 60% at 15% 5%, hsla(168, 80%, 50%, 0.12) 0%, transparent 50%)',
            }}
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 70% 50% at 85% 15%, hsla(270, 70%, 55%, 0.1) 0%, transparent 50%)',
            }}
            animate={{ opacity: [1, 0.7, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 60% 45% at 25% 85%, hsla(200, 80%, 50%, 0.08) 0%, transparent 45%)',
            }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 50% 35% at 75% 80%, hsla(168, 70%, 45%, 0.06) 0%, transparent 40%)',
            }}
            animate={{ opacity: [0.9, 0.6, 0.9] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}
      
      {/* Top glass sheen effect */}
      <div 
        className="absolute inset-x-0 top-0 h-[40vh]"
        style={{
          background: theme === 'light' 
            ? 'linear-gradient(180deg, hsla(0, 0%, 100%, 0.4) 0%, transparent 100%)'
            : 'linear-gradient(180deg, hsla(220, 20%, 10%, 0.3) 0%, transparent 100%)',
        }}
      />
    </div>
  );
};
