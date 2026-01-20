import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Trophy, Zap } from "lucide-react";

interface MiniGame {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  is_active: boolean;
}

interface GameCardProps {
  game: MiniGame;
  index: number;
  onPlay: (mode: "competitive" | "demo") => void;
}

const GameCard = ({ game, index, onPlay }: GameCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="glass-card p-6 flex flex-col items-center text-center group hover:border-primary/50 transition-all"
    >
      <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform">
        {game.icon}
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2">{game.name}</h3>
      <p className="text-sm text-muted-foreground mb-6 flex-1">{game.description}</p>
      
      <div className="w-full space-y-2">
        <Button 
          onClick={() => onPlay("competitive")}
          className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
        >
          <Trophy className="w-4 h-4 mr-2" />
          Compete ($1 XEC)
        </Button>
        <Button 
          onClick={() => onPlay("demo")}
          variant="outline"
          className="w-full"
        >
          <Zap className="w-4 h-4 mr-2" />
          Demo (5.46 XEC)
        </Button>
      </div>
    </motion.div>
  );
};

export default GameCard;