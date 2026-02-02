import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, Send, Lock, Shield, X, Loader2, SmilePlus, Maximize2, Minimize2, Share2, AtSign, Coins } from 'lucide-react';
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

interface MentionUser {
  id: string;
  display_name: string;
  ecash_address: string;
}

interface TipData {
  recipient: string;
  recipientAddress: string;
  amount: number;
  rawText: string;
  note?: string;
}

const MAX_MESSAGE_LENGTH = 500;
const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '🔥', '👎', '🎯', '💎'];
const SPAM_PATTERNS = [
  /(.)\1{10,}/i,
  /(https?:\/\/[^\s]+){3,}/i,
  /\b(buy|sell|free|click|subscribe|follow)\b.*\b(now|here|link)\b/i,
];

// Parse /tip @username amount command
const parseTipCommand = (text: string): TipData | null => {
  const trimmed = text.trim();
  if (!/^\/tip\b/i.test(trimmed)) return null;

  // Support multiple formats:
  // - /tip @username 5000
  // - /tip @username 5000 xec
  // - /tip 5000 @username
  // - /tip 5000 xec @username
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const args = parts.slice(1);

  const usernameToken = args.find((p) => p.startsWith('@'));
  const amountToken = args.find((p) => /^\d+$/.test(p));

  if (!usernameToken || !amountToken) return null;

  const recipient = usernameToken.replace(/^@/, '');
  const amount = parseInt(amountToken, 10);
  if (!recipient || !Number.isFinite(amount) || amount <= 0) return null;

  const note = args
    .filter((p) => p !== usernameToken && p !== amountToken && p.toLowerCase() !== 'xec')
    .join(' ')
    .trim();

  return {
    recipient,
    recipientAddress: '', // resolved later
    amount,
    rawText: trimmed,
    note: note || undefined,
  };
};

import '@/types/paybutton.d.ts';

// TipPayButton component that properly initializes PayButton
const TipPayButton = ({
  to,
  amount,
  recipient,
  rawText,
}: {
  to: string;
  amount: number;
  recipient: string;
  rawText?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current) return;
    if (!to || !amount) return;

    const ensurePayButtonScript = () => {
      // index.html already includes this, but in case it fails / loads late, ensure it's present.
      if (document.querySelector('script[src*="paybutton"]')) return;
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@paybutton/paybutton/dist/paybutton.js';
      script.async = true;
      document.body.appendChild(script);
    };

    const tryRender = (attempt = 0) => {
      if (cancelled) return;
      if (!containerRef.current) return;

      const payButton = window.PayButton;
      if (!payButton?.render) {
        if (attempt < 30) window.setTimeout(() => tryRender(attempt + 1), 150);
        return;
      }

      // Clear and render into a fresh inner node (matches the working pattern elsewhere)
      containerRef.current.innerHTML = '';
      const buttonContainer = document.createElement('div');
      buttonContainer.id = `paybutton-tip-${Date.now()}`;
      containerRef.current.appendChild(buttonContainer);

      try {
        payButton.render(buttonContainer, {
          to,
          amount,
          currency: 'XEC',
          text: `Send ${amount.toLocaleString()} XEC`,
          hoverText: 'Send Tip',
          successText: 'Tip Sent! 💸',
          animation: 'slide',
          hideToasts: true,
          onSuccess: (tx) => {
            const extractTxHash = (value: unknown): string => {
              if (!value) return '';
              if (typeof value === 'string') return value;
              if (typeof value === 'object') {
                const v = value as any;
                return (
                  v.txid ||
                  v.txId ||
                  v.txHash ||
                  v.hash ||
                  v?.transaction?.txid ||
                  ''
                );
              }
              return '';
            };

            window.dispatchEvent(
              new CustomEvent('tipSuccess', {
                detail: {
                  recipient,
                  amount,
                  txHash: extractTxHash(tx),
                  rawText,
                },
              })
            );
          },
        });
      } catch (e) {
        // Surface this so we can diagnose quickly
        console.error('Tip PayButton render failed:', e);
      }
    };

    ensurePayButtonScript();
    tryRender();

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [to, amount, recipient]);

  return <div ref={containerRef} className="min-w-[200px]" />;
};

