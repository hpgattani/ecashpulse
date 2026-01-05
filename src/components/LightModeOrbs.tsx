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
    
    // Watch for theme changes
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });
    
    return () => observer.disconnect();
  }, []);

  if (!theme) return null;

  // Light mode orbs - vibrant pastel colors
  if (theme === 'light') {
    return (
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Large teal orb - top left */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, hsla(168, 80%, 70%, 0.4) 0%, hsla(168, 80%, 70%, 0) 70%)',
            filter: 'blur(60px)',
            top: '-10%',
            left: '-5%',
          }}
          animate={{
            x: [0, 100, 50, 0],
            y: [0, 50, 100, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Purple orb - top right */}
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, hsla(270, 70%, 70%, 0.4) 0%, hsla(270, 70%, 70%, 0) 70%)',
            filter: 'blur(50px)',
            top: '5%',
            right: '-10%',
          }}
          animate={{
            x: [0, -80, -40, 0],
            y: [0, 80, 40, 0],
            scale: [1, 0.9, 1.05, 1],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Pink orb - center right */}
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full opacity-25"
          style={{
            background: 'radial-gradient(circle, hsla(330, 70%, 75%, 0.35) 0%, hsla(330, 70%, 75%, 0) 70%)',
            filter: 'blur(45px)',
            top: '40%',
            right: '10%',
          }}
          animate={{
            x: [0, -60, 30, 0],
            y: [0, -50, 50, 0],
            scale: [1, 1.15, 0.9, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Blue orb - bottom left */}
        <motion.div
          className="absolute w-[550px] h-[550px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, hsla(200, 80%, 70%, 0.35) 0%, hsla(200, 80%, 70%, 0) 70%)',
            filter: 'blur(55px)',
            bottom: '-5%',
            left: '10%',
          }}
          animate={{
            x: [0, 70, -30, 0],
            y: [0, -60, -30, 0],
            scale: [1, 0.95, 1.1, 1],
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Green orb - center */}
        <motion.div
          className="absolute w-[350px] h-[350px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, hsla(142, 70%, 65%, 0.3) 0%, hsla(142, 70%, 65%, 0) 70%)',
            filter: 'blur(40px)',
            top: '50%',
            left: '40%',
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            x: [0, 50, -50, 0],
            y: [0, -40, 40, 0],
            scale: [1, 1.2, 0.85, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Amber orb - bottom right */}
        <motion.div
          className="absolute w-[450px] h-[450px] rounded-full opacity-25"
          style={{
            background: 'radial-gradient(circle, hsla(38, 90%, 70%, 0.3) 0%, hsla(38, 90%, 70%, 0) 70%)',
            filter: 'blur(50px)',
            bottom: '10%',
            right: '-5%',
          }}
          animate={{
            x: [0, -40, 20, 0],
            y: [0, -30, -60, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: 26,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>
    );
  }

  // Dark mode orbs - deeper, more saturated with glow
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Primary teal orb - top left */}
      <motion.div
        className="absolute w-[700px] h-[700px] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsla(168, 80%, 45%, 0.15) 0%, hsla(168, 80%, 45%, 0) 60%)',
          filter: 'blur(80px)',
          top: '-15%',
          left: '-10%',
        }}
        animate={{
          x: [0, 80, 40, 0],
          y: [0, 60, 120, 0],
          scale: [1, 1.15, 0.9, 1],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Purple/violet orb - top right */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsla(270, 70%, 50%, 0.12) 0%, hsla(270, 70%, 50%, 0) 60%)',
          filter: 'blur(70px)',
          top: '0%',
          right: '-15%',
        }}
        animate={{
          x: [0, -100, -50, 0],
          y: [0, 100, 50, 0],
          scale: [1, 0.85, 1.1, 1],
        }}
        transition={{
          duration: 35,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Cyan orb - center */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsla(200, 80%, 50%, 0.1) 0%, hsla(200, 80%, 50%, 0) 55%)',
          filter: 'blur(60px)',
          top: '35%',
          left: '30%',
        }}
        animate={{
          x: [0, 60, -40, 0],
          y: [0, -50, 60, 0],
          scale: [1, 1.2, 0.8, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Deep blue orb - bottom left */}
      <motion.div
        className="absolute w-[650px] h-[650px] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsla(220, 70%, 40%, 0.12) 0%, hsla(220, 70%, 40%, 0) 60%)',
          filter: 'blur(75px)',
          bottom: '-10%',
          left: '5%',
        }}
        animate={{
          x: [0, 90, -45, 0],
          y: [0, -80, -40, 0],
          scale: [1, 0.9, 1.15, 1],
        }}
        transition={{
          duration: 32,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Magenta orb - right side */}
      <motion.div
        className="absolute w-[450px] h-[450px] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsla(300, 60%, 45%, 0.08) 0%, hsla(300, 60%, 45%, 0) 55%)',
          filter: 'blur(55px)',
          top: '50%',
          right: '5%',
        }}
        animate={{
          x: [0, -70, 35, 0],
          y: [0, -60, 70, 0],
          scale: [1, 1.1, 0.85, 1],
        }}
        transition={{
          duration: 28,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Emerald accent orb - bottom right */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full"
        style={{
          background: 'radial-gradient(circle, hsla(160, 70%, 40%, 0.1) 0%, hsla(160, 70%, 40%, 0) 55%)',
          filter: 'blur(50px)',
          bottom: '5%',
          right: '20%',
        }}
        animate={{
          x: [0, -50, 25, 0],
          y: [0, -40, -80, 0],
          scale: [1, 1.15, 0.9, 1],
        }}
        transition={{
          duration: 24,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
};
