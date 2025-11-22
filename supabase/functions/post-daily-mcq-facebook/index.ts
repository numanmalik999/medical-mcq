// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

declare global {
  namespace Deno {
    namespace env {
      function get(key: string): string | undefined;
    }
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to invoke another Edge Function (get-daily-mcq)
async function invokeEdgeFunction(functionName: string, body: any) {
    const url = `https://uvhlyitcrogvssmcqtni.supabase.co/functions/v1/${functionName}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify(body),
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to invoke ${functionName}: ${response.status} - ${errorText}`);
    }
    return response.json();
}

// Helper function to post to Facebook
async function postToFacebook(pageId: string, accessToken: string, message: string, link: string) {
    const url = `https://graph.facebook.com/v18.0/${pageId}/feed`;
    const payload = new URLSearchParams({
        message: message,
        link: link,
        access_token: accessToken,
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Facebook API Error: ${JSON.stringify(errorData)}`);
    }

    return response.json();
}


serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Check for required secrets
    const pageId = Deno.env.get('FACEBOOK_PAGE_ID');
    const accessToken = Deno.env.get('FACEBOOK_ACCESS_TOKEN');
    const appBaseUrl = Deno.env.get('APP_BASE_URL');

    if (!pageId || !accessToken || !appBaseUrl) {
        console.error('Facebook or APP_BASE_URL secrets are missing.');
        return new Response(JSON.stringify({ error: 'Configuration error: Missing Facebook or APP_BASE_URL secrets.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Get today's MCQ data
    const qodResponse = await invokeEdgeFunction('get-daily-mcq', {});
    const mcq = qodResponse.mcq;
    
    if (!mcq) {
        throw new Error('Could not retrieve today\'s MCQ from get-daily-mcq.');
    }

    // 3. Format the post message
    const postMessage = `🧠 Question of the Day! 🧠\n\n${mcq.question_text}\n\nA: ${mcq.option_a}\nB: ${mcq.option_b}\nC: ${mcq.option_c}\nD: ${mcq.option_d}\n\nClick the link below to submit your answer and see the explanation! 👇`;
    const postLink = `${appBaseUrl}/quiz-of-the-day`;

    // 4. Post to Facebook
    const facebookResponse = await postToFacebook(pageId, accessToken, postMessage, postLink);

    console.log('Facebook Post Successful:', facebookResponse);

    return new Response(JSON.stringify({ message: 'Daily MCQ posted to Facebook successfully.', facebookResponse }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in post-daily-mcq-facebook Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});