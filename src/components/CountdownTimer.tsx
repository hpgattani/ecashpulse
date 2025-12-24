import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  endDate: string;
  className?: string;
}

const CountdownTimer = ({ endDate, className = '' }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endDate).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      // Only show countdown if within 24 hours
      const hoursLeft = diff / (1000 * 60 * 60);
      if (hoursLeft > 24) {
        setTimeLeft(null);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [endDate]);

  if (!timeLeft) return null;

  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-destructive/20 text-destructive text-xs font-mono font-medium animate-pulse ${className}`}>
      <Clock className="w-3 h-3" />
      <span>{pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}</span>
    </div>
  );
};

export default CountdownTimer;
