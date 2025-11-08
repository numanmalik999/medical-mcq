"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';

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

const PaymentPage = () => {
  const { tierId } = useParams<{ tierId: string }>();
  const { user } = useSession();
  const { toast } = useToast();
  
  const [tier, setTier] = useState<SubscriptionTier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

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
    if (!tier || !user || !tier.stripe_price_id) return;

    setIsRedirecting(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          price_id: tier.stripe_price_id,
          user_id: user.id,
        },
      });

      if (error) throw error;

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Could not retrieve checkout URL.");
      }
    } catch (error: any) {
      console.error("Error redirecting to checkout:", error);
      toast({
        title: "Payment Error",
        description: `Could not redirect to payment page: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      setIsRedirecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 pt-16">
        <p className="text-gray-700 dark:text-gray-300">Loading payment details...</p>
      </div>
    );
  }

  if (!tier || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 pt-16">
        <Card className="w-full max-w-md text-center">
          <CardHeader><CardTitle>Error</CardTitle></CardHeader>
          <CardContent><p>{!tier ? "Plan not found." : "You must be logged in to subscribe."}</p></CardContent>
        </Card>
      </div>
    );
  }

  if (!tier.stripe_price_id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 pt-16">
        <Card className="w-full max-w-md text-center">
          <CardHeader><CardTitle>Configuration Error</CardTitle></CardHeader>
          <CardContent>
            <p>This subscription plan is not correctly configured for payments. Please contact support or an administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Confirm Your Subscription</CardTitle>
          <CardDescription>You are about to purchase the {tier.name} plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-baseline p-4 border rounded-md">
            <span className="text-lg font-medium">{tier.name}</span>
            <span className="text-2xl font-bold">{tier.currency} {tier.price.toFixed(2)}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            You will be redirected to Stripe's secure checkout page to complete your payment.
          </p>
        </CardContent>
        <CardFooter>
          <Button onClick={handleProceedToPayment} className="w-full" disabled={isRedirecting}>
            {isRedirecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : `Proceed to Payment`}
          </Button>
        </CardFooter>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default PaymentPage;