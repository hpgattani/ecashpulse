import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, User, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileModal = ({ isOpen, onClose }: ProfileModalProps) => {
  const [step, setStep] = useState<'connect' | 'profile'>('connect');
  const [username, setUsername] = useState('');
  const [ecashAddress, setEcashAddress] = useState('');
  const [copied, setCopied] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = () => {
    if (!ecashAddress.startsWith('ecash:')) {
      toast({
        title: 'Invalid Address',
        description: 'Please enter a valid eCash address starting with "ecash:"',
        variant: 'destructive',
      });
      return;
    }
    setIsConnected(true);
    setStep('profile');
    toast({
      title: 'Wallet Connected!',
      description: 'Your eCash address has been linked.',
    });
  };

  const handleCreateProfile = () => {
    if (!username.trim()) {
      toast({
        title: 'Username Required',
        description: 'Please enter a username for your profile.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Profile Created!',
      description: `Welcome to eCash Pulse, ${username}!`,
    });
    onClose();
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(ecashAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetAndClose = () => {
    setStep('connect');
    setIsConnected(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetAndClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 p-4"
          >
            <div className="glass-card glow-primary p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    {step === 'connect' ? (
                      <Wallet className="w-6 h-6 text-primary-foreground" />
                    ) : (
                      <User className="w-6 h-6 text-primary-foreground" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-xl text-foreground">
                      {step === 'connect' ? 'Connect Wallet' : 'Create Profile'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {step === 'connect' ? 'Link your eCash address' : 'Set up your trader profile'}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={resetAndClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {step === 'connect' ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      eCash Address
                    </label>
                    <Input
                      placeholder="ecash:qr6pwzt7..."
                      value={ecashAddress}
                      onChange={(e) => setEcashAddress(e.target.value)}
                      className="bg-muted border-border"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Enter your eCash address to receive payouts
                    </p>
                  </div>

                  <Button
                    variant="glow"
                    className="w-full"
                    onClick={handleConnect}
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Address
                  </Button>

                  <div className="text-center">
                    <a
                      href="https://e.cash/wallets"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Don't have a wallet? Get one here
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Connected Address Display */}
                  <div className="p-3 rounded-lg bg-muted/50 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-sm text-foreground truncate">
                        {ecashAddress.slice(0, 15)}...{ecashAddress.slice(-8)}
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={copyAddress}>
                      {copied ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Username
                    </label>
                    <Input
                      placeholder="Choose a username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="bg-muted border-border"
                    />
                  </div>

                  <Button
                    variant="glow"
                    className="w-full"
                    onClick={handleCreateProfile}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Create Profile
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProfileModal;
