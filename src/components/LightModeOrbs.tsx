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

  // Light mode - circular orbs
  if (theme === 'light') {
    return (
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Soft gradient background */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(180deg, hsl(200 30% 97%) 0%, hsl(210 25% 95%) 50%, hsl(200 20% 96%) 100%)',
          }}
        />
        
        {/* Subtle grid */}
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-30" />
        
        {/* Teal circular orb - positioned at top-left (matching dark mode diagonal placement) */}
        <div 
          className="absolute opacity-60 md:opacity-100"
          style={{
            width: '600px',
            height: '600px',
            left: '-150px',
            top: '-150px',
            background: 'radial-gradient(circle, hsla(168, 70%, 55%, 0.3) 0%, hsla(168, 65%, 50%, 0.12) 40%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(20px)',
          }}
        />
        
        {/* Purple circular orb - positioned at bottom-right (matching dark mode diagonal placement) */}
        <div 
          className="absolute opacity-60 md:opacity-100"
          style={{
            width: '600px',
            height: '600px',
            right: '-150px',
            top: '200px',
            background: 'radial-gradient(circle, hsla(270, 65%, 60%, 0.25) 0%, hsla(270, 60%, 55%, 0.1) 40%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(20px)',
          }}
        />
      </div>
    );
  }

  // Dark mode - teal + purple circular orbs positioned diagonally (A and C corners)
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Base dark */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'hsl(222 25% 6%)',
        }}
      />
      
      {/* Subtle grid lines */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-15" />
      
      {/* Teal circular orb - positioned at top-left (corner A, near "Predict") */}
      <div 
        className="absolute opacity-50 md:opacity-100"
        style={{
          width: '800px',
          height: '800px',
          left: '-150px',
          top: '-150px',
          background: 'radial-gradient(circle, hsla(170, 90%, 45%, 0.55) 0%, hsla(170, 85%, 40%, 0.25) 30%, hsla(170, 80%, 35%, 0.08) 50%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(40px)',
        }}
      />
      
      {/* Purple/violet circular orb - positioned at bottom-right (corner C, near "Confidence") */}
      <div 
        className="absolute opacity-50 md:opacity-100"
        style={{
          width: '800px',
          height: '800px',
          right: '-150px',
          top: '200px',
          background: 'radial-gradient(circle, hsla(280, 75%, 58%, 0.5) 0%, hsla(275, 70%, 52%, 0.22) 30%, hsla(270, 65%, 48%, 0.07) 50%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(40px)',
        }}
      />
      
      {/* Subtle center gradient for depth */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 30%, hsla(200, 60%, 40%, 0.06) 0%, transparent 60%)',
        }}
      />
    </div>
  );
};
