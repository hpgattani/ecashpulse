import React from 'react';
import { cn } from '@/lib/utils';
import { Mail, Phone, Briefcase } from 'lucide-react';

interface GlassProfileCardProps {
  name: string;
  role: string;
  avatar?: string;
  className?: string;
}

export const GlassProfileCard: React.FC<GlassProfileCardProps> = ({
  name,
  role,
  avatar,
  className
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
      className={cn(
        `p-6 hover:brightness-110 transition-all duration-300 max-w-sm`,
        className
      )}
    >
      <div className="flex items-center gap-4">
        {avatar && (
          <img
            src={avatar}
            alt={name}
            className="w-16 h-16 rounded-full object-cover border-2 border-white/30"
          />
        )}
        <div>
          <h3 className="text-lg font-semibold text-foreground">{name}</h3>
          <p className="text-sm text-foreground/70">{role}</p>
        </div>
      </div>
    </div>
  );
};

interface GlassDetailedProfileCardProps {
  name: string;
  role: string;
  email: string;
  phone: string;
  avatar?: string;
  className?: string;
}

export const GlassDetailedProfileCard: React.FC<GlassDetailedProfileCardProps> = ({
  name,
  role,
  email,
  phone,
  avatar,
  className
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
      className={cn(
        `p-6 hover:brightness-110 transition-all duration-300 max-w-[280px]`,
        className
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {avatar && (
            <img
              src={avatar}
              alt={name}
              className="w-20 h-20 rounded-full object-cover border-2 border-white/30"
            />
          )}
          <div>
            <h3 className="text-xl font-semibold text-foreground">{name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Briefcase size={14} className="text-foreground/50" />
              <p className="text-sm text-foreground/70">{role}</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-3 pt-3 border-t border-white/10">
          <div className="flex items-center gap-3">
            <Mail size={16} className="text-foreground/50" />
            <span className="text-sm text-foreground/80">{email}</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone size={16} className="text-foreground/50" />
            <span className="text-sm text-foreground/80">{phone}</span>
          </div>
        </div>
      </div>
    </div>
  );
};