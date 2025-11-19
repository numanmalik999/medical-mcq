// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import OpenAI from 'https://esm.sh/openai@4.52.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to send a reply via the WhatsApp Business API
async function sendWhatsAppMessage(recipientId: string, messageText: string) {
  // @ts-ignore
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  // @ts-ignore
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp environment variables (PHONE_NUMBER_ID or ACCESS_TOKEN) are not set.');
  }

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: recipientId,
    type: 'text',
    text: { body: messageText },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to send WhatsApp message: ${JSON.stringify(errorData)}`);
  }

  console.log('Successfully sent WhatsApp reply.');
  return await response.json();
}

// Helper function to generate a response using OpenAI with context from Supabase
async function generateAiResponse(userMessage: string) {
  // @ts-ignore
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY is not set.');
  }
  const openai = new OpenAI({ apiKey: openaiApiKey });

  // @ts-ignore
  const supabaseAdmin = createClient(
    // @ts-ignore
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Fetch context from the database
  const [pagesResult, tiersResult] = await Promise.all([
    supabaseAdmin.from('static_pages').select('title, content'),
    supabaseAdmin.from('subscription_tiers').select('name, price, currency, duration_in_months, description, features')
  ]);

  let context = "CONTEXT FROM WEBSITE:\n";
  if (pagesResult.data) {
    context += pagesResult.data.map((p: any) => `Page: ${p.title}\nContent: ${p.content}\n---\n`).join('');
  }
  if (tiersResult.data) {
    context += "\nPRICING INFORMATION:\n" + tiersResult.data.map((t: any) => `- Plan: ${t.name}, Price: ${t.price} ${t.currency} for ${t.duration_in_months} month(s).`).join('\n');
  }

  const systemPrompt = {
    role: 'system',
    content: `You are 'Prometric AI', an expert assistant for 'Study Prometric', a platform for medical exam prep. Use the provided context to answer questions about the platform. For general medical questions, use your knowledge. Be helpful, concise, and professional.\n\n${context}`
  };

  const stream = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [systemPrompt, { role: 'user', content: userMessage }],
    stream: true,
  });

  let fullResponse = "";
  for await (const chunk of stream) {
    fullResponse += chunk.choices[0]?.delta?.content || "";
  }

  return fullResponse;
}

serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle Meta Webhook Verification
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      
      // @ts-ignore
      const verifyToken = Deno.env.get('META_VERIFY_TOKEN');

      if (mode === 'subscribe' && token === verifyToken) {
        console.log('Webhook verified successfully!');
        return new Response(challenge, { status: 200 });
      } else {
        console.error('Webhook verification failed. Tokens do not match.');
        return new Response('Forbidden', { status: 403 });
      }
    } catch (error) {
      console.error('Error during webhook verification:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  // Handle Incoming Messages
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('Received webhook payload:', JSON.stringify(body, null, 2));

      // Extract message details from the payload
      const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (message && message.type === 'text') {
        const from = message.from;
        const msg_body = message.text.body;

        // Acknowledge receipt immediately (optional, but good practice)
        // For simplicity, we will process and then respond. Meta allows a few seconds.

        // Generate AI response
        const aiReply = await generateAiResponse(msg_body);

        // Send the reply back to the user
        await sendWhatsAppMessage(from, aiReply);

        return new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        // Not a text message, so we can ignore it
        return new Response(JSON.stringify({ status: 'ignored, not a text message' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
      return new Response(JSON.stringify({ error: (error as Error).message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
});