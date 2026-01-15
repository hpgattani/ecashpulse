import React from 'react';
import { cn } from '@/lib/utils';

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, ...props }, ref) => {
    const glassStyles = {
      background: 'var(--glass-bg-gradient)',
      boxShadow: 'var(--glass-shadow)',
      backdropFilter: 'var(--glass-blur)',
      borderRadius: 'var(--glass-radius)'
    };
    
    return (
      <input
        ref={ref}
        style={glassStyles}
        className={cn(
          `w-full px-4 py-3
          text-foreground placeholder:text-foreground/50
          focus:outline-none focus:ring-2 focus:ring-primary/50
          transition-all duration-300
          hover:brightness-110`,
          className
        )}
        {...props}
      />
    );
  }
);

GlassInput.displayName = 'GlassInput';