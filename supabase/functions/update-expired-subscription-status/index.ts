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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { user_id, is_active } = await req.json();

    if (!user_id || typeof is_active !== 'boolean') {
      return new Response(JSON.stringify({ error: 'Missing user_id or is_active status.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Update the profile status
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ has_active_subscription: is_active })
      .eq('id', user_id);

    if (profileUpdateError) {
      console.error('Error updating user profile subscription status:', profileUpdateError);
      throw new Error(`Failed to update profile status: ${profileUpdateError.message}`);
    }

    // 2. If setting to inactive, also update the latest active subscription record to 'expired'
    if (!is_active) {
        const { error: subUpdateError } = await supabaseAdmin
            .from('user_subscriptions')
            .update({ status: 'expired' })
            .eq('user_id', user_id)
            .eq('status', 'active')
            .order('end_date', { ascending: false })
            .limit(1);

        if (subUpdateError && subUpdateError.code !== 'PGRST116') {
            console.warn('Warning: Failed to update latest active subscription status to expired:', subUpdateError);
        }
    }


    return new Response(JSON.stringify({ message: 'Subscription status updated successfully.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-expired-subscription-status Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});