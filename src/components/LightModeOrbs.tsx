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

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Grid pattern with glow */}
      <div 
        className="absolute inset-0 bg-grid-pattern bg-grid"
        style={{
          opacity: theme === 'light' ? 0.6 : 0.35,
          filter: theme === 'dark' ? 'drop-shadow(0 0 2px hsl(168 80% 45% / 0.3))' : 'none',
        }}
      />
      
      {/* Subtle vignette effect - edges darker */}
      <div 
        className="absolute inset-0"
        style={{
          background: theme === 'light'
            ? 'radial-gradient(ellipse at center, transparent 0%, hsla(210, 20%, 90%, 0.3) 100%)'
            : 'radial-gradient(ellipse at center, transparent 0%, hsla(220, 20%, 2%, 0.5) 100%)',
        }}
      />
      
      {/* Very subtle top highlight for glass depth */}
      <div 
        className="absolute inset-x-0 top-0 h-[30vh]"
        style={{
          background: theme === 'light' 
            ? 'linear-gradient(180deg, hsla(0, 0%, 100%, 0.3) 0%, transparent 100%)'
            : 'linear-gradient(180deg, hsla(220, 20%, 8%, 0.4) 0%, transparent 100%)',
        }}
      />
    </div>
  );
};
