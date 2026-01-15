import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EyeOff, Loader2, AlertTriangle, Copy, Check, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';

interface CreateSentimentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CREATION_FEE_XEC = 10000; // ~$1
const TREASURY_ADDRESS = 'ecash:qz2708636snqhsxu8wnlka78h6fdp77ar59jrf5035';

// Slider range: $0.05 to $5 in $0.10 increments (500 XEC to 50,000 XEC)
const MIN_VOTE_COST = 500;
const MAX_VOTE_COST = 50000;
const VOTE_COST_STEP = 1000; // ~$0.10

export function CreateSentimentModal({ open, onOpenChange, onSuccess }: CreateSentimentModalProps) {
  const { user, sessionToken } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [voteCost, setVoteCost] = useState(5000); // Default ~$0.50
  const [step, setStep] = useState<'form' | 'payment' | 'confirming'>('form');
  const [txHash, setTxHash] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  const handleSubmitTopic = async () => {
    if (!title.trim()) {
      toast.error('Please enter a topic title');
      return;
    }
    if (title.length < 10) {
      toast.error('Topic title must be at least 10 characters');
      return;
    }
    setStep('payment');
  };

  const handleConfirmPayment = async () => {
    if (!txHash.trim()) {
      toast.error('Please enter the transaction hash');
      return;
    }
    if (!user || !sessionToken) {
      toast.error('Please connect your wallet');
      return;
    }

    setSubmitting(true);
    setStep('confirming');

    try {
      const { data, error } = await supabase.functions.invoke('create-sentiment-topic', {
        body: {
          title: title.trim(),
          description: description.trim() || null,
          vote_cost: voteCost,
          tx_hash: txHash.trim(),
          session_token: sessionToken
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Sentiment topic created!');
        onSuccess();
        onOpenChange(false);
        resetForm();
      } else {
        throw new Error(data.error || 'Failed to create topic');
      }
    } catch (error: any) {
      console.error('Error creating sentiment topic:', error);
      toast.error(error.message || 'Failed to create topic');
      setStep('payment');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setVoteCost(5000);
    setTxHash('');
    setStep('form');
  };

  // Calculate USD equivalent (~$0.0001 per XEC)
  const voteCostUsd = (voteCost / 10000).toFixed(2);
  const sliderPercent = ((voteCost - MIN_VOTE_COST) / (MAX_VOTE_COST - MIN_VOTE_COST)) * 100;

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-primary" />
            Create Sentiment Topic
          </DialogTitle>
          <DialogDescription>
            Create a topic for anonymous public sentiment. Fee: 10,000 XEC (~$1)
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-foreground">Topic Title</Label>
              <Input
                id="title"
                placeholder="e.g., Should eCash focus more on DeFi?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                {title.length}/200 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-foreground">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add more context to your topic..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/500 characters
              </p>
            </div>

            {/* Liquid Glass Vote Cost Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-foreground flex items-center gap-2">
                  <Coins className="w-4 h-4 text-primary" />
                  Vote Cost
                </Label>
                <Badge variant="outline" className="font-mono">
                  ~${voteCostUsd}
                </Badge>
              </div>
              
              <div className="relative">
                {/* Liquid Glass Slider Track */}
                <div className="relative h-14 rounded-2xl">
                  {/* Glass background with proper styling */}
                  <div 
                    className="absolute inset-0 rounded-2xl overflow-hidden"
                    style={{
                      background: 'var(--glass-bg)',
                      boxShadow: 'var(--glass-shadow)',
                      backdropFilter: 'var(--glass-blur)',
                    }}
                  >
                    {/* Specular highlight */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent" />
                  </div>
                  
                  {/* Animated fill */}
                  <motion.div 
                    className="absolute top-1 bottom-1 left-1 rounded-xl overflow-hidden"
                    initial={false}
                    animate={{ width: `calc(${Math.max(5, sliderPercent)}% - 8px)` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  >
                    {/* Gradient fill */}
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/40 via-primary/60 to-primary/50 rounded-xl" />
                    
                    {/* Shimmer effect */}
                    <motion.div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      animate={{ x: ['-200%', '200%'] }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
                    />
                    
                    {/* Top highlight */}
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent rounded-t-xl" />
                  </motion.div>
                  
                  {/* Slider Input - on top for interaction */}
                  <input
                    type="range"
                    min={MIN_VOTE_COST}
                    max={MAX_VOTE_COST}
                    step={VOTE_COST_STEP}
                    value={voteCost}
                    onChange={(e) => setVoteCost(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-40"
                  />
                  
                  {/* Value display inside slider */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <motion.span 
                      key={voteCost}
                      initial={{ scale: 1.1, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.15 }}
                      className="font-display font-bold text-lg text-foreground drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
                    >
                      {voteCost.toLocaleString()} XEC
                    </motion.span>
                  </div>
                  
                  {/* Thumb indicator - properly clamped */}
                  <motion.div
                    className="absolute top-1/2 w-7 h-7 pointer-events-none z-30"
                    style={{ 
                      translateY: '-50%',
                      left: `clamp(4px, calc(${sliderPercent}% - 14px), calc(100% - 32px))`
                    }}
                    initial={false}
                    animate={{ 
                      left: `clamp(4px, calc(${sliderPercent}% - 14px), calc(100% - 32px))` 
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  >
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-primary via-primary to-primary/80 shadow-lg shadow-primary/40 border-2 border-white/40">
                      <div className="absolute inset-1 rounded-full bg-gradient-to-b from-white/50 to-transparent" />
                    </div>
                  </motion.div>
                </div>
                
                {/* Range labels */}
                <div className="flex justify-between mt-2.5 text-xs text-muted-foreground px-1">
                  <span>$0.05</span>
                  <span className="text-foreground/50">drag to adjust</span>
                  <span>$5.00</span>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                Set the cost for each vote on your topic
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium text-foreground">Important</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 ml-6">
                <li>• Creation fee is non-refundable</li>
                <li>• Your address will be hashed for anonymity</li>
                <li>• Topic will be active for 7 days</li>
                <li>• All funds support eCash Pulse treasury</li>
              </ul>
            </div>

            <Button className="w-full" onClick={handleSubmitTopic}>
              Continue to Payment
            </Button>
          </div>
        )}

        {step === 'payment' && (
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
              <p className="text-sm text-foreground font-medium">Send exactly:</p>
              <div className="flex items-center justify-between bg-background rounded-lg p-3">
                <span className="font-mono text-lg font-bold text-primary">
                  {CREATION_FEE_XEC.toLocaleString()} XEC
                </span>
                <Badge variant="outline">~$1</Badge>
              </div>
              
              <p className="text-sm text-foreground font-medium mt-4">To this address:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background p-2 rounded break-all font-mono">
                  {TREASURY_ADDRESS}
                </code>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => handleCopy(TREASURY_ADDRESS)}
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              
              <div className="mt-3 pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  Vote cost: <span className="text-foreground font-medium">{voteCost.toLocaleString()} XEC (~${voteCostUsd})</span> per vote
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="txHash" className="text-foreground">Transaction Hash</Label>
              <Input
                id="txHash"
                placeholder="Paste your transaction hash here..."
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep('form')}>
                Back
              </Button>
              <Button className="flex-1" onClick={handleConfirmPayment} disabled={!txHash.trim()}>
                Confirm Payment
              </Button>
            </div>
          </div>
        )}

        {step === 'confirming' && (
          <div className="py-8 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-foreground font-medium">Verifying transaction...</p>
            <p className="text-sm text-muted-foreground mt-2">
              This may take a moment
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}