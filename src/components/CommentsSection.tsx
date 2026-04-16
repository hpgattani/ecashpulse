import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Send, Loader2, Trash2, Reply, X, Heart, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  position?: string | null;
  parent_id?: string | null;
  like_count: number;
  liked_by_me: boolean;
}

interface CommentWithReplies extends Comment {
  replies: Comment[];
}

interface CommentsSectionProps {
  predictionId: string;
}

const CommentsSection = ({ predictionId }: CommentsSectionProps) => {
  const { user, sessionToken } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id, parent_id")
        .eq("prediction_id", predictionId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (error) throw error;

      const commentIds = (data || []).map((c) => c.id);
      const userIds = [...new Set((data || []).map((c) => c.user_id))];

      let profileMap: Record<string, string | null> = {};
      let positionMap: Record<string, string | null> = {};
      let likeCountMap: Record<string, number> = {};
      let myLikes = new Set<string>();

      if (userIds.length > 0) {
        const [profilesRes, betsRes] = await Promise.all([
          supabase.from("profiles").select("user_id, display_name").in("user_id", userIds),
          supabase.from("bets").select("user_id, position").eq("prediction_id", predictionId).eq("status", "confirmed").in("user_id", userIds),
        ]);
        profilesRes.data?.forEach((p) => { profileMap[p.user_id] = p.display_name; });
        betsRes.data?.forEach((b) => { positionMap[b.user_id] = b.position; });
      }

      // Fetch likes
      if (commentIds.length > 0) {
        const { data: likes } = await supabase
          .from("comment_likes")
          .select("comment_id, user_id")
          .in("comment_id", commentIds);

        likes?.forEach((l) => {
          likeCountMap[l.comment_id] = (likeCountMap[l.comment_id] || 0) + 1;
          if (user && l.user_id === user.id) myLikes.add(l.comment_id);
        });
      }

      const enriched: Comment[] = (data || []).map((c) => ({
        ...c,
        display_name: profileMap[c.user_id] || null,
        position: positionMap[c.user_id] || null,
        like_count: likeCountMap[c.id] || 0,
        liked_by_me: myLikes.has(c.id),
      }));

      setComments(enriched);
    } catch {
      console.error("Failed to fetch comments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchComments(); }, [predictionId]);

  const threadedComments = useMemo<CommentWithReplies[]>(() => {
    const topLevel: CommentWithReplies[] = [];
    const replyMap: Record<string, Comment[]> = {};

    comments.forEach((c) => {
      if (c.parent_id) {
        if (!replyMap[c.parent_id]) replyMap[c.parent_id] = [];
        replyMap[c.parent_id].push(c);
      } else {
        topLevel.push({ ...c, replies: [] });
      }
    });

    topLevel.forEach((t) => { t.replies = replyMap[t.id] || []; });
    return topLevel;
  }, [comments]);

  const totalCount = comments.length;

  const handleSubmit = async () => {
    if (!newComment.trim() || !sessionToken || !user) return;
    setSubmitting(true);
    try {
      const body: Record<string, string> = {
        prediction_id: predictionId,
        content: newComment.trim(),
      };
      if (replyingTo) body.parent_id = replyingTo.id;

      const { data, error } = await supabase.functions.invoke("add-comment", {
        body,
        headers: { "x-session-token": sessionToken },
      });

      if (error || data?.error) {
        toast.error(data?.error || "Failed to add comment");
        return;
      }

      setNewComment("");
      setReplyingTo(null);
      fetchComments();
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!sessionToken) return;
    try {
      const { data, error } = await supabase.functions.invoke("delete-comment", {
        body: { comment_id: commentId, session_token: sessionToken },
      });
      if (error || data?.error) {
        toast.error("Failed to delete comment");
        return;
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId && c.parent_id !== commentId));
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  const handleToggleLike = async (commentId: string) => {
    if (!sessionToken || !user) {
      toast.error("Log in to like comments");
      return;
    }

    // Optimistic update
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, liked_by_me: !c.liked_by_me, like_count: c.liked_by_me ? c.like_count - 1 : c.like_count + 1 }
          : c
      )
    );

    try {
      const { error } = await supabase.functions.invoke("toggle-comment-like", {
        body: { comment_id: commentId },
        headers: { "x-session-token": sessionToken },
      });
      if (error) {
        // Revert on failure
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, liked_by_me: !c.liked_by_me, like_count: c.liked_by_me ? c.like_count - 1 : c.like_count + 1 }
              : c
          )
        );
      }
    } catch {
      // Revert
      fetchComments();
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <motion.div
      key={comment.id}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-3 rounded-lg bg-muted/30 group ${isReply ? "ml-4 border-l-2 border-primary/20" : ""}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {comment.display_name || "Anonymous"}
          </span>
          {comment.position && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              comment.position === "yes"
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}>
              {comment.position.toUpperCase()}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
        </div>
        <div className="flex items-center gap-1">
          {user && sessionToken && !isReply && (
            <button
              onClick={() => setReplyingTo(comment)}
              className="opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
              title="Reply"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
          )}
          {user?.id === comment.user_id && (
            <button
              onClick={() => handleDelete(comment.id)}
              className="opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <p className="text-sm text-foreground/90 mb-1.5">{comment.content}</p>
      <button
        onClick={() => handleToggleLike(comment.id)}
        className={`flex items-center gap-1 text-xs transition-colors ${
          comment.liked_by_me
            ? "text-red-400"
            : "text-muted-foreground hover:text-red-400"
        }`}
      >
        <Heart className={`w-3.5 h-3.5 ${comment.liked_by_me ? "fill-red-400" : ""}`} />
        {comment.like_count > 0 && <span>{comment.like_count}</span>}
      </button>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-card mt-6 overflow-hidden"
    >
      <div className="p-4 md:p-6 border-b border-border/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-lg text-foreground">
            Comments ({totalCount})
          </h2>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {user && sessionToken ? (
          <div className="space-y-2">
            {replyingTo && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-1.5">
                <Reply className="w-3 h-3" />
                <span>Replying to <strong className="text-foreground">{replyingTo.display_name || "Anonymous"}</strong></span>
                <button onClick={() => setReplyingTo(null)} className="ml-auto hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !submitting && handleSubmit()}
                placeholder={replyingTo ? "Write a reply..." : "Share your thoughts..."}
                maxLength={1000}
                className="flex-1 rounded-lg bg-muted/50 border border-border/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || !newComment.trim()}
                className="shrink-0"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            Log in to leave a comment
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : threadedComments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No comments yet</p>
            <p className="text-xs mt-1">Be the first to share your view</p>
          </div>
        ) : (
          <div className="space-y-3">
            {threadedComments.map((comment) => (
              <div key={comment.id}>
                {renderComment(comment)}
                {comment.replies.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {comment.replies.map((reply) => renderComment(reply, true))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default CommentsSection;
