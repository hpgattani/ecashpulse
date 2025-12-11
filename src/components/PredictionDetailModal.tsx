import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Outcome } from '@/hooks/usePredictions';

interface Prediction {
  id: string;
  question: string;
  description: string;
  category: string;
  yesOdds: number;
  noOdds: number;
  volume: number;
  endDate: string;
  isMultiOption?: boolean;
  outcomes?: Outcome[];
}

interface PredictionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: Prediction;
  onSelectOutcome: (outcome: Outcome) => void;
}

const PredictionDetailModal = ({ isOpen, onClose, prediction, onSelectOutcome }: PredictionDetailModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100]"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-[101] p-4"
          >
            <div className="glass-card glow-primary p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 pr-4">
                  <h2 className="font-display font-bold text-lg text-foreground">
                    {prediction.question}
                  </h2>
                  {prediction.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {prediction.description}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Outcomes */}
              {prediction.outcomes && prediction.outcomes.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Select an outcome to bet:</h3>
                  {prediction.outcomes.map((outcome) => (
                    <button
                      key={outcome.id}
                      onClick={() => {
                        onSelectOutcome(outcome);
                        onClose();
                      }}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <span className="text-sm text-foreground font-medium">{outcome.label}</span>
                      <span className="text-sm font-bold text-primary">{outcome.odds}%</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PredictionDetailModal;
