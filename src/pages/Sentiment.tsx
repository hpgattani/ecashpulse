import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* =======================
   CONFIG (SOURCE OF TRUTH)
======================= */
const TREASURY_ADDRESS = "ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp";

const CREATE_TOPIC_USD = 1;

/* =======================
   PROPS
======================= */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const CreateSentimentModal = ({ open, onOpenChange, onSuccess }: Props) => {
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [txHash, setTxHash] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [xecPriceUsd, setXecPriceUsd] = useState<number | null>(null);

  /* =======================
     FETCH LIVE XEC PRICE
     (CoinGecko via Supabase)
  ======================= */
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const { data } = await supabase.functions.invoke("coingecko-price", { body: { symbol: "ecash" } });
        setXecPriceUsd(data?.usd ?? null);
      } catch {
        setXecPriceUsd(null);
      }
    };

    fetchPrice();
  }, []);

  const costXec = xecPriceUsd !== null ? Math.ceil(CREATE_TOPIC_USD / xecPriceUsd) : null;

  /* =======================
     SUBMIT
  ======================= */
  const handleConfirm = async () => {
    if (!user) {
      toast.error("Connect wallet first");
      return;
    }

    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (!txHash.trim()) {
      toast.error("Transaction hash required");
      return;
    }

    if (!costXec) {
      toast.error("Price unavailable");
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase.from("sentiment_topics").insert({
        title,
        description,
        vote_cost: 500,
        status: "active",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        creator_address_hash: user.id,
        create_tx_hash: txHash,
        create_cost_xec: costXec,
      });

      if (error) throw error;

      toast.success("Topic created");
      onOpenChange(false);
      onSuccess();

      setTitle("");
      setDescription("");
      setTxHash("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create topic");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Sentiment Topic</DialogTitle>
        </DialogHeader>

        {/* INFO */}
        <div className="text-sm text-muted-foreground mb-3">Create a topic for anonymous public sentiment. Fee:</div>

        {/* PAYMENT BOX */}
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <div className="flex justify-between items-center">
            <span className="text-sm">Send exactly:</span>
            <strong className="text-lg text-primary">{costXec ? `${costXec.toLocaleString()} XEC` : "Loading…"}</strong>
          </div>

          <div className="text-xs text-muted-foreground">(~${CREATE_TOPIC_USD})</div>

          <div className="mt-2">
            <span className="text-sm">To this address:</span>
            <div className="mt-1 p-2 rounded bg-background text-xs break-all">{TREASURY_ADDRESS}</div>
          </div>

          <div className="text-xs text-muted-foreground mt-2">Vote cost: 500 XEC (~$0.05) per vote</div>
        </div>

        {/* FORM */}
        <div className="space-y-4 mt-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <Label>Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div>
            <Label>Transaction Hash</Label>
            <Input
              placeholder="Paste your transaction hash here…"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Back
            </Button>
            <Button className="flex-1" onClick={handleConfirm} disabled={submitting || !costXec}>
              Confirm Payment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
