import React from 'react';
import { cn } from '@/lib/utils';

export const GlassLoadingState: React.FC<{ className?: string }> = ({ className }) => {
  const glassStyles = {
    background: 'var(--glass-bg-gradient)',
    boxShadow: 'var(--glass-shadow)',
    backdropFilter: 'var(--glass-blur)',
    borderRadius: '50%'
  };
  
  return (
    <div className={cn("flex items-center justify-center p-8", className)}>
      <div className="relative w-16 h-16">
        <div 
          style={glassStyles}
          className="absolute inset-0 animate-ping" 
        />
        <div 
          style={glassStyles}
          className="absolute inset-0" 
        />
      </div>
    </div>
  );
};