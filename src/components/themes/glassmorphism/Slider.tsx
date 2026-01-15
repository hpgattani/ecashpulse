import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface GlassSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  className?: string;
}

export const GlassSlider: React.FC<GlassSliderProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  formatValue = (v) => String(v),
  className
}) => {
  const percentage = ((value - min) / (max - min)) * 100;
  
  const glassStyles = {
    background: 'var(--glass-bg-gradient)',
    boxShadow: 'var(--glass-shadow)',
    backdropFilter: 'var(--glass-blur)',
  };
  
  return (
    <div className={cn("space-y-3", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && <span className="text-sm font-medium text-foreground">{label}</span>}
          {showValue && (
            <span className="text-sm font-mono text-foreground/70">{formatValue(value)}</span>
          )}
        </div>
      )}
      
      <div className="relative">
        <div 
          className="relative h-14 rounded-2xl overflow-hidden"
          style={glassStyles}
        >
          {/* Specular highlight */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent rounded-2xl" />
          
          {/* Animated fill */}
          <motion.div 
            className="absolute top-1 bottom-1 left-1 rounded-xl overflow-hidden"
            initial={false}
            animate={{ width: `calc(${Math.max(5, percentage)}% - 8px)` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/40 via-primary/60 to-primary/50 rounded-xl" />
            
            {/* Shimmer */}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ['-200%', '200%'] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
            />
            
            {/* Top highlight */}
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent rounded-t-xl" />
          </motion.div>
          
          {/* Hidden input */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-40"
          />
          
          {/* Value display */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <motion.span 
              key={value}
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="font-display font-bold text-lg text-foreground drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
            >
              {formatValue(value)}
            </motion.span>
          </div>
          
          {/* Thumb */}
          <motion.div
            className="absolute top-1/2 w-7 h-7 pointer-events-none z-30"
            style={{ translateY: '-50%' }}
            initial={false}
            animate={{ 
              left: `clamp(4px, calc(${percentage}% - 14px), calc(100% - 32px))` 
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-br from-primary via-primary to-primary/80 shadow-lg shadow-primary/40 border-2 border-white/40">
              <div className="absolute inset-1 rounded-full bg-gradient-to-b from-white/50 to-transparent" />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};