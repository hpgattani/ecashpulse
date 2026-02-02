import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Activity, Menu, X, Wallet, LogOut, TrendingUp, User, BarChart3, MessageCircleHeart, Ticket, Gamepad2 } from "lucide-react";
import { ProfileModal } from "./ProfileModal";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user, profile, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const getHeaderOffset = () => {
    // motion.header renders a real <header> element
    const headerEl = document.querySelector('header');
    const height = headerEl?.getBoundingClientRect().height ?? 80;
    // a little extra breathing room so headings never sit under the header
    return Math.ceil(height + 16);
  };

  const scrollToIdWithRetry = (sectionId: string) => {
    let tries = 0;
    const maxTries = 60; // ~3s

    const attempt = () => {
      const element = document.getElementById(sectionId);
      if (element) {
        const top = element.getBoundingClientRect().top + window.scrollY - getHeaderOffset();
        window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
        return;
      }
      if (tries++ < maxTries) window.setTimeout(attempt, 50);
    };

    window.setTimeout(attempt, 0);
  };

  const scrollToSection = (sectionId: string) => {
    const hash = `#${sectionId}`;
    setIsMenuOpen(false);

    // Always keep the hash in the URL (shareable + refresh-safe).
    if (location.pathname !== '/') {
      navigate({ pathname: '/', hash }, { state: { scrollTo: sectionId } });
      return;
    }

    if (location.hash !== hash) {
      navigate({ pathname: '/', hash }, { state: { scrollTo: sectionId } });
    }

    // Also scroll immediately (don’t rely solely on hash effects).
    scrollToIdWithRetry(sectionId);
  };

  // Handle scroll after navigation (from other routes)
  useEffect(() => {
    const scrollTo = (location.state as any)?.scrollTo as string | undefined;
    if (!scrollTo) return;
    scrollToIdWithRetry(scrollTo);
  }, [location]);

  const truncateAddress = (address: string) => {
    if (address.length <= 20) return address;
    return `${address.slice(0, 12)}...${address.slice(-6)}`;
  };

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/30"
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <motion.div whileHover={{ scale: 1.02 }} className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Activity className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div className="absolute inset-0 rounded-xl bg-primary/30 blur-xl group-hover:blur-2xl transition-all animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <span className="font-display font-bold text-lg md:text-xl text-foreground">
                    eCash<span className="text-primary">Pulse</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground -mt-1 hidden md:block">Predict the Future</span>
                </div>
              </motion.div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <button onClick={() => scrollToSection('markets')} className="text-muted-foreground hover:text-foreground transition-colors">
                {t.markets}
              </button>
              <button onClick={() => scrollToSection('trending')} className="text-muted-foreground hover:text-foreground transition-colors">
                {t.trending}
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  navigate('/awaiting');
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {t.awaitingResolution}
              </button>
              <button onClick={() => scrollToSection('how-it-works')} className="text-muted-foreground hover:text-foreground transition-colors">
                {t.howItWorks}
              </button>
              {user && (
                <Link to="/my-bets" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.myBets}
                </Link>
              )}
              <Link to="/stats" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <BarChart3 className="w-4 h-4" />
                Stats
              </Link>
              <Link to="/sentiment" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <MessageCircleHeart className="w-4 h-4" />
                Sentiment
              </Link>
              <Link to="/raffle" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <Ticket className="w-4 h-4" />
                Raffle
              </Link>
              <Link to="/games" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <Gamepad2 className="w-4 h-4" />
                Games
              </Link>
            </nav>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-1">
              <ThemeToggle />
              <LanguageSwitcher />
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Wallet className="w-4 h-4" />
                      {profile?.display_name || truncateAddress(user.ecash_address)}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
                      <User className="w-4 h-4 mr-2" />
                      {t.editProfile}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/my-bets")}>
                      <TrendingUp className="w-4 h-4 mr-2" />
                      {t.myBets}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-destructive">
                      <LogOut className="w-4 h-4 mr-2" />
                      {t.logout}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button size="sm" onClick={() => navigate("/auth")}>
                  <Wallet className="w-4 h-4 mr-2" />
                  {t.connect}
                </Button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden py-4 border-t border-border/30"
            >
              <nav className="flex flex-col gap-4">
                <button
                  onClick={() => scrollToSection('markets')}
                  className="text-left text-foreground/80 hover:text-primary transition-colors font-medium"
                >
                  {t.markets}
                </button>
                <button
                  onClick={() => scrollToSection('trending')}
                  className="text-left text-foreground/80 hover:text-primary transition-colors font-medium"
                >
                  {t.trending}
                </button>
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate('/awaiting');
                  }}
                  className="text-left text-foreground/80 hover:text-primary transition-colors font-medium"
                >
                  {t.awaitingResolution}
                </button>
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="text-left text-foreground/80 hover:text-primary transition-colors font-medium"
                >
                  {t.howItWorks}
                </button>
                {user && (
                  <Link
                    to="/my-bets"
                    className="text-foreground/80 hover:text-primary transition-colors font-medium"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t.myBets}
                  </Link>
                )}
                <Link
                  to="/stats"
                  className="text-foreground/80 hover:text-primary transition-colors flex items-center gap-2 font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <BarChart3 className="w-4 h-4" />
                  Stats
                </Link>
                <Link
                  to="/sentiment"
                  className="text-foreground/80 hover:text-primary transition-colors flex items-center gap-2 font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <MessageCircleHeart className="w-4 h-4" />
                  Sentiment
                </Link>
                <Link
                  to="/raffle"
                  className="text-foreground/80 hover:text-primary transition-colors flex items-center gap-2 font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Ticket className="w-4 h-4" />
                  Raffle
                </Link>
                <Link
                  to="/games"
                  className="text-foreground/80 hover:text-primary transition-colors flex items-center gap-2 font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Gamepad2 className="w-4 h-4" />
                  Games
                </Link>
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  <span className="text-sm text-muted-foreground">Theme</span>
                  <ThemeToggle />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-muted-foreground">Language</span>
                  <LanguageSwitcher />
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  {user ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-mono px-2">
                        {truncateAddress(user.ecash_address)}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => {
                          setIsProfileOpen(true);
                          setIsMenuOpen(false);
                        }}
                      >
                        <User className="w-4 h-4" />
                        {t.editProfile}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => {
                          logout();
                          setIsMenuOpen(false);
                        }}
                      >
                        <LogOut className="w-4 h-4" />
                        {t.logout}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => {
                        navigate("/auth");
                        setIsMenuOpen(false);
                      }}
                    >
                      <Wallet className="w-4 h-4" />
                      {t.connect}
                    </Button>
                  )}
                </div>
              </nav>
            </motion.div>
          )}
        </div>
      </motion.header>

      <ProfileModal open={isProfileOpen} onOpenChange={setIsProfileOpen} />
    </>
  );
};

export default Header;
