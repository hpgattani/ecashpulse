import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, Github, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const Footer = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [clickCount, setClickCount] = useState(0);

  const handleCopyrightClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    
    // Reset clicks after 2 seconds of no clicking
    setTimeout(() => setClickCount(0), 2000);
    
    if (newCount >= 5) {
      setClickCount(0);
      navigate('/admin');
    }
  };

  return (
    <footer className="py-12 border-t border-border/30 relative">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="md:col-span-2"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-xl">
                eCash<span className="text-primary">Pulse</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              {t.footerDesc}
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://x.com/eCashPulse"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </a>
              <a
                href="https://github.com/paybutton"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="https://e.cash"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
          </motion.div>

          {/* Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <h4 className="font-display font-semibold text-foreground mb-4">{t.platform}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/#markets" className="text-muted-foreground hover:text-primary transition-colors">{t.markets}</Link></li>
              <li><Link to="/#trending" className="text-muted-foreground hover:text-primary transition-colors">{t.trending}</Link></li>
              <li><Link to="/#how-it-works" className="text-muted-foreground hover:text-primary transition-colors">{t.howItWorks}</Link></li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <h4 className="font-display font-semibold text-foreground mb-4">{t.resources}</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://e.cash"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  {t.aboutEcash}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://e.cash/wallets"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  {t.getWallet}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://paybutton.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  {t.payButtonDocs}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
            </ul>
          </motion.div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-border/30 flex flex-col md:flex-row items-center justify-between gap-4">
          <p 
            className="text-sm text-muted-foreground cursor-default select-none"
            onClick={handleCopyrightClick}
          >
            {t.copyright}
          </p>
          <p className="text-xs text-muted-foreground">
            {t.disclaimer}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
