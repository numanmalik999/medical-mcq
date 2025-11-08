"use client";

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { loadStripe } from '@stripe/stripe-js';

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration_in_months: number;
  description: string | null;
  features: string[] | null;
  stripe_price_id: string | null;
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

const PaymentPage = () => {
  const { tierId } = useParams<{ tierId: string }>();
  const [searchParams] = useSearchParams();
  const stripePriceId = searchParams.get('priceId');
  
  const { user } = useSession();
  const { toast } = useToast();
  
  const [tier, setTier] = useState<SubscriptionTier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchTierDetails = async () => {
      if (!tierId) {
        toast({ title: "Error", description: "No subscription tier specified.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('id', tierId)
        .single();

      if (error || !data) {
        console.error("Error fetching tier details:", error);
        toast({ title: "Error", description: "Could not load subscription plan details.", variant: "destructive" });
      } else {
        setTier(data);
      }
      setIsLoading(false);
    };

    fetchTierDetails();
  }, [tierId, toast]);

  const handleProceedToPayment = async () => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to subscribe.", variant: "destructive" });
      return;
    }
    if (!stripePriceId) {
      toast({ title: "Error", description: "Stripe Price ID is missing.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const { data: edgeFunctionData, error: invokeError } = await supabase.functions.invoke('create-stripe-checkout-session', {
        body: {
          price_id: stripePriceId,
          user_id: user.id,
        },
      });

      if (invokeError) throw invokeError;

      const sessionId = edgeFunctionData.sessionId;
      const stripe = await stripePromise;
      if (!stripe) throw new Error("Failed to load Stripe library.");

      const { error: redirectError } = await (stripe as any).redirectToCheckout({ sessionId });
      if (redirectError) throw redirectError;

    } catch (error: any) {
      console.error("Error initiating Stripe checkout:", error);
      toast({
        title: "Payment Error",
        description: `Failed to initiate checkout: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 pt-16">
        <p className="text-gray-700 dark:text-gray-300">Loading your plan details...</p>
      </div>
    );
  }

  if (!tier) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 pt-16">
        <Card className="w-full max-w-md text-center">
          <CardHeader><CardTitle>Plan Not Found</CardTitle></CardHeader>
          <CardContent><p>The selected subscription plan could not be found.</p></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Confirm Your Subscription</CardTitle>
          <CardDescription>You are about to subscribe to the following plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-md bg-muted/50">
            <h3 className="text-xl font-bold">{tier.name}</h3>
            <p className="text-3xl font-bold mt-2">
              {tier.currency} {tier.price.toFixed(2)}
              <span className="text-base font-normal text-muted-foreground"> / {tier.duration_in_months} month{tier.duration_in_months > 1 ? 's' : ''}</span>
            </p>
            {tier.features && tier.features.length > 0 && (
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mt-4">
                {tier.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleProceedToPayment} className="w-full" disabled={isProcessing}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Confirm & Proceed to Payment"}
          </Button>
        </CardFooter>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default PaymentPage;