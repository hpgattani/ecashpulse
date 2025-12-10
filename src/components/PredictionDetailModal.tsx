import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Activity, Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Outcome } from '@/hooks/usePredictions';
import { toast } from '@/hooks/use-toast';

interface Prediction {
  id: string;
  question: string;
  description: string;
  category: string;
  yesOdds: number;
  noOdds: number;
  volume: number;
  endDate: string;
  isMultiOption?: boolean;
  outcomes?: Outcome[];
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  display_name?: string;
}

interface BetActivity {
  id: string;
  amount: number;
  position: string;
  created_at: string;
  ecash_address: string;
  outcome_label?: string;
}

interface PredictionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  prediction: Prediction;
  onSelectOutcome: (outcome: Outcome) => void;
}

const PredictionDetailModal = ({ isOpen, onClose, prediction, onSelectOutcome }: PredictionDetailModalProps) => {
  const [activeTab, setActiveTab] = useState<'outcomes' | 'comments' | 'activity'>('outcomes');
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<BetActivity[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, sessionToken } = useAuth();

  useEffect(() => {
    if (isOpen) {
      fetchComments();
      fetchActivity();
    }
  }, [isOpen, prediction.id]);

  // Realtime subscription for comments
  useEffect(() => {
    if (!isOpen) return;

    const channel = supabase
      .channel(`comments-${prediction.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `prediction_id=eq.${prediction.id}`
        },
        () => fetchComments()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, prediction.id]);

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        user_id,
        profiles!inner(display_name)
      `)
      .eq('prediction_id', prediction.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setComments(data.map((c: any) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        user_id: c.user_id,
        display_name: c.profiles?.display_name || 'Anonymous'
      })));
    }
  };

  const fetchActivity = async () => {
    const { data, error } = await supabase
      .from('bets')
      .select(`
        id,
        amount,
        position,
        created_at,
        outcome_id,
        users!inner(ecash_address),
        outcomes(label)
      `)
      .eq('prediction_id', prediction.id)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setActivities(data.map((b: any) => ({
        id: b.id,
        amount: b.amount,
        position: b.position,
        created_at: b.created_at,
        ecash_address: b.users?.ecash_address || 'Unknown',
        outcome_label: b.outcomes?.label
      })));
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user || !sessionToken) return;
    
    setLoading(true);
    const { error } = await supabase.functions.invoke('add-comment', {
      body: {
        prediction_id: prediction.id,
        content: newComment.trim()
      },
      headers: {
        'x-session-token': sessionToken
      }
    });

    if (error) {
      toast({ title: 'Error', description: 'Failed to post comment', variant: 'destructive' });
    } else {
      setNewComment('');
      fetchComments();
    }
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const formatAddress = (addr: string) => {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 10)}...${addr.slice(-4)}`;
  };

  const formatXEC = (satoshis: number) => {
    const xec = satoshis / 100;
    return xec.toLocaleString() + ' XEC';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl z-50 p-4 max-h-[90vh]"
          >
            <div className="glass-card glow-primary p-6 flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 pr-4">
                  <h2 className="font-display font-bold text-lg text-foreground">
                    {prediction.question}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {prediction.description}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-4 border-b border-border pb-2">
                <Button
                  variant={activeTab === 'outcomes' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('outcomes')}
                  className="gap-1"
                >
                  <Users className="w-4 h-4" />
                  Outcomes
                </Button>
                <Button
                  variant={activeTab === 'activity' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('activity')}
                  className="gap-1"
                >
                  <Activity className="w-4 h-4" />
                  Activity
                </Button>
                <Button
                  variant={activeTab === 'comments' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('comments')}
                  className="gap-1"
                >
                  <MessageSquare className="w-4 h-4" />
                  Comments
                </Button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto min-h-[200px]">
                {activeTab === 'outcomes' && prediction.outcomes && (
                  <div className="space-y-2">
                    {prediction.outcomes.map((outcome) => (
                      <button
                        key={outcome.id}
                        onClick={() => {
                          onSelectOutcome(outcome);
                          onClose();
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <span className="text-sm text-foreground font-medium">{outcome.label}</span>
                        <span className="text-sm font-bold text-primary">{outcome.odds}%</span>
                      </button>
                    ))}
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div className="space-y-2">
                    {activities.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No betting activity yet</p>
                    ) : (
                      activities.map((act) => (
                        <div key={act.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${act.position === 'yes' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            <span className="text-xs font-mono text-muted-foreground">
                              {formatAddress(act.ecash_address)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">
                              {act.outcome_label ? act.outcome_label : (act.position === 'yes' ? 'Yes' : 'No')}
                            </span>
                            <span className="text-sm text-primary font-bold">{formatXEC(act.amount)}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(act.created_at)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'comments' && (
                  <div className="space-y-4">
                    {user && (
                      <div className="flex gap-2">
                        <Textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          className="flex-1 bg-muted border-border resize-none min-h-[60px]"
                        />
                        <Button
                          onClick={handleSubmitComment}
                          disabled={!newComment.trim() || loading}
                          size="icon"
                          className="h-auto"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    
                    {comments.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No comments yet</p>
                    ) : (
                      comments.map((comment) => (
                        <div key={comment.id} className="p-3 rounded-lg bg-muted/30">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{comment.display_name}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{comment.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PredictionDetailModal;
