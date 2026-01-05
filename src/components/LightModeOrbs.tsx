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

  // Light mode orbs
  if (theme === 'light') {
    return (
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle at center, hsla(168, 85%, 65%, 0.4) 0%, hsla(168, 85%, 65%, 0.1) 40%, transparent 70%)',
            top: '-15%',
            left: '-5%',
          }}
          animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 40, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle at center, hsla(270, 75%, 70%, 0.35) 0%, hsla(270, 75%, 70%, 0.1) 40%, transparent 70%)',
            top: '5%',
            right: '-10%',
          }}
          animate={{ x: [0, -40, 0], y: [0, 50, 0] }}
          transition={{ duration: 50, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div
          className="absolute w-[550px] h-[550px] rounded-full"
          style={{
            background: 'radial-gradient(circle at center, hsla(200, 80%, 65%, 0.3) 0%, hsla(200, 80%, 65%, 0.08) 40%, transparent 70%)',
            bottom: '-5%',
            left: '10%',
          }}
          animate={{ x: [0, 35, 0], y: [0, -40, 0] }}
          transition={{ duration: 45, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle at center, hsla(330, 70%, 70%, 0.25) 0%, hsla(330, 70%, 70%, 0.06) 40%, transparent 70%)',
            bottom: '15%',
            right: '5%',
          }}
          animate={{ x: [0, -30, 0], y: [0, -35, 0] }}
          transition={{ duration: 55, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    );
  }

  // Dark mode orbs - more visible, cleaner gradients
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Primary teal glow - top left */}
      <motion.div
        className="absolute w-[700px] h-[700px] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, hsla(168, 80%, 50%, 0.2) 0%, hsla(168, 80%, 50%, 0.05) 50%, transparent 70%)',
          top: '-20%',
          left: '-10%',
        }}
        animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 50, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Purple glow - top right */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, hsla(270, 70%, 55%, 0.18) 0%, hsla(270, 70%, 55%, 0.04) 50%, transparent 70%)',
          top: '0%',
          right: '-15%',
        }}
        animate={{ x: [0, -50, 0], y: [0, 60, 0] }}
        transition={{ duration: 60, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Blue glow - center bottom */}
      <motion.div
        className="absolute w-[650px] h-[650px] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, hsla(210, 80%, 50%, 0.15) 0%, hsla(210, 80%, 50%, 0.03) 50%, transparent 70%)',
          bottom: '-15%',
          left: '20%',
        }}
        animate={{ x: [0, 45, 0], y: [0, -35, 0] }}
        transition={{ duration: 55, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Accent teal - right side */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle at center, hsla(175, 75%, 45%, 0.15) 0%, hsla(175, 75%, 45%, 0.03) 50%, transparent 70%)',
          top: '35%',
          right: '0%',
        }}
        animate={{ x: [0, -40, 0], y: [0, 50, 0] }}
        transition={{ duration: 45, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
};
