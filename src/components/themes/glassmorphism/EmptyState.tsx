import React from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlassEmptyStateProps {
  title: string;
  description?: string;
  className?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const GlassEmptyState: React.FC<GlassEmptyStateProps> = ({ 
  title, 
  description, 
  className,
  icon,
  action
}) => {
  const glassStyles = {
    background: 'var(--glass-bg-gradient)',
    boxShadow: 'var(--glass-shadow)',
    backdropFilter: 'var(--glass-blur)',
    borderRadius: 'var(--glass-radius)'
  };
  
  return (
    <div 
      style={glassStyles}
      className={cn("p-8 text-center", className)}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
          {icon || <Package size={32} className="text-foreground/50" />}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
          {description && (
            <p className="text-sm text-foreground/60 max-w-xs mx-auto">{description}</p>
          )}
        </div>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
};