import React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const GlassModal: React.FC<GlassModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  className
}) => {
  const glassStyles = {
    background: 'var(--glass-bg-gradient)',
    boxShadow: 'var(--glass-shadow)',
    backdropFilter: 'var(--glass-blur)',
    borderRadius: 'var(--glass-radius)'
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={glassStyles}
            className={cn(
              "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
              "w-full max-w-md p-6",
              "max-h-[85vh] overflow-y-auto",
              className
            )}
          >
            {/* Header */}
            {(title || description) && (
              <div className="mb-4">
                <div className="flex items-start justify-between gap-4">
                  {title && (
                    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                  )}
                  <button
                    onClick={onClose}
                    className="p-1 rounded-lg hover:bg-white/10 transition-colors text-foreground/60 hover:text-foreground"
                  >
                    <X size={20} />
                  </button>
                </div>
                {description && (
                  <p className="text-sm text-foreground/60 mt-1">{description}</p>
                )}
              </div>
            )}
            
            {/* Content */}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};