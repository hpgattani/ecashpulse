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
        
        {/* Purple glow */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 60% 40% at 75% 20%, hsla(270, 60%, 75%, 0.15) 0%, transparent 45%)',
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
      
      {/* Teal glow - top left, larger area */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 100% 60% at 20% 0%, hsla(168, 80%, 45%, 0.18) 0%, transparent 60%)',
        }}
      />
      
      {/* Purple glow - top right, larger area */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 90% 55% at 85% 5%, hsla(270, 70%, 55%, 0.14) 0%, transparent 55%)',
        }}
      />
      
      {/* Bottom accent - wider spread */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 35% at 50% 100%, hsla(200, 70%, 50%, 0.08) 0%, transparent 50%)',
        }}
      />
    </div>
  );
};
