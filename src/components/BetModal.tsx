import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info } from 'lucide-react';
import { Prediction } from '@/types/prediction';
import { Button } from '@/components/ui/button';

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: Prediction;
  position: 'yes' | 'no';
}

const BetModal = ({ isOpen, onClose, prediction, position }: BetModalProps) => {
  const payButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && payButtonRef.current) {
      // Clear any existing content
      payButtonRef.current.innerHTML = '';
      
      // Create PayButton element
      const payButton = document.createElement('div');
      payButton.className = 'paybutton';
      payButton.setAttribute('to', 'ecash:qr6pwzt7glvmq6ryr4305kat0vnv2wy69qjxpdwz5a');
      payButton.setAttribute('amount', '0');
      payButton.setAttribute('text', `Bet ${position.toUpperCase()}`);
      payButton.setAttribute('hover-text', 'Confirm Bet');
      payButton.setAttribute('success-text', 'Bet Placed!');
      payButton.setAttribute('theme', JSON.stringify({
        palette: {
          primary: position === 'yes' ? '#10b981' : '#ef4444',
          secondary: '#1a1a2e',
          tertiary: '#ffffff'
        }
      }));
      
      payButtonRef.current.appendChild(payButton);

      // Load PayButton script if not already loaded
      if (!document.querySelector('script[src*="paybutton"]')) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@paybutton/paybutton/dist/paybutton.js';
        script.async = true;
        document.body.appendChild(script);
      } else {
        // If script is already loaded, trigger PayButton render
        // @ts-ignore
        if (window.PayButton) {
          // @ts-ignore
          window.PayButton.render(payButton, {
            to: 'ecash:qr6pwzt7glvmq6ryr4305kat0vnv2wy69qjxpdwz5a',
            amount: 0,
            text: `Bet ${position.toUpperCase()}`,
            hoverText: 'Confirm Bet',
            successText: 'Bet Placed!',
            theme: {
              palette: {
                primary: position === 'yes' ? '#10b981' : '#ef4444',
                secondary: '#1a1a2e',
                tertiary: '#ffffff'
              }
            }
          });
        }
      }
    }
  }, [isOpen, position]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 p-4"
          >
            <div className="glass-card glow-primary p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="font-display font-bold text-xl text-foreground mb-1">
                    Place Your Bet
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Betting <span className={position === 'yes' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                      {position.toUpperCase()}
                    </span> on this prediction
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Prediction Info */}
              <div className="p-4 rounded-lg bg-muted/50 mb-6">
                <h3 className="font-medium text-foreground mb-2">{prediction.question}</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current Odds:</span>
                  <span className={position === 'yes' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {position === 'yes' ? prediction.yesOdds : prediction.noOdds}%
                  </span>
                </div>
              </div>

              {/* PayButton Container */}
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-3 text-center">
                  Click below to place your bet with eCash
                </p>
                <div ref={payButtonRef} className="flex justify-center min-h-[60px]" />
              </div>

              {/* Info */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 text-sm">
                <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  Enter any amount of XEC you want to bet. Your potential winnings depend on the final odds at market resolution.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BetModal;
