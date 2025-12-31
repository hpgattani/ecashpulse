import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
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

interface BetActivity {
  id: string;
  amount: number;
  position: string;
  address: string;
  timestamp: string;
  outcome_label?: string;
}

interface PredictionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: Prediction;
  onSelectOutcome: (outcome: Outcome) => void;
}

const PredictionDetailModal = ({ isOpen, onClose, prediction, onSelectOutcome }: PredictionDetailModalProps) => {
  const [activeTab, setActiveTab] = useState<'outcomes' | 'activity'>('activity');
  const [activities, setActivities] = useState<BetActivity[]>([]);

  useEffect(() => {
    if (!isOpen || !prediction) return;

    setActiveTab(prediction.isMultiOption && prediction.outcomes && prediction.outcomes.length > 0 ? 'outcomes' : 'activity');
    fetchActivity();
  }, [isOpen, prediction?.id, prediction?.isMultiOption, prediction?.outcomes?.length]);

  const fetchActivity = async () => {
    try {
      // Use edge function to bypass RLS
      const { data, error } = await supabase.functions.invoke('get-prediction-activity', {
        body: { prediction_id: prediction.id }
      });

      if (error) {
        console.error('Error fetching activity:', error);
        return;
      }

      if (data?.activities) {
        setActivities(
          (data.activities as any[]).map((a) => ({
            id: a.id,
            amount: a.amount,
            position: a.position,
            address: a.address ?? a.ecash_address ?? 'Unknown',
            timestamp: a.timestamp ?? a.created_at ?? a.createdAt ?? '',
            outcome_label: a.outcome_label ?? a.outcomeLabel,
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching activity:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const diff = Math.max(0, now.getTime() - date.getTime());
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const formatAddress = (addr: string) => {
    if (!addr) return 'Anonymous';
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 10)}...${addr.slice(-4)}`;
  };

  const formatXEC = (satoshis: number) => {
    const xec = satoshis / 100;
    return xec.toLocaleString() + ' XEC';
  };

  if (!prediction) return null;

  return (
    <AnimatePresence>
      {isOpen && prediction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl max-h-[80vh]"
          >
            <div className="glass-card glow-primary p-6 flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 pr-4">
                  <h2 className="font-display font-bold text-lg text-foreground">
                    {prediction.question}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {prediction.description}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-4 border-b border-border pb-2">
                {prediction.isMultiOption && prediction.outcomes && prediction.outcomes.length > 0 && (
                  <Button
                    variant={activeTab === 'outcomes' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('outcomes')}
                    className="gap-1"
                  >
                    <Users className="w-4 h-4" />
                    Outcomes
                  </Button>
                )}

                <Button
                  variant={activeTab === 'activity' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('activity')}
                  className="gap-1"
                >
                  <Activity className="w-4 h-4" />
                  Activity
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto min-h-[200px]">
                {activeTab === 'outcomes' && prediction.isMultiOption && prediction.outcomes && (
                  <div className="space-y-2">
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

                {activeTab === 'activity' && (
                  <div className="space-y-2">
                    {activities.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No betting activity yet</p>
                    ) : (
                      activities.map((act) => (
                        <div key={act.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${act.position === 'yes' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            <span className="text-xs font-mono text-muted-foreground">
                              {formatAddress(act.address)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">
                              {act.outcome_label ? act.outcome_label : (act.position === 'yes' ? 'Yes' : 'No')}
                            </span>
                            <span className="text-sm text-primary font-bold">{formatXEC(act.amount)}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(act.timestamp)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PredictionDetailModal;