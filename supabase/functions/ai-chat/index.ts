// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import OpenAI from 'https://esm.sh/openai@4.52.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // @ts-ignore
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    // @ts-ignore
    const openaiBaseUrl = Deno.env.get('OPENAI_BASE_URL');
    // @ts-ignore
    const openaiModel = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not set.');
    }

    const normalizedBaseUrl = openaiBaseUrl?.trim().replace(/\/$/, '');
    const baseUrlCandidates = normalizedBaseUrl
      ? (normalizedBaseUrl.endsWith('/v1') ? [normalizedBaseUrl] : [normalizedBaseUrl, `${normalizedBaseUrl}/v1`])
      : [undefined];

    const { messages } = await req.json();

    let stream: any = null;
    let lastError: any = null;

    for (const candidate of baseUrlCandidates) {
      try {
        const openai = new OpenAI({
          apiKey: openaiApiKey,
          ...(candidate ? { baseURL: candidate } : {}),
        });

        stream = await openai.chat.completions.create({
          model: openaiModel,
          messages,
          stream: true,
        });
        break;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!stream) {
      throw lastError || new Error('Failed to initialize AI stream.');
    }

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const chunk of stream) {
          const deltaText = chunk.choices?.[0]?.delta?.content ?? '';
          if (!deltaText) continue;

          const data = { choices: [{ delta: { content: deltaText } }] };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});