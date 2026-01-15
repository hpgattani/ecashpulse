import React from 'react';
import { cn } from '@/lib/utils';

interface GlassBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const GlassBadge: React.FC<GlassBadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className
}) => {
  const glassStyles = {
    background: 'var(--glass-bg-gradient)',
    boxShadow: 'var(--glass-shadow)',
    backdropFilter: 'var(--glass-blur)',
    borderRadius: '9999px'
  };
  
  const variants = {
    default: 'text-foreground border-white/20',
    success: 'text-green-400 border-green-500/30',
    warning: 'text-yellow-400 border-yellow-500/30',
    error: 'text-red-400 border-red-500/30',
    info: 'text-blue-400 border-blue-500/30'
  };
  
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  };
  
  return (
    <span
      style={glassStyles}
      className={cn(
        "inline-flex items-center gap-1.5 font-medium border",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
};