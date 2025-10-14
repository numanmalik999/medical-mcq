"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'; // Import Loader2 for loading state
import { differenceInDays, parseISO } from 'date-fns'; // Import date-fns for date calculations

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration_in_months: number;
  description: string | null;
  features: string[] | null;
}

interface UserSubscription {
  id: string;
  user_id: string;
  subscription_tier_id: string;
  start_date: string;
  end_date: string;
  status: string;
}

const UserSubscriptionsPage = () => {
  const { user, hasCheckedInitialSession } = useSession(); // Use hasCheckedInitialSession
  const { toast } = useToast();
  const [subscriptionTiers, setSubscriptionTiers] = useState<SubscriptionTier[]>([]);
  const [userActiveSubscription, setUserActiveSubscription] = useState<UserSubscription | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true); // Renamed to avoid conflict
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null); // Stores tierId being processed

  useEffect(() => {
    console.log('UserSubscriptionsPage: useEffect mounted. Current user has_active_subscription from session:', user?.has_active_subscription);
    if (!hasCheckedInitialSession) {
      // Still waiting for initial session check, keep loading state true
      return;
    }

    if (user) {
      fetchSubscriptionData();
    } else {
      setIsLoadingPage(false); // Not logged in, no tiers to show
      console.log('UserSubscriptionsPage: Not logged in, setting isLoadingPage to false.');
    }
  }, [user, hasCheckedInitialSession]);

  const fetchSubscriptionData = async () => {
    setIsLoadingPage(true);
    console.log('UserSubscriptionsPage: fetchSubscriptionData started.');

    // Fetch all subscription tiers
    const { data: tiersData, error: tiersError } = await supabase
      .from('subscription_tiers')
      .select('*')
      .order('price', { ascending: true });

    if (tiersError) {
      console.error('UserSubscriptionsPage: Error fetching subscription tiers:', tiersError);
      toast({ title: "Error", description: "Failed to load subscription plans.", variant: "destructive" });
      setSubscriptionTiers([]);
    } else {
      setSubscriptionTiers(tiersData || []);
      console.log('UserSubscriptionsPage: Fetched subscription tiers:', tiersData);
    }

    // Fetch user's active subscription
    if (user) {
      // Fetch all subscriptions for the user, then filter client-side
      const { data: userSubsData, error: userSubError } = await supabase
        .from('user_subscriptions')
        .select('id, user_id, subscription_tier_id, start_date, end_date, status')
        .eq('user_id', user.id)
        .order('end_date', { ascending: false }); // Order by end_date descending

      console.log('UserSubscriptionsPage: fetchSubscriptionData - RAW userSubsData from user_subscriptions table:', userSubsData); // ADDED LOG
      console.log('UserSubscriptionsPage: fetchSubscriptionData - userSubError from user_subscriptions table:', userSubError);

      if (userSubError) {
        console.error('UserSubscriptionsPage: Error fetching user subscriptions from user_subscriptions table:', userSubError);
        toast({ title: "Error", description: "Failed to load your subscription status.", variant: "destructive" });
        setUserActiveSubscription(null);
        setDaysRemaining(null);
      } else if (userSubsData && userSubsData.length > 0) {
        // Filter for the first active subscription client-side
        const activeSub = userSubsData.find(sub => sub.status === 'active');
        console.log('UserSubscriptionsPage: fetchSubscriptionData - Client-side filtered activeSub:', activeSub); // ADDED LOG
        if (activeSub) {
          setUserActiveSubscription(activeSub);
          const endDate = parseISO(activeSub.end_date);
          const today = new Date();
          const remaining = differenceInDays(endDate, today);
          setDaysRemaining(Math.max(0, remaining)); // Ensure days remaining is not negative
          console.log('UserSubscriptionsPage: Active subscription found client-side, days remaining:', Math.max(0, remaining));
        } else {
          setUserActiveSubscription(null);
          setDaysRemaining(null);
          console.log('UserSubscriptionsPage: No active subscription found client-side.');
        }
      } else {
        setUserActiveSubscription(null);
        setDaysRemaining(null);
        console.log('UserSubscriptionsPage: No subscriptions found for user.');
      }
    }
    setIsLoadingPage(false);
    console.log('UserSubscriptionsPage: fetchSubscriptionData finished, isLoadingPage set to false.');
  };

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to subscribe.", variant: "destructive" });
      return;
    }

    setIsProcessingPayment(tier.id);
    toast({ title: "Processing Payment", description: `Simulating payment for ${tier.name}...`, variant: "default" });
    console.log('UserSubscriptionsPage: handleSubscribe - Starting payment simulation for tier:', tier.name);

    // Simulate a payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // 1. Update user's profile to mark as having an active subscription
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ has_active_subscription: true })
        .eq('id', user.id);

      if (profileError) {
        console.error('UserSubscriptionsPage: handleSubscribe - profileError during profiles update:', profileError);
        throw profileError;
      } else {
        console.log('UserSubscriptionsPage: handleSubscribe - profiles table updated for has_active_subscription to TRUE.');
      }

      // 2. Deactivate any existing active subscriptions for the user
      if (userActiveSubscription) {
        console.log('UserSubscriptionsPage: handleSubscribe - Deactivating previous subscription:', userActiveSubscription.id);
        const { error: deactivateError } = await supabase
          .from('user_subscriptions')
          .update({ status: 'inactive' })
          .eq('id', userActiveSubscription.id);
        if (deactivateError) {
          console.warn('UserSubscriptionsPage: handleSubscribe - Failed to deactivate previous subscription:', deactivateError);
          // Don't throw, as the new subscription is more important
        } else {
          console.log('UserSubscriptionsPage: handleSubscribe - Previous subscription deactivated.');
        }
      }

      // 3. Create a new entry in user_subscriptions
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

      if (subscriptionError) {
        console.error('UserSubscriptionsPage: handleSubscribe - subscriptionError during user_subscriptions insert:', subscriptionError);
        throw subscriptionError;
      } else {
        console.log('UserSubscriptionsPage: handleSubscribe - New entry added to user_subscriptions table.');
      }

      toast({ title: "Success!", description: `You have successfully subscribed to ${tier.name}!`, variant: "default" });
      
      // Re-fetch all subscription data to update UI
      fetchSubscriptionData();
      // Add a small delay before reloading to ensure database changes propagate
      setTimeout(() => {
        console.log('UserSubscriptionsPage: handleSubscribe - Reloading page after 1 second delay.');
        window.location.reload(); 
      }, 1000); // Increased delay to 1 second

    } catch (error: any) {
      console.error("UserSubscriptionsPage: handleSubscribe - Error during subscription process:", error);
      toast({
        title: "Subscription Failed",
        description: `Failed to process subscription: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessingPayment(null);
      console.log('UserSubscriptionsPage: handleSubscribe - Payment processing finished.');
    }
  };

  if (!hasCheckedInitialSession || isLoadingPage) { // Use hasCheckedInitialSession for initial loading
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

  // Use the user.has_active_subscription from the session context for the main status display
  const hasActiveSubscriptionFromSession = user?.has_active_subscription;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Subscription Plans</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your Current Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {hasActiveSubscriptionFromSession && userActiveSubscription && daysRemaining !== null ? (
            <div className="flex items-center gap-2 text-green-600 font-semibold">
              <CheckCircle2 className="h-5 w-5" />
              <span>You have an active subscription!</span>
              <span className="text-sm text-muted-foreground ml-2">
                ({daysRemaining} day{daysRemaining === 1 ? '' : 's'} remaining)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600 font-semibold">
              <AlertCircle className="h-5 w-5" />
              <span>No active subscription.</span>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {hasActiveSubscriptionFromSession ? "Enjoy all premium features." : "Subscribe to unlock full access to all content and features."}
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
          {subscriptionTiers.map((tier) => {
            const isCurrentPlan = userActiveSubscription?.subscription_tier_id === tier.id && hasActiveSubscriptionFromSession;
            return (
              <Card key={tier.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="2xl">{tier.name}</CardTitle>
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
                    disabled={isCurrentPlan || isProcessingPayment === tier.id}
                  >
                    {isProcessingPayment === tier.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : isCurrentPlan ? (
                      "Current Plan"
                    ) : (
                      "Choose Plan"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <MadeWithDyad />
    </div>
  );
};

export default UserSubscriptionsPage;