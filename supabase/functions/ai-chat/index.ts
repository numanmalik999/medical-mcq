// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { OpenAI } from 'https://esm.sh/openai@4.52.0?target=deno';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // @ts-ignore
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables.');
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // @ts-ignore
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { messages } = await req.json();
    console.log(`[ai-chat] Received ${messages.length} messages. Fetching context...`);

    // 1. Retrieve public page content and pricing info from Supabase to use as context
    const [pagesResult, tiersResult] = await Promise.all([
      supabaseAdmin.from('static_pages').select('title, content'),
      supabaseAdmin.from('subscription_tiers').select('name, price, currency, duration_in_months, description, features')
    ]);

    let context = "";

    // Process static pages
    if (pagesResult.error) {
      console.error('Error fetching static pages for context:', pagesResult.error);
      context += "Static page context is unavailable.\n";
    } else if (pagesResult.data && pagesResult.data.length > 0) {
      context += "CONTEXT FROM WEBSITE:\n" + pagesResult.data.map((page: { title: string; content: string | null }) => `
        ---
        Page Title: ${page.title}
        Page Content:
        ${page.content}
        ---
      `).join('\n\n');
    }

    // Process subscription tiers
    if (tiersResult.error) {
        console.error('Error fetching subscription tiers for context:', tiersResult.error);
        context += "\nPricing information is unavailable.\n";
    } else if (tiersResult.data && tiersResult.data.length > 0) {
        const pricingContext = tiersResult.data.map((tier: any) => `
        - Plan: ${tier.name}, Price: ${tier.price} ${tier.currency} for ${tier.duration_in_months} month(s). Features: ${tier.features ? tier.features.join(', ') : 'N/A'}.
        `).join('\n');
        
        context += `\n\nPRICING INFORMATION:\n${pricingContext}`;
    }

    // 2. Create a new system prompt with the retrieved context
    const systemPrompt = {
      role: 'system',
      content: `You are an expert assistant for 'Study Prometric', a platform that helps medical professionals prepare for exams in Gulf countries. Your name is 'Prometric AI'.

Use the provided "CONTEXT FROM WEBSITE" and "PRICING INFORMATION" to answer questions about the platform's features, policies, pricing, and general information. If the answer is in the context, synthesize the information and present it clearly. Do not simply copy-paste.

If the question is a general medical question or not covered in the context, answer it based on your general knowledge. Be helpful, concise, and professional. If you don't know an answer, say so.

${context}
`
    };

    // 3. Call OpenAI with the augmented prompt
    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [systemPrompt, ...messages],
      stream: true,
    });

    // 4. Stream the response back to the client
    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const chunk of stream) {
          const chunkStr = JSON.stringify(chunk);
          controller.enqueue(encoder.encode(`data: ${chunkStr}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('[ai-chat] Error in Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});