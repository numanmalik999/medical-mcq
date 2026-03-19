// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Server configuration error (Keys missing)." }), { status: 500, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { subscription_id } = await req.json();

    if (!subscription_id) {
      return new Response(JSON.stringify({ error: "Missing subscription_id in request." }), { status: 400, headers: corsHeaders });
    }

    console.log(`[REVOKE] Processing ID: ${subscription_id}`);

    // 1. Get the user_id for this subscription
    const { data: sub, error: fetchError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id')
      .eq('id', subscription_id)
      .single();

    if (fetchError || !sub) {
      console.error("[REVOKE] Subscription lookup failed:", fetchError);
      return new Response(JSON.stringify({ error: "Subscription not found.", details: fetchError }), { status: 404, headers: corsHeaders });
    }

    // 2. Update the subscription status
    // Using 'expired' to strictly comply with the database check constraints
    const { error: updateSubError } = await supabaseAdmin
      .from('user_subscriptions')
      .update({ 
        status: 'expired', 
        end_date: new Date().toISOString() 
      })
      .eq('id', subscription_id);

    if (updateSubError) {
      console.error("[REVOKE] Failed to update user_subscriptions:", updateSubError);
      return new Response(JSON.stringify({ error: "Database update failed for subscription table.", details: updateSubError }), { status: 500, headers: corsHeaders });
    }

    // 3. Update the profile
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({ has_active_subscription: false })
      .eq('id', sub.user_id);

    if (updateProfileError) {
      console.error("[REVOKE] Failed to update profile:", updateProfileError);
      return new Response(JSON.stringify({ error: "Database update failed for profile table.", details: updateProfileError }), { status: 500, headers: corsHeaders });
    }

    console.log(`[REVOKE] Successfully revoked access for user ${sub.user_id}`);

    return new Response(JSON.stringify({ message: "Revoked successfully." }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[REVOKE] Critical error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});