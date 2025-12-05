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

  // Initialize Supabase client with service role key
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { 
      id, 
      first_name, 
      last_name, 
      avatar_url, 
      is_admin, 
      phone_number, 
      whatsapp_number, 
      has_active_subscription, 
      subscriptionEndDate 
    } = await req.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing user ID.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- 1. Update User Profile ---
    const profileUpdates = {
      id: id,
      first_name: first_name || null,
      last_name: last_name || null,
      avatar_url: avatar_url || null,
      is_admin: is_admin,
      phone_number: phone_number || null,
      whatsapp_number: whatsapp_number || null,
      has_active_subscription: has_active_subscription,
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profileUpdates, { onConflict: 'id' });

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw new Error(`Failed to update profile: ${profileError.message}`);
    }

    // --- 2. Handle Subscription Update ---
    const shouldBeActive = has_active_subscription;
    let currentActiveSubId: string | null = null;
    
    // Find existing active subscription
    const { data: subData, error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('id, subscription_tier_id')
      .eq('user_id', id)
      .eq('status', 'active')
      .order('end_date', { ascending: false })
      .limit(1)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('Error fetching active subscription ID:', subError);
      // Continue, but log the error
    } else if (subData) {
      currentActiveSubId = subData.id;
    }

    if (!shouldBeActive) {
      // Case A: Deactivate existing subscription
      if (currentActiveSubId) {
        const { error } = await supabaseAdmin
          .from('user_subscriptions')
          .update({ status: 'inactive', end_date: new Date().toISOString() })
          .eq('id', currentActiveSubId);
        if (error) throw error;
      }
    } else { // shouldBeActive is true
      const newEndDate = subscriptionEndDate ? new Date(subscriptionEndDate).toISOString() : null;

      if (currentActiveSubId) {
        // Case B: Update existing active subscription end date
        if (newEndDate) {
          const { error } = await supabaseAdmin
            .from('user_subscriptions')
            .update({ end_date: newEndDate, status: 'active' })
            .eq('id', currentActiveSubId);
          if (error) throw error;
        }
      } else {
        // Case C: Create a new subscription (if none exists but admin marked as active)
        
        // 2.1 Fetch default tier (needed for creating new subscription records)
        const { data: tierData, error: tierError } = await supabaseAdmin
          .from('subscription_tiers')
          .select('id, duration_in_months')
          .eq('name', '1 Month') // <-- UPDATED TIER NAME
          .single();

        if (tierError || !tierData) {
          console.error('Default subscription tier not found:', tierError);
          throw new Error("Default subscription tier '1 Month' not configured."); // <-- UPDATED ERROR MESSAGE
        }
        
        // Calculate end date if not provided by admin
        let calculatedEndDate = newEndDate;
        if (!calculatedEndDate) {
          const startDate = new Date();
          const endDate = new Date(startDate);
          endDate.setMonth(startDate.getMonth() + tierData.duration_in_months);
          calculatedEndDate = endDate.toISOString();
        }

        const { error } = await supabaseAdmin
          .from('user_subscriptions')
          .insert({
            user_id: id,
            subscription_tier_id: tierData.id,
            start_date: new Date().toISOString(),
            end_date: calculatedEndDate,
            status: 'active',
          });
        if (error) throw error;
      }
    }

    return new Response(JSON.stringify({ message: 'User profile and subscription updated successfully.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-update-user-profile Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});