const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting map (simple in-memory)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 10; // requests per window
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(ip) || [];
  const recentRequests = requests.filter(t => now - t < RATE_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT) {
    return false;
  }
  
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  return true;
}

// Message validation
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function validateMessages(messages: unknown): { valid: boolean; error?: string; data?: Message[] } {
  if (!Array.isArray(messages)) {
    return { valid: false, error: 'Messages must be an array' };
  }
  
  if (messages.length === 0) {
    return { valid: false, error: 'Messages array cannot be empty' };
  }
  
  if (messages.length > 20) {
    return { valid: false, error: 'Too many messages (max 20)' };
  }
  
  const validatedMessages: Message[] = [];
  
  for (const msg of messages) {
    if (typeof msg !== 'object' || msg === null) {
      return { valid: false, error: 'Each message must be an object' };
    }
    
    const { role, content } = msg as { role?: unknown; content?: unknown };
    
    if (role !== 'user' && role !== 'assistant') {
      return { valid: false, error: 'Message role must be "user" or "assistant"' };
    }
    
    if (typeof content !== 'string') {
      return { valid: false, error: 'Message content must be a string' };
    }
    
    if (content.length > 4000) {
      return { valid: false, error: 'Message content too long (max 4000 characters)' };
    }
    
    // Sanitize content - remove potential prompt injection patterns
    const sanitizedContent = content
      .replace(/\[\s*system\s*\]/gi, '[filtered]')
      .replace(/\[\s*ignore\s*previous\s*instructions?\s*\]/gi, '[filtered]')
      .trim();
    
    validatedMessages.push({ role, content: sanitizedContent });
  }
  
  return { valid: true, data: validatedMessages };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Get client IP for rate limiting
  const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                   req.headers.get('cf-connecting-ip') || 
                   'unknown';

  // Check rate limit
  if (!checkRateLimit(clientIP)) {
    console.log(`Rate limit exceeded for IP: ${clientIP}`);
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait a moment.' }),
      { 
        status: 429, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof body !== 'object' || body === null) {
      return new Response(
        JSON.stringify({ error: 'Request body must be an object' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages } = body as { messages?: unknown };
    
    // Validate messages
    const validation = validateMessages(messages);
    if (!validation.valid || !validation.data) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing AI dispute request from IP: ${clientIP}, messages: ${validation.data.length}`);

    // System prompt for the AI dispute resolver
    const systemPrompt = `You are an impartial AI judge for eCash Pulse prediction markets. Your role is to help resolve disputes about prediction market outcomes.

Guidelines:
- Be objective and fair in your analysis
- Consider all evidence presented
- Reference official sources when possible
- Explain your reasoning clearly
- If the outcome is unclear, suggest waiting for more information

You can only discuss matters related to prediction market outcomes and disputes. Do not engage with off-topic requests.`;

    // Use Lovable AI API
    const response = await fetch('https://ai-gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...validation.data
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI service is busy. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content || 'Unable to process your request.';

    return new Response(
      JSON.stringify({ response: aiMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-dispute function:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
