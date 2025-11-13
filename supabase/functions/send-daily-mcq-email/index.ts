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

async function processAndSendEmails() {
    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Get today's QOD
        console.log('Background: Fetching Question of the Day...');
        const qodResponse = await invokeEdgeFunction('get-daily-mcq', {});
        const mcq = qodResponse.mcq;
        if (!mcq) {
            throw new Error('Background: Could not retrieve today\'s MCQ.');
        }

        // 2. Fetch subscribers
        console.log('Background: Fetching marketing subscribers...');
        const { data: subscribers, error: subError } = await supabaseAdmin
            .from('marketing_subscriptions')
            .select('email');
        if (subError) {
            throw new Error(`Background: Failed to fetch subscribers: ${subError.message}`);
        }
        const emails = subscribers.map((s: { email: string }) => s.email);
        if (emails.length === 0) {
            console.log('Background: No subscribers found. Exiting.');
            return;
        }

        // 3. Get base URL
        const appBaseUrl = Deno.env.get('APP_BASE_URL');
        if (!appBaseUrl) {
            throw new Error('Background: APP_BASE_URL environment variable is not set.');
        }

        // 4. Prepare email content
        const emailSubject = `🧠 Question of the Day: ${mcq.question_text.substring(0, 50)}...`;
        const emailBody = `
          <p>Hello,</p>
          <p>Here is today's Question of the Day from Study Prometric MCQs:</p>
          <div style="border: 1px solid #ccc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">${mcq.question_text}</h3>
            <ul style="list-style: none; padding: 0;">
              <li>A: ${mcq.option_a}</li>
              <li>B: ${mcq.option_b}</li>
              <li>C: ${mcq.option_c}</li>
              <li>D: ${mcq.option_d}</li>
            </ul>
          </div>
          <p>Visit our app to submit your answer and see the explanation!</p>
          <p><a href="${appBaseUrl}/quiz-of-the-day" style="display: inline-block; padding: 10px 20px; background-color: #1e3a8a; color: white; text-decoration: none; border-radius: 5px;">Answer the Question</a></p>
          <p>Good luck!</p>
          <p><small>You are receiving this email because you subscribed to our daily updates.</small></p>
        `;

        // 5. Send emails in batches
        const batchSize = 50;
        for (let i = 0; i < emails.length; i += batchSize) {
            const batch = emails.slice(i, i + batchSize);
            await invokeEdgeFunction('send-email', {
                to: batch,
                subject: emailSubject,
                body: emailBody,
            });
            console.log(`Background: Successfully sent batch of ${batch.length} emails.`);
        }
        console.log('Background: Email sending process completed successfully.');
    } catch (error) {
        console.error('Background: Error in processAndSendEmails:', error);
    }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Do not await this. This lets the function run in the background.
  processAndSendEmails();

  // Immediately return a 202 Accepted response
  return new Response(JSON.stringify({ message: "Email sending process initiated." }), {
    status: 202, // Accepted
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});