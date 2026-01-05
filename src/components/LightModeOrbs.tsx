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

  // Light mode - liquid glass aesthetic
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
        
        {/* Frosted glass layer */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, hsla(200, 30%, 98%, 0.6) 0%, hsla(210, 20%, 95%, 0.3) 50%, hsla(200, 25%, 97%, 0.5) 100%)',
            backdropFilter: 'blur(100px)',
          }}
        />
        
        {/* Teal liquid glow - left side */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 20% 5%, hsla(168, 75%, 55%, 0.25) 0%, hsla(168, 70%, 50%, 0.1) 30%, transparent 60%)',
            filter: 'blur(40px)',
          }}
        />
        
        {/* Secondary teal accent */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 50% 40% at 10% 30%, hsla(166, 80%, 50%, 0.15) 0%, transparent 50%)',
            filter: 'blur(30px)',
          }}
        />
        
        {/* Purple liquid glow - right side */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 80% 5%, hsla(270, 70%, 60%, 0.2) 0%, hsla(270, 65%, 55%, 0.08) 30%, transparent 60%)',
            filter: 'blur(40px)',
          }}
        />
        
        {/* Glass reflection highlight */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(165deg, hsla(0, 0%, 100%, 0.4) 0%, transparent 20%, transparent 80%, hsla(0, 0%, 100%, 0.1) 100%)',
          }}
        />
      </div>
    );
  }

  // Dark mode - teal + purple glows with subtle grid
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
      
      {/* Teal glow - left side (original position) */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 100% 60% at 15% -5%, hsla(168, 80%, 45%, 0.25) 0%, transparent 60%)',
        }}
      />
      
      {/* Purple glow - right side (original position) */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 100% 60% at 85% -5%, hsla(270, 80%, 45%, 0.25) 0%, transparent 60%)',
        }}
      />
      
      {/* Bottom accent - wider spread */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 100% 45% at 50% 105%, hsla(200, 70%, 50%, 0.1) 0%, transparent 55%)',
        }}
      />
    </div>
  );
};
