import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, Minimize2, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExternalGame {
  id: string;
  name: string;
  description: string;
  icon: string;
  url: string;
  embedUrl?: string;
  platform: string;
}

interface ExternalGameModalProps {
  game: ExternalGame;
  isOpen: boolean;
  onClose: () => void;
}

const ExternalGameModal = ({ game, isOpen, onClose }: ExternalGameModalProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Generate embed URL for itch.io games
  const getEmbedUrl = () => {
    if (game.embedUrl) return game.embedUrl;
    
    // For itch.io games, we can try to embed directly
    // The embed typically works with the game page URL
    if (game.url.includes("itch.io")) {
      return game.url;
    }
    return game.url;
  };

  const toggleFullscreen = () => {
    const container = document.getElementById("external-game-container");
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const handleOpenExternal = () => {
    window.open(game.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            id="external-game-container"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-5xl h-[80vh] bg-card rounded-xl overflow-hidden border border-border shadow-2xl"
          >
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{game.icon}</span>
                <div>
                  <h2 className="text-lg font-bold text-white">{game.name}</h2>
                  <p className="text-xs text-white/60">{game.platform}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleOpenExternal}
                  className="text-white hover:bg-white/20"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFullscreen}
                  className="text-white hover:bg-white/20"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-5 h-5" />
                  ) : (
                    <Maximize2 className="w-5 h-5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Loading Indicator */}
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Loading game...</p>
                <p className="text-xs text-muted-foreground mt-2">
                  If the game doesn't load, try opening in a new tab
                </p>
              </div>
            )}

            {/* Game iFrame */}
            <iframe
              src={getEmbedUrl()}
              className="w-full h-full border-0"
              allow="autoplay; fullscreen; gamepad"
              allowFullScreen
              onLoad={() => setIsLoading(false)}
              title={game.name}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ExternalGameModal;
