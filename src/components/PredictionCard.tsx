import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Clock, Users } from 'lucide-react';
import BetModal from './BetModal';

interface Prediction {
  id: string;
  question: string;
  description: string;
  category: 'crypto' | 'politics' | 'sports' | 'tech' | 'entertainment' | 'economics';
  yesOdds: number;
  noOdds: number;
  volume: number;
  endDate: string;
  image?: string;
  trending?: boolean;
  change24h?: number;
  escrowAddress?: string;
}

interface PredictionCardProps {
  prediction: Prediction;
  index: number;
}

const PredictionCard = ({ prediction, index }: PredictionCardProps) => {
  const [isBetModalOpen, setIsBetModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<'yes' | 'no'>('yes');

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
    if (vol >= 1) return `$${vol.toFixed(2)}`;
    return `$${vol.toFixed(4)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getCategoryEmoji = (category: string) => {
    const emojis: Record<string, string> = {
      crypto: '₿',
      politics: '🏛️',
      sports: '⚽',
      tech: '🚀',
      entertainment: '🎬',
      economics: '📈',
    };
    return emojis[category] || '🌐';
  };

  const handleBet = (position: 'yes' | 'no') => {
    setSelectedPosition(position);
    setIsBetModalOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1, duration: 0.4 }}
        whileHover={{ y: -4 }}
        className="glass-card overflow-hidden group"
      >
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-border/30">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getCategoryEmoji(prediction.category)}</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {prediction.category}
              </span>
            </div>
            {prediction.trending && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                <TrendingUp className="w-3 h-3" />
                Hot
              </div>
            )}
          </div>
          
          <h3 className="font-display font-semibold text-foreground text-base md:text-lg leading-snug group-hover:text-primary transition-colors">
            {prediction.question}
          </h3>
        </div>

        {/* Odds Display */}
        <div className="p-4 md:p-5">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-emerald-400 font-semibold">Yes {prediction.yesOdds}%</span>
              <span className="text-red-400 font-semibold">No {prediction.noOdds}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden flex">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${prediction.yesOdds}%` }}
                transition={{ delay: index * 0.1 + 0.3, duration: 0.8, ease: 'easeOut' }}
                className="odds-bar-yes"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${prediction.noOdds}%` }}
                transition={{ delay: index * 0.1 + 0.3, duration: 0.8, ease: 'easeOut' }}
                className="odds-bar-no"
              />
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {formatVolume(prediction.volume)} Vol
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(prediction.endDate)}
            </div>
            {prediction.change24h && (
              <div className={`flex items-center gap-1 ${prediction.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {prediction.change24h >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {Math.abs(prediction.change24h)}%
              </div>
            )}
          </div>

          {/* Bet Buttons */}
          <div className="flex gap-2">
            <Button
              variant="yes"
              size="sm"
              className="flex-1"
              onClick={() => handleBet('yes')}
            >
              Bet Yes
            </Button>
            <Button
              variant="no"
              size="sm"
              className="flex-1"
              onClick={() => handleBet('no')}
            >
              Bet No
            </Button>
          </div>
        </div>
      </motion.div>

      <BetModal
        isOpen={isBetModalOpen}
        onClose={() => setIsBetModalOpen(false)}
        prediction={prediction}
        position={selectedPosition}
      />
    </>
  );
};

export default PredictionCard;
