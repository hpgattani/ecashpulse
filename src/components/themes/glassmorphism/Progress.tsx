import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface GlassProgressProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const GlassProgress: React.FC<GlassProgressProps> = ({
  value,
  max = 100,
  label,
  showPercentage = true,
  variant = 'default',
  size = 'md',
  className
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const glassStyles = {
    background: 'var(--glass-bg-gradient)',
    boxShadow: 'var(--glass-shadow)',
    backdropFilter: 'var(--glass-blur)',
  };
  
  const variants = {
    default: 'from-primary/50 via-primary/70 to-primary/60',
    success: 'from-green-500/50 via-green-500/70 to-green-500/60',
    warning: 'from-yellow-500/50 via-yellow-500/70 to-yellow-500/60',
    error: 'from-red-500/50 via-red-500/70 to-red-500/60'
  };
  
  const sizes = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };
  
  return (
    <div className={cn("space-y-2", className)}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-sm">
          {label && <span className="text-foreground">{label}</span>}
          {showPercentage && (
            <span className="text-foreground/70 font-mono">{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      
      <div 
        className={cn("relative rounded-full overflow-hidden", sizes[size])}
        style={glassStyles}
      >
        {/* Specular highlight */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
        
        {/* Progress fill */}
        <motion.div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            "bg-gradient-to-r",
            variants[variant]
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        >
          {/* Shimmer */}
          <motion.div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          />
          
          {/* Top highlight */}
          <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
        </motion.div>
      </div>
    </div>
  );
};