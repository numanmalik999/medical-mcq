// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { OpenAI } from 'https://esm.sh/openai@4.52.0';
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

    const { messages } = await req.json();
    console.log(`[ai-chat] Received ${messages.length} messages. Starting OpenAI stream.`);

    const systemPrompt = {
      role: 'system',
      content: "You are an expert assistant for 'Study Prometric', a platform that helps medical professionals prepare for exams in Gulf countries (like Saudi Arabia, UAE, Qatar, etc.). Your name is 'Prometric AI'. Your goal is to answer user questions about medical topics, exam preparation, and the features of the Study Prometric platform. Be helpful, concise, and professional. If you don't know an answer, say so. Do not make up information."
    };

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [systemPrompt, ...messages],
      stream: true,
    });

    // The ReadableStream from the OpenAI SDK is directly compatible with Deno's Response
    return new Response(response.toReadableStream(), {
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