export const ChatRoom = () => {
  const { user, profile, sessionToken } = useAuth();
  const { encrypt, decrypt } = useChatEncryption();
  const [isOpen, setIsOpen] = useState(() => {
    // Auto-open if URL has ?chat=open
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('chat') === 'open';
    }
    return false;
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [loadingMentions, setLoadingMentions] = useState(false);
  
  // Tip state
  const [pendingTip, setPendingTip] = useState<TipData | null>(null);
  
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

  // Redact ecash address for display (e.g., "qz6j...0pp")
  const redactAddress = (address: string): string => {
    if (!address) return 'Anonymous';
    // Remove "ecash:" prefix if present for display
    const cleanAddress = address.replace(/^ecash:/i, '');
    if (cleanAddress.length <= 10) return cleanAddress;
    return `${cleanAddress.slice(0, 6)}...${cleanAddress.slice(-4)}`;
  };

  // Check if display_name is a real username (not a redacted address pattern)
  const isRealUsername = (displayName: string | null | undefined): boolean => {
    if (!displayName) return false;
    // Redacted addresses look like "qz6jsg..." with exactly 6 chars + "..." + 4 chars
    const redactedPattern = /^[a-z0-9]{6}\.\.\.[a-z0-9]{4}$/i;
    // Also check for the old pattern from the trigger that created "qzq2vds3..."
    const oldTriggerPattern = /^[a-z0-9]{8}\.\.\.$/i;
    return !redactedPattern.test(displayName) && !oldTriggerPattern.test(displayName);
  };

  // Search for users to mention
  const searchMentionUsers = useCallback(async (query: string) => {
    if (query.length < 1) {
      setMentionUsers([]);
      return;
    }
    
    setLoadingMentions(true);
    try {
      // Search profiles with display names matching the query
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .ilike('display_name', `%${query}%`)
        .limit(5);

      if (profiles && profiles.length > 0) {
        // Get ecash addresses for these users
        const userIds = profiles.map(p => p.user_id);
        const { data: users } = await supabase
          .from('users')
          .select('id, ecash_address')
          .in('id', userIds);

        const mentionList: MentionUser[] = profiles
          .filter(p => isRealUsername(p.display_name))
          .map(p => {
            const userRecord = users?.find(u => u.id === p.user_id);
            return {
              id: p.user_id,
              display_name: p.display_name || '',
              ecash_address: userRecord?.ecash_address || ''
            };
          })
          .filter(m => m.display_name && m.ecash_address);

        setMentionUsers(mentionList);
      } else {
        setMentionUsers([]);
      }
    } catch (error) {
      console.error('Error searching mentions:', error);
      setMentionUsers([]);
    } finally {
      setLoadingMentions(false);
    }
  }, []);

  // Handle input change with mention detection
  const handleInputChange = (value: string) => {
    setNewMessage(value.slice(0, MAX_MESSAGE_LENGTH));
    
    // Detect @mention in progress
    const cursorPos = inputRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setMentionIndex(0);
      searchMentionUsers(mentionMatch[1]);
    } else {
      setMentionQuery(null);
      setMentionUsers([]);
    }
  };

  // Insert mention into message
  const insertMention = (user: MentionUser) => {
    const cursorPos = inputRef.current?.selectionStart || newMessage.length;
    const textBeforeCursor = newMessage.slice(0, cursorPos);
    const textAfterCursor = newMessage.slice(cursorPos);
    
    // Replace @query with @username
    const newTextBefore = textBeforeCursor.replace(/@\w*$/, `@${user.display_name} `);
    const newValue = newTextBefore + textAfterCursor;
    
    setNewMessage(newValue);
    setMentionQuery(null);
    setMentionUsers([]);
    
    // Focus back on input
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Resolve tip recipient address
  const resolveTipRecipient = useCallback(async (username: string): Promise<string | null> => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .ilike('display_name', username)
      .limit(1);

    if (profiles && profiles.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('ecash_address')
        .eq('id', profiles[0].user_id)
        .single();
      
      return users?.ecash_address || null;
    }
    return null;
  }, []);

  // Render message content with styled mentions and links
  // isOwn determines if we need contrasting colors for own messages (primary background)
  const renderMessageContent = (content: string, isOwn: boolean = false) => {
    // Split by @mentions and URLs, highlight them appropriately
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const mentionPattern = /(@\w+)/g;
    
    // First split by URLs
    const urlParts = content.split(urlPattern);
    
    return urlParts.map((urlPart, urlIdx) => {
      // Check if this part is a URL
      if (urlPattern.test(urlPart)) {
        // Reset regex lastIndex
        urlPattern.lastIndex = 0;
        const isExplorerLink = urlPart.includes('explorer.e.cash/tx/');

        const explorerLabel = () => {
          const txid = urlPart.split('/tx/')[1]?.split(/[?#]/)[0] || '';
          if (!txid) return '🔗 View TX';
          const short = `${txid.slice(0, 8)}…${txid.slice(-6)}`;
          return `🔗 TX ${short}`;
        };

        return (
          <a 
            key={`url-${urlIdx}`}
            href={urlPart}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline break-all ${
              isOwn 
                ? 'text-primary-foreground/90 hover:text-primary-foreground' 
                : 'text-primary hover:text-primary/80'
            }`}
          >
            {isExplorerLink ? explorerLabel() : urlPart}
          </a>
        );
      }
      
      // Split non-URL parts by mentions
      const mentionParts = urlPart.split(mentionPattern);
      return mentionParts.map((part, mentionIdx) => {
        if (part.startsWith('@')) {
          return (
            <span 
              key={`mention-${urlIdx}-${mentionIdx}`} 
              className={`font-semibold ${
                isOwn 
                  ? 'text-primary-foreground underline decoration-primary-foreground/50' 
                  : 'text-primary'
              }`}
            >
              {part}
            </span>
          );
        }
        return <span key={`text-${urlIdx}-${mentionIdx}`}>{part}</span>;
      });
    });
  };

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

      // Get user addresses for fallback display names
      const { data: users } = await supabase
        .from('users')
        .select('id, ecash_address')
        .in('id', userIds);

      // Get reactions for all messages
      const messageIds = data.map(m => m.id);
      const { data: reactions } = await supabase
        .from('chat_reactions')
        .select('id, message_id, user_id, emoji')
        .in('message_id', messageIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      const userMap = new Map(users?.map(u => [u.id, u.ecash_address]) || []);
      const reactionsByMessage = new Map<string, ChatReaction[]>();
      reactions?.forEach(r => {
        if (!reactionsByMessage.has(r.message_id)) {
          reactionsByMessage.set(r.message_id, []);
        }
        reactionsByMessage.get(r.message_id)!.push(r);
      });
      
      const messagesWithProfiles = data.map(msg => {
        const profile = profileMap.get(msg.user_id);
        const ecashAddress = userMap.get(msg.user_id) || '';
        // Use display_name only if it's a real username, not a redacted address
        const displayName = isRealUsername(profile?.display_name) 
          ? profile!.display_name 
          : redactAddress(ecashAddress);
        
        return {
          ...msg,
          display_name: displayName,
          avatar_url: profile?.avatar_url,
          reactions: reactionsByMessage.get(msg.id) || []
        };
      });

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
          
          // Fetch both profile and user address for display name fallback
          const [profileRes, userRes] = await Promise.all([
            supabase
              .from('profiles')
              .select('display_name, avatar_url')
              .eq('user_id', newMsg.user_id)
              .single(),
            supabase
              .from('users')
              .select('ecash_address')
              .eq('id', newMsg.user_id)
              .single()
          ]);

          const displayName = isRealUsername(profileRes.data?.display_name) 
            ? profileRes.data!.display_name 
            : redactAddress(userRes.data?.ecash_address || '');
          const decryptedContent = await decrypt(newMsg.encrypted_content, newMsg.iv);
          
          setMessages(prev => [...prev, {
            ...newMsg,
            decrypted_content: decryptedContent,
            display_name: displayName,
            avatar_url: profileRes.data?.avatar_url,
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

  // Auto-scroll to bottom when messages load or change
  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      // Use requestAnimationFrame + setTimeout to ensure DOM has fully updated
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 100);
      });
    }
  }, [messages]);

  // Scroll to bottom when chat opens
  useEffect(() => {
    if (isOpen && scrollRef.current && messages.length > 0) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 150);
      });
    }
  }, [isOpen]);

  // Handle tip success event - post TX link as follow-up message
  useEffect(() => {
    const handleTipSuccess = async (e: CustomEvent<{ recipient: string; amount: number; txHash?: string; rawText?: string }>) => {
      const { recipient, amount, txHash } = e.detail;
      toast.success(`Sent ${amount.toLocaleString()} XEC to @${recipient}! 💸`);
      setPendingTip(null);
      setNewMessage('');
      
      // Only post a TX link message if we have a transaction hash
      if (sessionToken && encrypt && txHash) {
        try {
          const txLink = `https://explorer.e.cash/tx/${txHash}`;
          const confirmMessage = `💸 Tip sent to @${recipient}: ${amount.toLocaleString()} XEC | ${txLink}`;
          const { encrypted, iv } = await encrypt(confirmMessage);
          await supabase.functions.invoke('send-chat-message', {
            body: {
              session_token: sessionToken,
              encrypted_content: encrypted,
              iv
            }
          });
        } catch (error) {
          console.error('Failed to send tip confirmation:', error);
        }
      }
    };

    window.addEventListener('tipSuccess', handleTipSuccess as EventListener);
    return () => window.removeEventListener('tipSuccess', handleTipSuccess as EventListener);
  }, [sessionToken, encrypt]);

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

    // Check for /tip command
    const tipCommand = parseTipCommand(trimmedMessage);
    if (tipCommand) {
      const recipientAddress = await resolveTipRecipient(tipCommand.recipient);
      if (!recipientAddress) {
        toast.error(`User @${tipCommand.recipient} not found`);
        return;
      }

      // Post the user's /tip message into chat (so it appears in history)
      setSending(true);
      try {
        const { encrypted, iv } = await encrypt(tipCommand.rawText);
        const { data, error } = await supabase.functions.invoke('send-chat-message', {
          body: {
            session_token: sessionToken,
            encrypted_content: encrypted,
            iv,
          },
        });

        if (error || data?.error) {
          toast.error(data?.error || 'Failed to send tip message');
          return;
        }

        setNewMessage('');
        setMentionQuery(null);
        setMentionUsers([]);
      } catch (error) {
        console.error('Send tip message error:', error);
        toast.error('Failed to send tip message');
        return;
      } finally {
        setSending(false);
      }

      setPendingTip({
        ...tipCommand,
        recipientAddress
      });
      return; // Don't send as regular message
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
      setMentionQuery(null);
      setMentionUsers([]);
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
    // Handle mention autocomplete navigation
    if (mentionQuery !== null && mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => Math.min(prev + 1, mentionUsers.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        insertMention(mentionUsers[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        setMentionUsers([]);
        return;
      }
    }

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

  const isGuest = !user;

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
        <div className={`fixed z-50 bg-card border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen 
            ? 'inset-4 w-auto h-auto' 
            : 'bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-6rem)]'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              <span className="font-semibold">eCash Pulse Chat</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="w-3 h-3" />
                <span className="hidden sm:inline">E2E Encrypted</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={async () => {
                  const chatUrl = `${window.location.origin}/?chat=open`;
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: 'eCash Pulse Chat',
                        text: 'Join the conversation on eCash Pulse!',
                        url: chatUrl,
                      });
                    } catch (err) {
                      // User cancelled or share failed silently
                    }
                  } else {
                    await navigator.clipboard.writeText(chatUrl);
                    toast.success('Chat link copied to clipboard!');
                  }
                }}
                title="Share chat"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
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
          <ScrollArea className="flex-1 p-4" viewportRef={scrollRef}>
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
                  const isOwn = user ? msg.user_id === user.id : false;
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
                            {renderMessageContent(msg.decrypted_content || '', isOwn)}
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
                                onClick={() => !isGuest && handleReaction(msg.id, emoji)}
                                disabled={isGuest}
                                className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                                  userReacted 
                                    ? 'bg-primary/20 border-primary/50' 
                                    : 'bg-muted border-border hover:bg-muted/80'
                                } ${isGuest ? 'cursor-default' : ''}`}
                              >
                                {emoji} {count}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Add Reaction Button - only for logged in users */}
                        {!isGuest && (
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
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-border bg-muted/30 relative">
            {/* Mention Autocomplete Dropdown - only for logged in users */}
            {!isGuest && mentionQuery !== null && mentionUsers.length > 0 && (
              <div className="absolute bottom-full left-4 right-4 mb-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-10">
                {mentionUsers.map((mentionUser, index) => (
                  <button
                    key={mentionUser.id}
                    onClick={() => insertMention(mentionUser)}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                      index === mentionIndex 
                        ? 'bg-primary text-primary-foreground' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <AtSign className="w-3.5 h-3.5" />
                    <span className="font-medium">{mentionUser.display_name}</span>
                    <span className="text-xs opacity-60">{redactAddress(mentionUser.ecash_address)}</span>
                  </button>
                ))}
              </div>
            )}
            
            {!isGuest && loadingMentions && mentionQuery !== null && (
              <div className="absolute bottom-full left-4 right-4 mb-1 bg-popover border border-border rounded-lg shadow-lg p-3 z-10">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Searching users...
                </div>
              </div>
            )}

            {/* Pending Tip Modal - only for logged in users */}
            {!isGuest && pendingTip && (
              <div className="absolute bottom-full left-4 right-4 mb-2 bg-card border border-border rounded-lg shadow-xl p-4 z-20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-primary" />
                    <span className="font-semibold">Tip @{pendingTip.recipient}</span>
                  </div>
                  <button 
                    onClick={() => setPendingTip(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Send {pendingTip.amount.toLocaleString()} XEC to @{pendingTip.recipient}
                </p>
                <div className="flex justify-center">
                  <TipPayButton 
                    to={pendingTip.recipientAddress}
                    amount={pendingTip.amount}
                    recipient={pendingTip.recipient}
                    rawText={pendingTip.rawText}
                  />
                </div>
              </div>
            )}

            {isGuest ? (
              <div className="flex items-center justify-center gap-2 py-2 px-3 bg-muted/50 rounded-lg border border-border">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Connect wallet to chat</span>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    setIsOpen(false);
                    // Trigger auth modal - assuming there's a login button in the header
                    document.querySelector<HTMLButtonElement>('[data-auth-trigger]')?.click();
                  }}
                >
                  Connect
                </Button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={newMessage}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type a message... @mention or /tip @user amount"
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
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
