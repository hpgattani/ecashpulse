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

  // Light mode orbs - slow, gentle movement
  if (theme === 'light') {
    return (
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <motion.div
          className="absolute w-[800px] h-[800px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsla(168, 80%, 70%, 0.25) 0%, transparent 70%)',
            filter: 'blur(100px)',
            top: '-20%',
            left: '-10%',
          }}
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
        />

        <motion.div
          className="absolute w-[700px] h-[700px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsla(270, 70%, 70%, 0.2) 0%, transparent 70%)',
            filter: 'blur(100px)',
            top: '10%',
            right: '-15%',
          }}
          animate={{ x: [0, -25, 0], y: [0, 30, 0] }}
          transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
        />

        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsla(200, 80%, 70%, 0.2) 0%, transparent 70%)',
            filter: 'blur(90px)',
            bottom: '-10%',
            left: '15%',
          }}
          animate={{ x: [0, 20, 0], y: [0, -25, 0] }}
          transition={{ duration: 55, repeat: Infinity, ease: 'linear' }}
        />

        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsla(38, 90%, 70%, 0.15) 0%, transparent 70%)',
            filter: 'blur(80px)',
            bottom: '20%',
            right: '5%',
          }}
          animate={{ x: [0, -15, 0], y: [0, -20, 0] }}
          transition={{ duration: 65, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  // Dark mode orbs - subtle, slow ambient glow
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <motion.div
        className="absolute w-[900px] h-[900px] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsla(168, 80%, 45%, 0.08) 0%, transparent 60%)',
          filter: 'blur(120px)',
          top: '-25%',
          left: '-15%',
        }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
      />

      <motion.div
        className="absolute w-[800px] h-[800px] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsla(270, 70%, 50%, 0.06) 0%, transparent 60%)',
          filter: 'blur(110px)',
          top: '5%',
          right: '-20%',
        }}
        animate={{ x: [0, -35, 0], y: [0, 40, 0] }}
        transition={{ duration: 90, repeat: Infinity, ease: 'linear' }}
      />

      <motion.div
        className="absolute w-[700px] h-[700px] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsla(200, 80%, 50%, 0.05) 0%, transparent 55%)',
          filter: 'blur(100px)',
          top: '40%',
          left: '25%',
        }}
        animate={{ x: [0, 25, 0], y: [0, -30, 0] }}
        transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
      />

      <motion.div
        className="absolute w-[750px] h-[750px] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsla(220, 70%, 40%, 0.06) 0%, transparent 60%)',
          filter: 'blur(110px)',
          bottom: '-15%',
          left: '0%',
        }}
        animate={{ x: [0, 30, 0], y: [0, -25, 0] }}
        transition={{ duration: 85, repeat: Infinity, ease: 'linear' }}
      />

      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsla(160, 70%, 40%, 0.05) 0%, transparent 55%)',
          filter: 'blur(90px)',
          bottom: '10%',
          right: '10%',
        }}
        animate={{ x: [0, -20, 0], y: [0, -20, 0] }}
        transition={{ duration: 75, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
};
