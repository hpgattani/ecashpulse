import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, Loader2, Copy, Check, EyeOff, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface SentimentVoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: {
    id: string;
    title: string;
    vote_cost: number;
  } | null;
  position: 'agree' | 'disagree' | null;
  onSuccess: () => void;
}

const TREASURY_ADDRESS = 'ecash:qz2708636snqhsxu8wnlka78h6fdp77ar59jrf5035';

export function SentimentVoteModal({ open, onOpenChange, topic, position, onSuccess }: SentimentVoteModalProps) {
  const { user, sessionToken } = useAuth();
  const [step, setStep] = useState<'info' | 'payment' | 'confirming'>('info');
  const [txHash, setTxHash] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  const handleConfirmVote = async () => {
    if (!txHash.trim()) {
      toast.error('Please enter the transaction hash');
      return;
    }
    if (!user || !sessionToken || !topic || !position) {
      toast.error('Missing required information');
      return;
    }

    setSubmitting(true);
    setStep('confirming');

    try {
      const { data, error } = await supabase.functions.invoke('submit-sentiment-vote', {
        body: {
          topic_id: topic.id,
          position,
          tx_hash: txHash.trim(),
          session_token: sessionToken
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Vote submitted anonymously!');
        onSuccess();
        onOpenChange(false);
        resetForm();
      } else {
        throw new Error(data.error || 'Failed to submit vote');
      }
    } catch (error: any) {
      console.error('Error submitting vote:', error);
      toast.error(error.message || 'Failed to submit vote');
      setStep('payment');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTxHash('');
    setStep('info');
  };

  if (!topic || !position) return null;

  const isAgree = position === 'agree';
  const voteCost = topic.vote_cost || 500;
  const voteCostUsd = (voteCost / 10000).toFixed(2);

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAgree ? (
              <ThumbsUp className="w-5 h-5 text-green-500" />
            ) : (
              <ThumbsDown className="w-5 h-5 text-red-500" />
            )}
            {isAgree ? 'Agree' : 'Disagree'} with Topic
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            "{topic.title}"
          </DialogDescription>
        </DialogHeader>

        {step === 'info' && (
          <div className="space-y-4">
            <div className={`rounded-lg p-4 border ${isAgree ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isAgree ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  {isAgree ? (
                    <ThumbsUp className="w-5 h-5 text-green-500" />
                  ) : (
                    <ThumbsDown className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    You're voting: <span className={isAgree ? 'text-green-500' : 'text-red-500'}>{isAgree ? 'AGREE' : 'DISAGREE'}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">Amount: {voteCost.toLocaleString()} XEC (~${voteCostUsd})</p>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Shield className="w-4 h-4" />
                <span className="font-medium text-sm">Anonymous Voting</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your wallet address will be <strong className="text-foreground">cryptographically hashed</strong> and only a 
                redacted version (e.g., a1b2****c3d4) will be stored. Your identity remains private.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <EyeOff className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">No Payouts</span>
              </div>
              <p className="text-xs text-muted-foreground">
                All votes contribute to eCash Pulse treasury. This is purely for sentiment gauging.
              </p>
            </div>

            <Button className="w-full" onClick={() => setStep('payment')}>
              Continue to Payment
            </Button>
          </div>
        )}

        {step === 'payment' && (
          <div className="space-y-4">
            <div className={`border rounded-lg p-4 space-y-3 ${isAgree ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <p className="text-sm text-foreground font-medium">Send exactly:</p>
              <div className="flex items-center justify-between bg-background rounded-lg p-3">
                <span className={`font-mono text-lg font-bold ${isAgree ? 'text-green-500' : 'text-red-500'}`}>
                  {voteCost.toLocaleString()} XEC
                </span>
                <Badge variant="outline" className={isAgree ? 'border-green-500/30' : 'border-red-500/30'}>
                  ~${voteCostUsd}
                </Badge>
              </div>
              
              <p className="text-sm text-foreground font-medium mt-4">To treasury address:</p>
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
              <Button variant="outline" className="flex-1" onClick={() => setStep('info')}>
                Back
              </Button>
              <Button 
                className={`flex-1 ${isAgree ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                onClick={handleConfirmVote} 
                disabled={!txHash.trim()}
              >
                Submit Vote
              </Button>
            </div>
          </div>
        )}

        {step === 'confirming' && (
          <div className="py-8 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-foreground font-medium">Verifying & recording vote...</p>
            <p className="text-sm text-muted-foreground mt-2">
              Your address is being anonymized
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
