import { motion } from "framer-motion";
import { ExternalLink, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExternalGame {
  id: string;
  name: string;
  description: string;
  icon: string;
  url: string;
  platform: string;
}

interface ExternalGameCardProps {
  game: ExternalGame;
  index: number;
}

const ExternalGameCard = ({ game, index }: ExternalGameCardProps) => {
  const handlePlay = () => {
    window.open(game.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="glass-card p-6 flex flex-col items-center text-center group hover:border-primary/50 transition-all relative overflow-hidden"
    >
      {/* Peelable sticker effect */}
      <div className="absolute top-3 right-3 z-10">
        <div 
          className="relative px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white rounded-md shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
            transform: 'rotate(8deg)',
            boxShadow: '2px 2px 8px rgba(0,0,0,0.3), -1px -1px 0px rgba(255,255,255,0.2) inset',
          }}
        >
          {/* Peel corner effect */}
          <div 
            className="absolute -bottom-1 -left-1 w-3 h-3 rounded-br-md"
            style={{
              background: 'linear-gradient(135deg, transparent 50%, #92400e 50%)',
              transform: 'rotate(-3deg)',
            }}
          />
          <div className="flex items-center gap-1">
            <Monitor className="w-3 h-3" />
            {game.platform}
          </div>
        </div>
      </div>

      <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform">
        {game.icon}
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2">{game.name}</h3>
      <p className="text-sm text-muted-foreground mb-6 flex-1">{game.description}</p>
      
      <div className="w-full">
        <Button 
          onClick={handlePlay}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Play on itch.io
        </Button>
      </div>
    </motion.div>
  );
};

export default ExternalGameCard;
