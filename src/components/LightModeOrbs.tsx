import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export const LightModeOrbs = () => {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      setIsLight(document.documentElement.classList.contains('light'));
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

  if (!isLight) return null;

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
};
