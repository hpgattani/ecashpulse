import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Scale, Send, Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface DisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const DisputeModal = ({ isOpen, onClose }: DisputeModalProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-dispute', {
        body: { 
          messages: [...messages, { role: 'user', content: userMessage }]
        }
      });

      if (error) throw error;

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to get AI response. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetAndClose = () => {
    setMessages([]);
    setInput('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={resetAndClose}
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
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Scale className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-xl text-foreground">
                      AI Dispute Resolution
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Fact-check predictions & resolve disputes
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={resetAndClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Chat Area */}
              <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[400px] space-y-4 mb-4 p-2">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Ask me to fact-check a prediction or help resolve a dispute.</p>
                    <p className="text-xs mt-2 opacity-70">
                      Example: "Did Bitcoin hit $100k in 2024?" or "Who won the 2024 Super Bowl?"
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-3 rounded-lg">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about a prediction or dispute..."
                  className="flex-1 bg-muted border-border resize-none min-h-[50px] max-h-[100px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <Button
                  type="submit"
                  variant="glow"
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  className="h-auto aspect-square"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DisputeModal;