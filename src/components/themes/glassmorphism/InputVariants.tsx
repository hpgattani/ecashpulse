import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Search, Mail, Phone, Calendar, Minus, Plus } from 'lucide-react';

const glassStyles = {
  background: 'var(--glass-bg-gradient)',
  boxShadow: 'var(--glass-shadow)',
  backdropFilter: 'var(--glass-blur)',
  borderRadius: 'var(--glass-radius)'
};

export const GlassInputWithLeftIcon = () => {
  return (
    <div className="relative max-w-full">
      <input
        type="email"
        placeholder="Enter your email"
        style={glassStyles}
        className={cn(
          `w-full pl-12 pr-4 py-3
          text-foreground placeholder:text-foreground/50
          focus:outline-none focus:ring-2 focus:ring-primary/50
          transition-all duration-300
          hover:brightness-110`
        )}
      />
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/50 pointer-events-none z-10">
        <Mail size={20} />
      </div>
    </div>
  );
};

export const GlassInputWithRightIcon = () => {
  return (
    <div className="relative max-w-full">
      <input
        type="text"
        placeholder="Search..."
        style={glassStyles}
        className={cn(
          `w-full pl-4 pr-12 py-3
          text-foreground placeholder:text-foreground/50
          focus:outline-none focus:ring-2 focus:ring-primary/50
          transition-all duration-300
          hover:brightness-110`
        )}
      />
      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/50 pointer-events-none z-10">
        <Search size={20} />
      </div>
    </div>
  );
};

export const GlassPasswordInput = () => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative max-w-full">
      <input
        type={showPassword ? "text" : "password"}
        placeholder="Enter password"
        style={glassStyles}
        className={cn(
          `w-full pl-4 pr-12 py-3
          text-foreground placeholder:text-foreground/50
          focus:outline-none focus:ring-2 focus:ring-primary/50
          transition-all duration-300
          hover:brightness-110`
        )}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground transition-colors z-10"
      >
        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
};

export const GlassSearchWithButton = () => {
  return (
    <div className="flex max-w-full">
      <input
        type="text"
        placeholder="Search..."
        style={{ ...glassStyles, borderRadius: 'var(--glass-radius) 0 0 var(--glass-radius)' }}
        className={cn(
          `flex-1 pl-4 pr-4 py-3
          text-foreground placeholder:text-foreground/50
          focus:outline-none focus:ring-2 focus:ring-primary/50
          transition-all duration-300
          hover:brightness-110`
        )}
      />
      <button
        style={{ ...glassStyles, borderRadius: '0 var(--glass-radius) var(--glass-radius) 0' }}
        className={cn(
          `px-6 py-3
          text-foreground
          hover:brightness-110
          transition-all duration-300`
        )}
      >
        <Search size={20} />
      </button>
    </div>
  );
};

export const GlassNumberInput = () => {
  const [count, setCount] = useState(1);
  
  const increment = () => setCount(prev => Math.min(prev + 1, 99));
  const decrement = () => setCount(prev => Math.max(prev - 1, 0));

  return (
    <div className="flex max-w-full">
      <button
        onClick={decrement}
        style={{ ...glassStyles, borderRadius: 'var(--glass-radius) 0 0 var(--glass-radius)' }}
        className={cn(
          `w-12 flex items-center justify-center
          text-foreground
          hover:brightness-110
          transition-all duration-300
          disabled:opacity-50 disabled:cursor-not-allowed`
        )}
        disabled={count <= 0}
      >
        <Minus size={20} />
      </button>
      <input
        type="number"
        value={count}
        onChange={(e) => setCount(Math.max(0, Math.min(99, parseInt(e.target.value) || 0)))}
        style={{ ...glassStyles, borderRadius: '0' }}
        className={cn(
          `flex-1 px-4 py-3 text-center
          text-foreground placeholder:text-foreground/50
          focus:outline-none focus:ring-2 focus:ring-primary/50
          transition-all duration-300
          hover:brightness-110
          [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`
        )}
        min="0"
        max="99"
      />
      <button
        onClick={increment}
        style={{ ...glassStyles, borderRadius: '0 var(--glass-radius) var(--glass-radius) 0' }}
        className={cn(
          `w-12 flex items-center justify-center
          text-foreground
          hover:brightness-110
          transition-all duration-300
          disabled:opacity-50 disabled:cursor-not-allowed`
        )}
        disabled={count >= 99}
      >
        <Plus size={20} />
      </button>
    </div>
  );
};

export const GlassPhoneInput = () => {
  return (
    <div className="relative max-w-full">
      <input
        type="tel"
        placeholder="+1 (555) 123-4567"
        style={glassStyles}
        className={cn(
          `w-full pl-12 pr-4 py-3
          text-foreground placeholder:text-foreground/50
          focus:outline-none focus:ring-2 focus:ring-primary/50
          transition-all duration-300
          hover:brightness-110`
        )}
      />
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/50 pointer-events-none z-10">
        <Phone size={20} />
      </div>
    </div>
  );
};

export const GlassDateInput = () => {
  return (
    <div className="relative max-w-full">
      <input
        type="date"
        style={glassStyles}
        className={cn(
          `w-full pl-12 pr-4 py-3
          text-foreground placeholder:text-foreground/50
          focus:outline-none focus:ring-2 focus:ring-primary/50
          transition-all duration-300
          hover:brightness-110`
        )}
      />
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/50 pointer-events-none z-10">
        <Calendar size={20} />
      </div>
    </div>
  );
};

export const GlassTextarea = () => {
  return (
    <div className="max-w-full">
      <textarea
        placeholder="Enter your message..."
        rows={4}
        style={glassStyles}
        className={cn(
          `w-full px-4 py-3
          text-foreground placeholder:text-foreground/50
          focus:outline-none focus:ring-2 focus:ring-primary/50
          transition-all duration-300
          hover:brightness-110
          resize-none`
        )}
      />
    </div>
  );
};

export const GlassDisabledInput = () => {
  return (
    <div className="max-w-full">
      <input
        type="text"
        placeholder="Disabled input"
        disabled
        style={glassStyles}
        className={cn(
          `w-full px-4 py-3
          text-foreground placeholder:text-foreground/50
          focus:outline-none focus:ring-2 focus:ring-primary/50
          transition-all duration-300
          hover:brightness-110
          disabled:opacity-50 disabled:cursor-not-allowed`
        )}
      />
    </div>
  );
};