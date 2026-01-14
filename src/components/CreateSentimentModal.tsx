import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EyeOff, Loader2, AlertTriangle, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface CreateSentimentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const CREATION_FEE_XEC = 10000; // ~$1
const TREASURY_ADDRESS = 'ecash:qz2708636snqhsxu8wnlka78h6fdp77ar59jrf5035';

export function CreateSentimentModal({ open, onOpenChange, onSuccess }: CreateSentimentModalProps) {
  const { user, sessionToken } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
    setTxHash('');
    setStep('form');
  };

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
