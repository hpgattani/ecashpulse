import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({ title, description, children, className }) => {
  const glassStyles = {
    background: 'var(--glass-bg-gradient)',
    boxShadow: 'var(--glass-shadow)',
    backdropFilter: 'var(--glass-blur)',
    borderRadius: 'var(--glass-radius)'
  };
  
  return (
    <div 
      style={glassStyles}
      className={cn("p-6 hover:brightness-110 transition-all", className)}
    >
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-foreground/70 mb-4">{description}</p>}
      {children}
    </div>
  );
};