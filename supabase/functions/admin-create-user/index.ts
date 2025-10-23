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

  // Initialize Supabase client with service role key
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { email, password, first_name, last_name, is_admin } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Missing required fields: email or password.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Create user in auth.users
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Automatically confirm email
      user_metadata: {
        first_name: first_name || null,
        last_name: last_name || null,
      },
    });

    if (authError) {
      console.error('Error creating user:', authError);
      throw new Error(`Failed to create user: ${authError.message}`);
    }

    const newUserId = userData.user.id;

    // 2. Manually insert profile data (since the handle_new_user trigger might not set is_admin)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUserId,
        first_name: first_name || null,
        last_name: last_name || null,
        is_admin: is_admin || false,
        // Other fields will be handled by the existing trigger if they are not provided here
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Error upserting profile after user creation:', profileError);
      // Note: We don't throw here, as the user is created, but we log the profile error.
    }

    return new Response(JSON.stringify({ message: 'User created successfully.', userId: newUserId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-create-user Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});