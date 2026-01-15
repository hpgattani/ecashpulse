import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
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
  ArrowLeft,
  Share2,
  Plus,
  X,
  ListChecks
} from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const ESCROW_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";
const CREATION_FEE_USD = 1;

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

const CreatePrediction = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { prices } = useCryptoPrices();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("crypto");
  const [endDate, setEndDate] = useState<Date>();
  const [dateInputValue, setDateInputValue] = useState("");
  const [endTime, setEndTime] = useState("23:59");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [feeInXEC, setFeeInXEC] = useState<number | null>(null);
  const [outcomes, setOutcomes] = useState<string[]>(["", "", ""]);

  // Detect if question requires multi-option outcomes
  const multiOptionKeywords = /^(where|which|who|what|how many|how much)\b/i;
  const isMultiOptionQuestion = multiOptionKeywords.test(title.trim());
  
  // Filter out empty outcomes
  const validOutcomes = outcomes.filter(o => o.trim().length > 0);
  
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

  const handleDateInputChange = (value: string) => {
    setDateInputValue(value);
    // Try to parse the date in common formats
    const formats = ["MM/dd/yyyy", "yyyy-MM-dd", "dd/MM/yyyy", "MMM d, yyyy"];
    for (const fmt of formats) {
      const parsed = parse(value, fmt, new Date());
      if (isValid(parsed) && parsed > new Date()) {
        setEndDate(parsed);
        return;
      }
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    setEndDate(date);
    if (date) {
      setDateInputValue(format(date, "MM/dd/yyyy"));
    }
  };

  useEffect(() => {
    if (prices.ecash && prices.ecash > 0) {
      const xecAmount = Math.ceil(CREATION_FEE_USD / prices.ecash);
      setFeeInXEC(xecAmount);
    }
  }, [prices.ecash]);

  useEffect(() => {
    if (!document.querySelector('script[src*="paybutton"]')) {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/@aspect-analytics/paybutton-meep@1.0.0/dist/paybutton.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (!feeInXEC || paymentComplete || !title || !endDate) return;

    const buttonContainer = document.getElementById("create-prediction-paybutton-page");
    if (!buttonContainer || !(window as any).PayButton) return;

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
  }, [feeInXEC, paymentComplete, title, endDate]);

  const submitPrediction = async (txHash?: string) => {
    if (!user || !title || !endDate) return;
    
    // Combine date and time
    const [hours, minutes] = endTime.split(':').map(Number);
    const combinedDateTime = new Date(endDate);
    combinedDateTime.setHours(hours, minutes, 0, 0);
    
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-prediction", {
        body: {
          title: title.trim(),
          description: description.trim() || null,
          category,
          end_date: combinedDateTime.toISOString(),
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
      
      navigate("/");
    } catch (err: any) {
      console.error("Submit error:", err);
      toast.error("Failed to submit", { description: err.message });
      setPaymentComplete(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  const isFormValid = title.trim().length >= 10 && title.trim().endsWith("?") && endDate && feeInXEC &&
    (!isMultiOptionQuestion || validOutcomes.length >= 2);

  return (
    <div className="min-h-screen">
      <Header />
      
      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="max-w-2xl mx-auto">
          {/* Back button and share */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShareLink}
              className="gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 md:p-8 dark:bg-[hsl(220_18%_8%/0.95)] bg-white/95"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-primary/10">
                <Lightbulb className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Create Your Prediction</h1>
            </div>

            {!user ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">{t.connectWalletDesc}</p>
                <Button onClick={() => navigate("/auth")}>Connect Wallet</Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* AI Resolution Tip */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
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
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="space-y-2"
                >
                  <Label htmlFor="title">Prediction Question *</Label>
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
                </motion.div>

                {/* Multi-option outcomes */}
                {isMultiOptionQuestion && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ delay: 0.17 }}
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
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-2"
                >
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Add context or resolution criteria..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </motion.div>

                {/* Category */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="space-y-2"
                >
                  <Label>Category</Label>
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
                </motion.div>

                {/* End Date */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-2"
                >
                  <Label>Betting Closes Date *</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="MM/DD/YYYY"
                      value={dateInputValue}
                      onChange={(e) => handleDateInputChange(e.target.value)}
                      className="flex-1"
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                        >
                          <CalendarIcon className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={handleCalendarSelect}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select when betting should close (no more bets accepted after this)
                  </p>
                </motion.div>

                {/* Betting Close Time */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.32 }}
                  className="space-y-2"
                >
                  <Label>Betting Closes Time *</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="HH"
                        min="0"
                        max="23"
                        value={endTime.split(':')[0]}
                        onChange={(e) => {
                          const hours = Math.min(23, Math.max(0, parseInt(e.target.value) || 0)).toString().padStart(2, '0');
                          setEndTime(`${hours}:${endTime.split(':')[1]}`);
                        }}
                        className="pr-12"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Hours</span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="MM"
                        min="0"
                        max="59"
                        value={endTime.split(':')[1]}
                        onChange={(e) => {
                          const minutes = Math.min(59, Math.max(0, parseInt(e.target.value) || 0)).toString().padStart(2, '0');
                          setEndTime(`${endTime.split(':')[0]}:${minutes}`);
                        }}
                        className="pr-16"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Minutes</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Set the exact time when betting closes (24h format, your local timezone)
                  </p>
                </motion.div>

                {/* Fee Info */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="p-4 rounded-lg bg-muted/50 border border-border"
                >
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
                </motion.div>

                {/* Review Notice */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex gap-2 text-xs text-muted-foreground"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>
                    Predictions must be clear, verifiable, and appropriate. 
                    Create topics that can be resolved by AI/Oracle using public data. Payments are non-refundable.
                  </p>
                </motion.div>

                {/* Payment / Submit */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  {paymentComplete ? (
                    <div className="flex items-center justify-center gap-2 py-4 text-primary">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Payment complete! Submitting...</span>
                    </div>
                  ) : isFormValid ? (
                    <div id="create-prediction-paybutton-page" className="min-h-[50px] flex justify-center" />
                  ) : (
                    <Button disabled className="w-full">
                      Complete form to continue
                    </Button>
                  )}
                </motion.div>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CreatePrediction;
