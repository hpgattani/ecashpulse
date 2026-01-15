import React from 'react';
import { Home, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export const GlassSideNav: React.FC<{ className?: string }> = ({ className }) => {
  const glassStyles = {
    background: 'var(--glass-bg-gradient)',
    boxShadow: 'var(--glass-shadow)',
    backdropFilter: 'var(--glass-blur)',
    borderRadius: 'var(--glass-radius)'
  };
  
  return (
    <div 
      style={glassStyles}
      className={cn("w-full p-4", className)}
    >
      <div className="space-y-2">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-white/20 text-foreground transition-all hover:bg-white/25">
          <Home size={18} />
          <span className="text-sm font-medium">Home</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-foreground/70 transition-all hover:bg-white/10">
          <Users size={18} />
          <span className="text-sm">Users</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-foreground/70 transition-all hover:bg-white/10">
          <Settings size={18} />
          <span className="text-sm">Settings</span>
        </button>
      </div>
    </div>
  );
};