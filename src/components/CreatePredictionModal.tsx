import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Lightbulb, 
  AlertCircle, 
  Sparkles, 
  CalendarIcon,
  DollarSign,
  CheckCircle2,
  Plus,
  X,
  ListChecks
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";

const ESCROW_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";
const CREATION_FEE_USD = 1; // $1 USD fee

interface CreatePredictionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories = [
  { id: "politics", label: "Politics" },
  { id: "sports", label: "Sports" },
  { id: "crypto", label: "Crypto" },
  { id: "finance", label: "Finance" },
  { id: "geopolitics", label: "Geopolitics" },
  { id: "earnings", label: "Earnings" },
  { id: "tech", label: "Tech" },
  { id: "culture", label: "Culture" },
  { id: "world", label: "World" },
  { id: "economics", label: "Economics" },
  { id: "climate", label: "Climate & Science" },
  { id: "elections", label: "Elections" },
];

export const CreatePredictionModal = ({ open, onOpenChange }: CreatePredictionModalProps) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { prices } = useCryptoPrices();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("crypto");
  const [endDate, setEndDate] = useState<Date>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [feeInXEC, setFeeInXEC] = useState<number | null>(null);
  const [outcomes, setOutcomes] = useState<string[]>(["", "", ""]);

  // Detect if question requires multi-option outcomes
  const multiOptionKeywords = /^(where|which|who|what|how many|how much)\b/i;
  const isMultiOptionQuestion = multiOptionKeywords.test(title.trim());
  
  // Filter out empty outcomes
  const validOutcomes = outcomes.filter(o => o.trim().length > 0);

  // Calculate XEC amount from USD
  useEffect(() => {
    if (prices.ecash && prices.ecash > 0) {
      const xecAmount = Math.ceil(CREATION_FEE_USD / prices.ecash);
      setFeeInXEC(xecAmount);
    }
  }, [prices.ecash]);
  
  const handleOutcomeChange = (index: number, value: string) => {
    const newOutcomes = [...outcomes];
    newOutcomes[index] = value;
    setOutcomes(newOutcomes);
  };
  
  const addOutcome = () => {
    if (outcomes.length < 6) {
      setOutcomes([...outcomes, ""]);
    }
  };
  
  const removeOutcome = (index: number) => {
    if (outcomes.length > 2) {
      setOutcomes(outcomes.filter((_, i) => i !== index));
    }
  };

  // Form validation - moved before useEffect that depends on it
  const isFormValid = title.trim().length >= 10 && title.trim().endsWith("?") && endDate && feeInXEC && 
    (!isMultiOptionQuestion || validOutcomes.length >= 2);

  // Load PayButton script
  useEffect(() => {
    if (!document.querySelector('script[src*="paybutton"]')) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/@aspect-analytics/paybutton-meep@1.0.0/dist/paybutton.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Render PayButton when ready
  useEffect(() => {
    if (!open || !feeInXEC || paymentComplete || !isFormValid) return;

    // Wait for PayButton script to load and container to exist
    const renderPayButton = () => {
      const buttonContainer = document.getElementById("create-prediction-paybutton");
      if (!buttonContainer) {
        // Retry after a short delay if container doesn't exist yet
        setTimeout(renderPayButton, 100);
        return;
      }
      
      if (!(window as any).PayButton) {
        // Retry after a short delay if script isn't loaded yet
        setTimeout(renderPayButton, 200);
        return;
      }

      // Clear previous
      buttonContainer.innerHTML = "";

      (window as any).PayButton.render(buttonContainer, {
        to: ESCROW_ADDRESS,
        amount: feeInXEC,
        currency: "XEC",
        text: `Pay $${CREATION_FEE_USD} (${feeInXEC.toLocaleString()} XEC)`,
        hoverText: "Confirm",
        successText: "Paid!",
        autoClose: true,
        theme: {
          palette: {
            primary: "#10b981",
            secondary: "#1e293b",
            tertiary: "#ffffff",
          },
        },
        onSuccess: async (txResult: any) => {
          let txHash: string | undefined;
          if (typeof txResult === "string") {
            txHash = txResult;
          } else if (txResult?.hash) {
            txHash = txResult.hash;
          } else if (txResult?.txid) {
            txHash = txResult.txid;
          }
          
          setPaymentComplete(true);
          await submitPrediction(txHash);
        },
        onError: (error: any) => {
          console.error("PayButton error:", error);
          toast.error("Payment failed", { description: "Please try again." });
        },
      });
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(renderPayButton, 50);
    return () => clearTimeout(timeoutId);
  }, [open, feeInXEC, paymentComplete, isFormValid]);

  const submitPrediction = async (txHash?: string) => {
    if (!user || !title || !endDate) return;
    
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-prediction", {
        body: {
          title: title.trim(),
          description: description.trim() || null,
          category,
          end_date: endDate.toISOString(),
          user_id: user.id,
          tx_hash: txHash,
          fee_amount: feeInXEC,
          outcomes: isMultiOptionQuestion ? validOutcomes : null,
        },
      });

      if (error) throw error;

      toast.success("Prediction Submitted!", {
        description: "Your prediction is now live!",
      });
      
      // Reset form
      setTitle("");
      setDescription("");
      setCategory("crypto");
      setEndDate(undefined);
      setPaymentComplete(false);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Submit error:", err);
      toast.error("Failed to submit", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // isFormValid is now defined earlier in the component

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Prediction</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">{t.connectWalletDesc}</p>
            <Button onClick={() => onOpenChange(false)}>{t.cancel}</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            Create Your Prediction
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* AI Resolution Tip */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-primary/10 border border-primary/20"
          >
            <div className="flex gap-3">
              <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground mb-1">AI-Resolvable Topics Preferred</p>
                <p className="text-muted-foreground">
                  Create predictions that can be verified by AI using public data sources 
                  (crypto prices, sports scores, election results, etc.) for automatic resolution.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-foreground font-medium">Prediction Question *</Label>
            <Input
              id="title"
              placeholder="Will Bitcoin reach $150k by end of 2026?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(
                title && !title.trim().endsWith("?") && "border-destructive",
                isMultiOptionQuestion && "border-primary"
              )}
            />
            <p className="text-xs text-muted-foreground">
              {isMultiOptionQuestion 
                ? "Multi-option question detected - add outcome options below"
                : "Must be a clear Yes/No question ending with \"?\""}
            </p>
            {title && !title.trim().endsWith("?") && (
              <p className="text-xs text-destructive">Question must end with "?"</p>
            )}
          </div>

          {/* Multi-option outcomes */}
          {isMultiOptionQuestion && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/20"
            >
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-primary" />
                <Label className="text-primary font-medium">Outcome Options *</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Add 2-6 possible outcomes for this prediction
              </p>
              <div className="space-y-2">
                {outcomes.map((outcome, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder={`Option ${index + 1} (e.g., ${index === 0 ? 'Turkey' : index === 1 ? 'Switzerland' : 'Other'})`}
                      value={outcome}
                      onChange={(e) => handleOutcomeChange(index, e.target.value)}
                      className="flex-1"
                    />
                    {outcomes.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOutcome(index)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {outcomes.length < 6 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOutcome}
                  className="w-full gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Option
                </Button>
              )}
              {validOutcomes.length < 2 && (
                <p className="text-xs text-destructive">At least 2 outcomes are required</p>
              )}
            </motion.div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground font-medium">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Add context or resolution criteria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label className="text-foreground font-medium">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label className="text-foreground font-medium">Resolution Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Fee Info */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Creation Fee</span>
              <div className="flex items-center gap-1 text-primary font-bold">
                <DollarSign className="w-4 h-4" />
                {CREATION_FEE_USD} USD
              </div>
            </div>
            {feeInXEC && (
              <p className="text-xs text-muted-foreground">
                ≈ {feeInXEC.toLocaleString()} XEC at current price
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Payments are non-refundable. Create your topic responsibly.
            </p>
          </div>

          {/* Review Notice */}
          <div className="flex gap-2 text-xs text-muted-foreground">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              Predictions must be clear, verifiable, and appropriate. 
              Create topics that can be resolved by AI/Oracle using public data. Payments are non-refundable.
            </p>
          </div>

          {/* Payment / Submit */}
          {paymentComplete ? (
            <div className="flex items-center justify-center gap-2 py-4 text-primary">
              <CheckCircle2 className="w-5 h-5" />
              <span>Payment complete! Submitting...</span>
            </div>
          ) : isFormValid ? (
            <div id="create-prediction-paybutton" className="min-h-[50px] flex justify-center" />
          ) : (
            <Button disabled className="w-full">
              Complete form to continue
            </Button>
          )}

          {/* Cancel Button */}
          {!paymentComplete && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePredictionModal;
