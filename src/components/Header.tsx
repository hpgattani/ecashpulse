import { useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Zap, Menu, X, Wallet, LogOut, TrendingUp, User } from "lucide-react";
import { ProfileModal } from "./ProfileModal";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
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
                    <Zap className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div className="absolute inset-0 rounded-xl bg-primary/30 blur-xl group-hover:blur-2xl transition-all" />
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
              <Link to="/#markets" className="text-muted-foreground hover:text-foreground transition-colors">
                {t.markets}
              </Link>
              <Link to="/#trending" className="text-muted-foreground hover:text-foreground transition-colors">
                {t.trending}
              </Link>
              <Link to="/#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                {t.howItWorks}
              </Link>
              {user && (
                <Link to="/my-bets" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t.myBets}
                </Link>
              )}
            </nav>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-2">
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
                <Link
                  to="/#markets"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t.markets}
                </Link>
                <Link
                  to="/#trending"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t.trending}
                </Link>
                <Link
                  to="/#how-it-works"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t.howItWorks}
                </Link>
                {user && (
                  <Link
                    to="/my-bets"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t.myBets}
                  </Link>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
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
