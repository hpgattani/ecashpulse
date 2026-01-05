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

  // Dark mode - liquid glass with teal + purple glows
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Deep dark base */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, hsl(220 25% 5%) 0%, hsl(220 20% 3%) 50%, hsl(220 20% 4%) 100%)',
        }}
      />
      
      {/* Subtle grid lines */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-15" />
      
      {/* Frosted glass layer */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, hsla(220, 25%, 8%, 0.5) 0%, hsla(220, 20%, 5%, 0.3) 50%, hsla(220, 25%, 6%, 0.4) 100%)',
          backdropFilter: 'blur(80px)',
        }}
      />
      
      {/* Primary teal liquid glow - left side */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 90% 70% at 10% 0%, hsla(168, 85%, 45%, 0.3) 0%, hsla(168, 80%, 40%, 0.15) 25%, transparent 55%)',
          filter: 'blur(60px)',
        }}
      />
      
      {/* Secondary teal accent - creates depth */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 5% 25%, hsla(166, 90%, 40%, 0.2) 0%, transparent 45%)',
          filter: 'blur(40px)',
        }}
      />
      
      {/* Purple liquid glow - right side */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 90% 70% at 90% 0%, hsla(270, 75%, 50%, 0.25) 0%, hsla(270, 70%, 45%, 0.1) 25%, transparent 55%)',
          filter: 'blur(60px)',
        }}
      />
      
      {/* Glass edge highlight - top */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, hsla(168, 70%, 50%, 0.08) 0%, transparent 15%)',
        }}
      />
      
      {/* Bottom ambient glow */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 120% 40% at 50% 110%, hsla(200, 70%, 45%, 0.12) 0%, transparent 50%)',
          filter: 'blur(30px)',
        }}
      />
    </div>
  );
};
