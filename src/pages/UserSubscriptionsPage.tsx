"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'; // Import Loader2 for loading state

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration_in_months: number;
  description: string | null;
  features: string[] | null;
}

const UserSubscriptionsPage = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const { toast } = useToast();
  const [subscriptionTiers, setSubscriptionTiers] = useState<SubscriptionTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null); // Stores tierId being processed

  useEffect(() => {
    if (!isSessionLoading && user) {
      fetchSubscriptionTiers();
    } else if (!isSessionLoading && !user) {
      setIsLoading(false); // Not logged in, no tiers to show
    }
  }, [user, isSessionLoading]);

  const fetchSubscriptionTiers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .order('price', { ascending: true });

    if (error) {
      console.error('Error fetching subscription tiers:', error);
      toast({ title: "Error", description: "Failed to load subscription plans.", variant: "destructive" });
      setSubscriptionTiers([]);
    } else {
      setSubscriptionTiers(data || []);
    }
    setIsLoading(false);
  };

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to subscribe.", variant: "destructive" });
      return;
    }

    setIsProcessingPayment(tier.id);
    toast({ title: "Processing Payment", description: `Simulating payment for ${tier.name}...`, variant: "default" });

    // Simulate a payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // 1. Update user's profile to mark as having an active subscription
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ has_active_subscription: true })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 2. Create a new entry in user_subscriptions
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(startDate.getMonth() + tier.duration_in_months);

      const { error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: user.id,
          subscription_tier_id: tier.id,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'active',
        });

      if (subscriptionError) throw subscriptionError;

      toast({ title: "Success!", description: `You have successfully subscribed to ${tier.name}!`, variant: "default" });
      
      // Optionally, force a session refresh to update the user object in context
      // For a real app, you might want to trigger a re-fetch of the user session
      // or update the local user object in SessionContextProvider.
      window.location.reload(); // Simple way to refresh session context for now

    } catch (error: any) {
      console.error("Error during subscription process:", error);
      toast({
        title: "Subscription Failed",
        description: `Failed to process subscription: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessingPayment(null);
    }
  };

  if (isLoading || isSessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading subscription plans...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please log in to view subscription plans.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/login'}>Go to Login</Button>
          </CardContent>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  const hasActiveSubscription = user?.has_active_subscription;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Subscription Plans</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your Current Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {hasActiveSubscription ? (
            <div className="flex items-center gap-2 text-green-600 font-semibold">
              <CheckCircle2 className="h-5 w-5" />
              <span>You have an active subscription!</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600 font-semibold">
              <AlertCircle className="h-5 w-5" />
              <span>No active subscription.</span>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {hasActiveSubscription ? "Enjoy all premium features." : "Subscribe to unlock full access to all content and features."}
          </p>
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold mt-8">Choose Your Plan</h2>
      {subscriptionTiers.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No subscription plans available at the moment. Please check back later.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subscriptionTiers.map((tier) => (
            <Card key={tier.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-4">
                <p className="text-4xl font-bold">
                  {tier.currency} {tier.price.toFixed(2)}
                  <span className="text-lg font-normal text-muted-foreground"> / {tier.duration_in_months} month{tier.duration_in_months > 1 ? 's' : ''}</span>
                </p>
                {tier.features && tier.features.length > 0 && (
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {tier.features.map((feature, index) => (
                      <li key={index}>{feature}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => handleSubscribe(tier)}
                  disabled={hasActiveSubscription || isProcessingPayment === tier.id}
                >
                  {isProcessingPayment === tier.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : hasActiveSubscription ? (
                    "Current Plan"
                  ) : (
                    "Choose Plan"
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <MadeWithDyad />
    </div>
  );
};

export default UserSubscriptionsPage;