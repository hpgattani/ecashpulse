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

  // Light mode
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
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-40" />
        
        {/* Teal glow */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 50% at 30% 10%, hsla(168, 70%, 70%, 0.2) 0%, transparent 50%)',
          }}
        />
        
        {/* Purple glow - increased to match teal */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 75% 45% at 75% 15%, hsla(270, 65%, 70%, 0.22) 0%, transparent 50%)',
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
      
      {/* Teal glow - larger area, top left */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 120% 70% at 15% -5%, hsla(168, 80%, 45%, 0.2) 0%, transparent 65%)',
        }}
      />
      
      {/* Purple glow - increased to match teal */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 120% 70% at 88% -5%, hsla(270, 75%, 55%, 0.22) 0%, transparent 65%)',
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
