import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Heart } from 'lucide-react';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link' | 'like';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, children, disabled, ...props }, ref) => {
    const baseStyles = `
      relative overflow-hidden
      font-medium
      transition-all duration-300
      active:scale-95
      disabled:opacity-50 disabled:cursor-not-allowed
    `;
    
    const glassStyles = {
      background: 'var(--glass-bg-gradient)',
      boxShadow: 'var(--glass-shadow)',
      backdropFilter: 'var(--glass-blur)',
      borderRadius: 'var(--glass-radius)'
    };

    const variants = {
      primary: `text-foreground hover:brightness-110`,
      secondary: `text-primary dark:text-primary hover:brightness-110`,
      destructive: `text-red-400 hover:brightness-110 hover:text-red-300`,
      outline: `text-foreground border border-white/20 hover:brightness-110`,
      ghost: `text-foreground/70 hover:brightness-110 hover:text-foreground`,
      link: `text-primary underline-offset-4 hover:underline hover:brightness-110`,
      like: `text-pink-400 hover:brightness-110 hover:text-pink-300`
    };

    const sizes = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-6 py-3 text-base',
      lg: 'px-8 py-4 text-lg',
      icon: 'w-10 h-10 flex items-center justify-center'
    };
    
    const isLinkVariant = variant === 'link';

    return (
      <button
        ref={ref}
        style={isLinkVariant ? {} : glassStyles}
        className={cn(
          !isLinkVariant && baseStyles,
          variants[variant],
          sizes[size],
          loading && 'opacity-70',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        <span className="relative z-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] dark:drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] flex items-center gap-2">
          {loading && <Loader2 className="animate-spin" size={16} />}
          {variant === 'like' && <Heart className="fill-current" size={16} />}
          {children}
        </span>
      </button>
    );
  }
);

GlassButton.displayName = 'GlassButton';