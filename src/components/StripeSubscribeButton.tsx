"use client";

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSession } from './SessionContextProvider';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';

interface StripeSubscribeButtonProps {
  tierId: string;
  stripePriceId: string;
  onSubscriptionSuccess: () => void;
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

const StripeSubscribeButton = ({ tierId: _tierId, stripePriceId, onSubscriptionSuccess: _onSubscriptionSuccess }: StripeSubscribeButtonProps) => {
  const { user } = useSession();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to subscribe.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    
    try {
      // 1. Create Checkout Session via Edge Function
      const { data: edgeFunctionData, error: invokeError } = await supabase.functions.invoke('create-stripe-checkout-session', {
        body: {
          price_id: stripePriceId,
          user_id: user.id,
        },
      });

      if (invokeError) {
        throw invokeError;
      }

      const sessionId = edgeFunctionData.sessionId;

      // 2. Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error("Failed to load Stripe library.");
      }

      const { error: redirectError } = await (stripe as any).redirectToCheckout({
        sessionId: sessionId,
      });

      if (redirectError) {
        throw redirectError;
      }

    } catch (error: any) {
      console.error("Error initiating Stripe checkout:", error);
      toast({
        title: "Subscription Error",
        description: `Failed to initiate Stripe checkout: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleSubscribe} className="w-full" disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        "Subscribe with Stripe"
      )}
    </Button>
  );
};

export default StripeSubscribeButton;