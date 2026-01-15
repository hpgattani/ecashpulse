import React from 'react';
import { Search, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export const GlassTopNav: React.FC<{ className?: string }> = ({ className }) => {
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" size={18} />
            <input
              type="text"
              placeholder="Search..."
              style={glassStyles}
              className="w-full pl-10 pr-4 py-2 text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg hover:bg-white/10 transition-all">
            <Bell size={20} className="text-foreground" />
          </button>
          <button className="p-2 rounded-lg hover:bg-white/10 transition-all">
            <User size={20} className="text-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};