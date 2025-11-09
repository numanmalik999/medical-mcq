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

// Helper function to invoke another Edge Function
async function invokeEdgeFunction(functionName: string, body: any) {
    const url = `https://uvhlyitcrogvssmcqtni.supabase.co/functions/v1/${functionName}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`, // Use ANON key for internal function calls
        },
        body: JSON.stringify(body),
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to invoke ${functionName}: ${response.status} - ${errorText}`);
    }
    return response.json();
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // 1. Get today's Question of the Day (QOD) using the existing function
    console.log('Fetching Question of the Day...');
    const qodResponse = await invokeEdgeFunction('get-daily-mcq', {});
    
    const mcq = qodResponse.mcq;
    if (!mcq) {
        throw new Error('Could not retrieve today\'s MCQ.');
    }

    // 2. Fetch all marketing subscriber emails
    console.log('Fetching marketing subscribers...');
    const { data: subscribers, error: subError } = await supabaseAdmin
      .from('marketing_subscriptions')
      .select('email');

    if (subError) {
      throw new Error(`Failed to fetch subscribers: ${subError.message}`);
    }

    const emails = subscribers.map((s: { email: string }) => s.email);
    if (emails.length === 0) {
      console.log('No subscribers found. Exiting.');
      return new Response(JSON.stringify({ message: 'No subscribers found.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Prepare and send the email content
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
      <p><a href="https://uvhlyitcrogvssmcqtni.supabase.co/quiz-of-the-day" style="display: inline-block; padding: 10px 20px; background-color: #1e3a8a; color: white; text-decoration: none; border-radius: 5px;">Answer the Question</a></p>
      
      <p>Good luck!</p>
      <p><small>You are receiving this email because you subscribed to our daily updates.</small></p>
    `;

    // 4. Send emails in batches (Resend supports up to 50 recipients per call)
    const batchSize = 50;
    let successfulSends = 0;
    
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      // Invoke the send-email function for the batch
      const { data: _sendData, error: sendError } = await invokeEdgeFunction('send-email', {
        to: batch, // send-email function needs to be updated to handle array of recipients
        subject: emailSubject,
        body: emailBody,
      });

      if (sendError) {
        console.error(`Error sending batch ${i/batchSize + 1}:`, sendError);
        // Continue to the next batch even if one fails
      } else {
        successfulSends += batch.length;
        console.log(`Successfully sent batch of ${batch.length} emails.`);
      }
    }

    return new Response(JSON.stringify({ 
        message: `Daily MCQ email process finished. Attempted to send to ${emails.length} subscribers.`,
        successfulSends,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-daily-mcq-email Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});