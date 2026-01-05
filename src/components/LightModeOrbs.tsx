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
        
        {/* Teal circular orb - left side */}
        <div 
          className="absolute"
          style={{
            width: '500px',
            height: '500px',
            left: '-80px',
            top: '-150px',
            background: 'radial-gradient(circle, hsla(168, 70%, 55%, 0.25) 0%, hsla(168, 65%, 50%, 0.1) 40%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
        
        {/* Purple circular orb - right side */}
        <div 
          className="absolute"
          style={{
            width: '500px',
            height: '500px',
            right: '-80px',
            top: '-150px',
            background: 'radial-gradient(circle, hsla(270, 65%, 60%, 0.2) 0%, hsla(270, 60%, 55%, 0.08) 40%, transparent 70%)',
            borderRadius: '50%',
          }}
        />
      </div>
    );
  }

  // Dark mode - teal + purple circular orbs with subtle grid
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Base dark */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'hsl(220 20% 4%)',
        }}
      />
      
      {/* Subtle grid lines */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-20" />
      
      {/* Teal circular orb - left side */}
      <div 
        className="absolute"
        style={{
          width: '600px',
          height: '600px',
          left: '-100px',
          top: '-200px',
          background: 'radial-gradient(circle, hsla(168, 80%, 45%, 0.35) 0%, hsla(168, 75%, 40%, 0.15) 40%, transparent 70%)',
          borderRadius: '50%',
        }}
      />
      
      {/* Purple circular orb - right side */}
      <div 
        className="absolute"
        style={{
          width: '600px',
          height: '600px',
          right: '-100px',
          top: '-200px',
          background: 'radial-gradient(circle, hsla(270, 75%, 50%, 0.3) 0%, hsla(270, 70%, 45%, 0.12) 40%, transparent 70%)',
          borderRadius: '50%',
        }}
      />
      
      {/* Bottom accent glow */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 100% 45% at 50% 105%, hsla(200, 70%, 50%, 0.1) 0%, transparent 55%)',
        }}
      />
    </div>
  );
};
