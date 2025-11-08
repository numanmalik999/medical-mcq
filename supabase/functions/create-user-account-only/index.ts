// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email, password, first_name, last_name, phone_number, whatsapp_number } = await req.json();

    if (!email || !password || !first_name || !last_name) {
      return new Response(JSON.stringify({ error: 'Missing required fields: email, password, first_name, or last_name.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- 1. Create User in Supabase Auth ---
    // The 'handle_new_user' trigger will now automatically create the complete profile row.
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        first_name, 
        last_name,
        phone_number: phone_number || null,
        whatsapp_number: whatsapp_number || null
      },
    });

    if (authError) {
      throw new Error(`Failed to create user account: ${authError.message}`);
    }
    
    const newUserId = userData.user.id;

    // The trigger now handles all profile creation, so no separate update/insert is needed here.

    return new Response(JSON.stringify({ userId: newUserId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in create-user-account-only Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});