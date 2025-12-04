import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Zap, Menu, X, User, Wallet } from 'lucide-react';
import ProfileModal from './ProfileModal';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/30"
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <motion.a
              href="/"
              className="flex items-center gap-2 group"
              whileHover={{ scale: 1.02 }}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="absolute inset-0 rounded-xl bg-primary/30 blur-xl group-hover:blur-2xl transition-all" />
              </div>
              <div className="flex flex-col">
                <span className="font-display font-bold text-lg md:text-xl text-foreground">
                  eCash<span className="text-primary">Pulse</span>
                </span>
                <span className="text-[10px] text-muted-foreground -mt-1 hidden md:block">
                  Predict the Future
                </span>
              </div>
            </motion.a>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#markets" className="text-muted-foreground hover:text-foreground transition-colors">
                Markets
              </a>
              <a href="#trending" className="text-muted-foreground hover:text-foreground transition-colors">
                Trending
              </a>
              <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                How It Works
              </a>
            </nav>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-3">
              <Button
                variant="glass"
                size="sm"
                onClick={() => setIsProfileOpen(true)}
                className="gap-2"
              >
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsProfileOpen(true)}
                className="gap-2"
              >
                <User className="w-4 h-4" />
                Profile
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden py-4 border-t border-border/30"
            >
              <nav className="flex flex-col gap-4">
                <a href="#markets" className="text-muted-foreground hover:text-foreground transition-colors">
                  Markets
                </a>
                <a href="#trending" className="text-muted-foreground hover:text-foreground transition-colors">
                  Trending
                </a>
                <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                  How It Works
                </a>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="glass"
                    size="sm"
                    onClick={() => setIsProfileOpen(true)}
                    className="flex-1"
                  >
                    Connect Wallet
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setIsProfileOpen(true)}
                    className="flex-1"
                  >
                    Profile
                  </Button>
                </div>
              </nav>
            </motion.div>
          )}
        </div>
      </motion.header>

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
};

export default Header;
