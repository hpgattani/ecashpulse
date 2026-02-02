import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Lock, Shield, X, Loader2, SmilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useChatEncryption } from '@/hooks/useChatEncryption';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface ChatReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

interface ChatMessage {
  id: string;
  user_id: string;
  encrypted_content: string;
  iv: string;
  created_at: string;
  decrypted_content?: string;
  display_name?: string;
  avatar_url?: string;
  reactions?: ChatReaction[];
}

const MAX_MESSAGE_LENGTH = 500;
const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '🔥', '👎', '🎯', '💎'];
const SPAM_PATTERNS = [
  /(.)\1{10,}/i,
  /(https?:\/\/[^\s]+){3,}/i,
  /\b(buy|sell|free|click|subscribe|follow)\b.*\b(now|here|link)\b/i,
];

export const ChatRoom = () => {
  const { user, profile, sessionToken } = useAuth();
  const { encrypt, decrypt } = useChatEncryption();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Decrypt messages
  const decryptMessages = useCallback(async (msgs: ChatMessage[]): Promise<ChatMessage[]> => {
    const decrypted = await Promise.all(
      msgs.map(async (msg) => ({
        ...msg,
        decrypted_content: await decrypt(msg.encrypted_content, msg.iv)
      }))
    );
    return decrypted;
  }, [decrypt]);

  // Load messages with user info and reactions
  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, user_id, encrypted_content, iv, created_at')
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    if (data) {
      // Get user profiles for display names
      const userIds = [...new Set(data.map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      // Get reactions for all messages
      const messageIds = data.map(m => m.id);
      const { data: reactions } = await supabase
        .from('chat_reactions')
        .select('id, message_id, user_id, emoji')
        .in('message_id', messageIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const reactionsByMessage = new Map<string, ChatReaction[]>();
      reactions?.forEach(r => {
        if (!reactionsByMessage.has(r.message_id)) {
          reactionsByMessage.set(r.message_id, []);
        }
        reactionsByMessage.get(r.message_id)!.push(r);
      });
      
      const messagesWithProfiles = data.map(msg => ({
        ...msg,
        display_name: profileMap.get(msg.user_id)?.display_name || 'Anonymous',
        avatar_url: profileMap.get(msg.user_id)?.avatar_url,
        reactions: reactionsByMessage.get(msg.id) || []
      }));

      const decrypted = await decryptMessages(messagesWithProfiles);
      setMessages(decrypted);
    }
    setLoading(false);
  }, [decryptMessages]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!isOpen) return;

    loadMessages();

    const messagesChannel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;
          
          const { data: msgProfile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('user_id', newMsg.user_id)
            .single();

          const decryptedContent = await decrypt(newMsg.encrypted_content, newMsg.iv);
          
          setMessages(prev => [...prev, {
            ...newMsg,
            decrypted_content: decryptedContent,
            display_name: msgProfile?.display_name || 'Anonymous',
            avatar_url: msgProfile?.avatar_url,
            reactions: []
          }]);
        }
      )
      .subscribe();

    const reactionsChannel = supabase
      .channel('chat-reactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_reactions' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newReaction = payload.new as ChatReaction;
            setMessages(prev => prev.map(msg => {
              if (msg.id === newReaction.message_id) {
                return {
                  ...msg,
                  reactions: [...(msg.reactions || []), newReaction]
                };
              }
              return msg;
            }));
          } else if (payload.eventType === 'DELETE') {
            const oldReaction = payload.old as { id: string; message_id: string };
            setMessages(prev => prev.map(msg => {
              if (msg.id === oldReaction.message_id) {
                return {
                  ...msg,
                  reactions: (msg.reactions || []).filter(r => r.id !== oldReaction.id)
                };
              }
              return msg;
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(reactionsChannel);
    };
  }, [isOpen, loadMessages, decrypt]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Client-side spam check
  const isSpam = (content: string): boolean => {
    return SPAM_PATTERNS.some(pattern => pattern.test(content));
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !sessionToken || sending) return;

    const trimmedMessage = newMessage.trim();

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      toast.error(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`);
      return;
    }

    if (isSpam(trimmedMessage)) {
      toast.error('Message blocked: Spam detected');
      return;
    }

    setSending(true);

    try {
      const { encrypted, iv } = await encrypt(trimmedMessage);

      const { data, error } = await supabase.functions.invoke('send-chat-message', {
        body: {
          session_token: sessionToken,
          encrypted_content: encrypted,
          iv
        }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'Failed to send message');
        return;
      }

      setNewMessage('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Send error:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!sessionToken) return;

    setReactingTo(messageId);

    try {
      const { data, error } = await supabase.functions.invoke('toggle-chat-reaction', {
        body: {
          session_token: sessionToken,
          message_id: messageId,
          emoji
        }
      });

      if (error || data?.error) {
        toast.error(data?.error || 'Failed to add reaction');
      }
    } catch (error) {
      console.error('Reaction error:', error);
      toast.error('Failed to add reaction');
    } finally {
      setReactingTo(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group reactions by emoji with counts
  const getReactionSummary = (reactions: ChatReaction[] = []) => {
    const summary: { emoji: string; count: number; userReacted: boolean }[] = [];
    const emojiMap = new Map<string, { count: number; userReacted: boolean }>();

    reactions.forEach(r => {
      if (!emojiMap.has(r.emoji)) {
        emojiMap.set(r.emoji, { count: 0, userReacted: false });
      }
      const entry = emojiMap.get(r.emoji)!;
      entry.count++;
      if (r.user_id === user?.id) {
        entry.userReacted = true;
      }
    });

    emojiMap.forEach((value, emoji) => {
      summary.push({ emoji, ...value });
    });

    return summary;
  };

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Chat Toggle Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 shadow-lg bg-primary hover:bg-primary/90"
        size="icon"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-6rem)] bg-card border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              <span className="font-semibold">eCash Pulse Chat</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="w-3 h-3" />
                <span>E2E Encrypted</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Security Notice */}
          <div className="px-4 py-2 bg-primary/10 border-b border-border flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3 h-3 text-primary" />
            <span>Messages are AES-256-GCM encrypted. Rate limited to prevent spam.</span>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No messages yet. Start the conversation!
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => {
                  const isOwn = msg.user_id === user.id;
                  const reactionSummary = getReactionSummary(msg.reactions);
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="max-w-[80%] group">
                        <div
                          className={`rounded-lg px-3 py-2 ${
                            isOwn
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          {!isOwn && (
                            <div className="text-xs font-medium mb-1 opacity-70">
                              {msg.display_name}
                            </div>
                          )}
                          <div className="text-sm break-words">
                            {msg.decrypted_content}
                          </div>
                          <div className={`text-[10px] mt-1 ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                            {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                          </div>
                        </div>

                        {/* Reactions Display */}
                        {reactionSummary.length > 0 && (
                          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            {reactionSummary.map(({ emoji, count, userReacted }) => (
                              <button
                                key={emoji}
                                onClick={() => handleReaction(msg.id, emoji)}
                                className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                                  userReacted 
                                    ? 'bg-primary/20 border-primary/50' 
                                    : 'bg-muted border-border hover:bg-muted/80'
                                }`}
                              >
                                {emoji} {count}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Add Reaction Button */}
                        <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mt-1`}>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-muted-foreground hover:text-foreground p-1 rounded"
                                disabled={reactingTo === msg.id}
                              >
                                {reactingTo === msg.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <SmilePlus className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2" side="top">
                              <div className="flex gap-1">
                                {ALLOWED_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleReaction(msg.id, emoji)}
                                    className="text-lg hover:scale-125 transition-transform p-1"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-border bg-muted/30">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                disabled={sending}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                size="icon"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground mt-2 text-right">
              {newMessage.length}/{MAX_MESSAGE_LENGTH}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
