"use client";

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

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

const CheckoutForm = ({ tier, user }: { tier: SubscriptionTier; user: any }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      toast({ title: "Error", description: "Card element not found.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (error) {
      toast({ title: "Payment Error", description: error.message || "An unknown error occurred.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    const { data: subData, error: subError } = await supabase.functions.invoke('create-stripe-subscription', {
      body: {
        price_id: tier.stripe_price_id,
        user_id: user.id,
        payment_method_id: paymentMethod.id,
      },
    });

    if (subError) {
      const errorMessage = subError.context?.error || subError.message || "Failed to create subscription.";
      toast({ title: "Subscription Error", description: errorMessage, variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    const { clientSecret, status } = subData;

    if (status === 'active') {
      toast({ title: "Success!", description: "Your subscription is now active." });
      navigate('/user/subscriptions');
    } else if (status === 'incomplete' || status === 'requires_action') {
      const { error: confirmError } = await stripe.confirmCardPayment(clientSecret);
      if (confirmError) {
        toast({ title: "Payment Confirmation Failed", description: confirmError.message || "Please try again.", variant: "destructive" });
      } else {
        toast({ title: "Success!", description: "Your subscription is now active." });
        navigate('/user/subscriptions');
      }
    }
    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-md">
        <CardElement options={{
          style: {
            base: {
              fontSize: '16px',
              color: '#424770',
              '::placeholder': {
                color: '#aab7c4',
              },
            },
            invalid: {
              color: '#9e2146',
            },
          },
        }} />
      </div>
      <Button type="submit" className="w-full" disabled={!stripe || isProcessing}>
        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : `Pay ${tier.currency} ${tier.price.toFixed(2)}`}
      </Button>
    </form>
  );
};

const PaymentPage = () => {
  const { tierId } = useParams<{ tierId: string }>();
  const { user } = useSession();
  const { toast } = useToast();
  
  const [tier, setTier] = useState<SubscriptionTier | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Complete Your Subscription</CardTitle>
          <CardDescription>Enter your payment details for the {tier.name} plan.</CardDescription>
        </CardHeader>
        <CardContent>
          <Elements stripe={stripePromise}>
            <CheckoutForm tier={tier} user={user} />
          </Elements>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground text-center w-full">
            Payments are securely processed by Stripe. Your card details are never stored on our servers.
          </p>
        </CardFooter>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default PaymentPage;