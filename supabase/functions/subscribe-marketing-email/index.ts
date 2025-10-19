// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import { Resend } from 'https://esm.sh/resend@1.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // @ts-ignore
  const supabaseAdmin = createClient(
    // @ts-ignore
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if email already exists
    const { data: existingSubscription, error: checkError } = await supabaseAdmin
      .from('marketing_subscriptions')
      .select('id')
      .eq('email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error checking existing subscription:', checkError);
      throw new Error(`Failed to check existing subscription: ${checkError.message}`);
    }

    if (existingSubscription) {
      return new Response(JSON.stringify({ message: 'Email is already subscribed.' }), {
        status: 409, // Conflict
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert new subscription
    const { data, error: insertError } = await supabaseAdmin
      .from('marketing_subscriptions')
      .insert({ email })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting marketing subscription:', insertError);
      throw new Error(`Failed to subscribe email: ${insertError.message}`);
    }

    // Send confirmation email
    // @ts-ignore
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    // @ts-ignore
    const adminEmail = Deno.env.get('ADMIN_EMAIL');

    if (resendApiKey && adminEmail) {
      const resend = new Resend(resendApiKey);
      const { error: emailError } = await resend.emails.send({
        from: `Study Prometric MCQs <${adminEmail}>`,
        to: [email],
        subject: 'Welcome to Study Prometric MCQs Updates!',
        html: `
          <p>Dear Subscriber,</p>
          <p>Thank you for subscribing to Study Prometric MCQs daily updates!</p>
          <p>You'll now receive our latest news, quiz challenges, and study tips directly in your inbox.</p>
          <p>Stay tuned for more exciting content!</p>
          <p>Best regards,<br/>The Study Prometric MCQs Team</p>
          <p><small>If you wish to unsubscribe, please contact us at ${adminEmail}.</small></p>
        `,
      });

      if (emailError) {
        console.error('Error sending marketing confirmation email:', emailError);
        // Don't throw, just log the warning as the subscription itself was successful
      }
    } else {
      console.warn('Resend API Key or Admin Email not set, skipping confirmation email.');
    }

    return new Response(JSON.stringify({ message: 'Subscription successful!', data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in subscribe-marketing-email Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});