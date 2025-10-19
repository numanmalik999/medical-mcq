// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

  try {
    const { to, subject, body } = await req.json();
    console.log('send-email: Received request to send email.');
    console.log('send-email: To:', to, 'Subject:', subject);

    // @ts-ignore
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    // @ts-ignore
    const adminEmail = Deno.env.get('ADMIN_EMAIL');

    console.log('send-email: RESEND_API_KEY status:', resendApiKey ? 'SET' : 'NOT SET');
    console.log('send-email: ADMIN_EMAIL status:', adminEmail ? 'SET' : 'NOT SET');

    if (!resendApiKey || !adminEmail) {
      console.error('send-email: RESEND_API_KEY or ADMIN_EMAIL environment variables are not set.');
      throw new Error('RESEND_API_KEY or ADMIN_EMAIL environment variables are not set.');
    }

    if (!to || !subject || !body) {
      console.error('send-email: Missing required fields: to, subject, or body.');
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, or body.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resend = new Resend(resendApiKey);

    // Determine the actual recipient email
    const recipientEmail = (to === 'ADMIN_EMAIL') ? adminEmail : to;
    console.log('send-email: Sending email from:', `Admin Notifications <${adminEmail}>`, 'to:', recipientEmail);

    const { data, error } = await resend.emails.send({
      from: `Admin Notifications <${adminEmail}>`, // Use adminEmail as the sender
      to: [recipientEmail], // Use the resolved recipient email
      subject: subject,
      html: body,
    });

    if (error) {
      console.error('send-email: Resend email error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log('send-email: Email sent successfully via Resend:', data);
    return new Response(JSON.stringify({ message: 'Email sent successfully', data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('send-email: Error in send-email Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});