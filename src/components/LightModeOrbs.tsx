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

  // Light mode - soft gradient background with glass overlay
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
        
        {/* Subtle colored accents */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 100% 60% at 50% 0%, hsla(168, 70%, 75%, 0.15) 0%, transparent 50%)',
          }}
        />
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 40% at 80% 100%, hsla(270, 60%, 80%, 0.1) 0%, transparent 40%)',
          }}
        />
      </div>
    );
  }

  // Dark mode - clean dark with subtle teal glow at top (the "peak" look)
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Base dark gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, hsl(220 20% 6%) 0%, hsl(220 20% 4%) 100%)',
        }}
      />
      
      {/* Subtle teal glow at top center */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 35% at 50% -5%, hsla(168, 80%, 45%, 0.12) 0%, transparent 60%)',
        }}
      />
      
      {/* Very subtle accent glow bottom right */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 50% 30% at 85% 100%, hsla(270, 70%, 50%, 0.05) 0%, transparent 50%)',
        }}
      />
    </div>
  );
};
