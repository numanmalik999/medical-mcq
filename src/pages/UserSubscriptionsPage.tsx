"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { CheckCircle2, AlertCircle } from 'lucide-react'; // Removed Loader2
import { differenceInDays, parseISO } from 'date-fns';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import PayPalSubscribeButton from '@/components/PayPalSubscribeButton';

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration_in_months: number;
  description: string | null;
  features: string[] | null;
  paypal_plan_id: string | null;
}

interface UserSubscription {
  id: string;
  user_id: string;
  subscription_tier_id: string;
  start_date: string;
  end_date: string;
  status: string;
  paypal_subscription_id: string | null;
  paypal_plan_id: string | null;
  paypal_status: string | null;
}

const UserSubscriptionsPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [subscriptionTiers, setSubscriptionTiers] = useState<SubscriptionTier[]>([]);
  const [userActiveSubscription, setUserActiveSubscription] = useState<UserSubscription | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [isFetchingData, setIsFetchingData] = useState(true);
  // Removed isProcessingPayment state as it was unused

  // PayPal script options
  const initialPayPalOptions = {
    // @ts-ignore
    clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "YOUR_PAYPAL_CLIENT_ID",
    vault: true,
    intent: "subscription",
  };

  useEffect(() => {
    console.log('UserSubscriptionsPage: useEffect mounted. Current user has_active_subscription from session:', user?.has_active_subscription);
    if (hasCheckedInitialSession) {
      if (user) {
        fetchSubscriptionData();
      } else {
        setIsFetchingData(false);
        console.log('UserSubscriptionsPage: Not logged in, setting isFetchingData to false.');
      }
    }
  }, [user, hasCheckedInitialSession]);

  const fetchSubscriptionData = async () => {
    setIsFetchingData(true);
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
      const { data: userSubsData, error: userSubError } = await supabase
        .from('user_subscriptions')
        .select('id, user_id, subscription_tier_id, start_date, end_date, status, paypal_subscription_id, paypal_plan_id, paypal_status')
        .eq('user_id', user.id)
        .order('end_date', { ascending: false });

      console.log('UserSubscriptionsPage: fetchSubscriptionData - RAW userSubsData from user_subscriptions table:', userSubsData);
      console.log('UserSubscriptionsPage: fetchSubscriptionData - userSubError from user_subscriptions table:', userSubError);

      if (userSubError) {
        console.error('UserSubscriptionsPage: Error fetching user subscriptions from user_subscriptions table:', userSubError);
        toast({ title: "Error", description: "Failed to load your subscription status.", variant: "destructive" });
        setUserActiveSubscription(null);
        setDaysRemaining(null);
      } else if (userSubsData && userSubsData.length > 0) {
        const activeSub = userSubsData.find(sub => sub.status === 'active');
        console.log('UserSubscriptionsPage: fetchSubscriptionData - Client-side filtered activeSub:', activeSub);
        if (activeSub) {
          setUserActiveSubscription(activeSub);
          const endDate = parseISO(activeSub.end_date);
          const today = new Date();
          const remaining = differenceInDays(endDate, today);
          setDaysRemaining(Math.max(0, remaining));
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
    setIsFetchingData(false);
    console.log('UserSubscriptionsPage: fetchSubscriptionData finished, isFetchingData set to false.');
  };

  const handleSubscriptionSuccess = () => {
    // This function is called after a successful PayPal subscription capture
    // It should trigger a refresh of the user's subscription data
    fetchSubscriptionData();
    // Optionally, force a full page reload to ensure session context is updated
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  if (!hasCheckedInitialSession || isFetchingData) {
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

  const hasActiveSubscriptionFromSession = user?.has_active_subscription;

  return (
    <PayPalScriptProvider options={initialPayPalOptions}>
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
              const isPayPalPlanAvailable = !!tier.paypal_plan_id;

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
                    {isCurrentPlan ? (
                      <Button className="w-full" disabled>Current Plan</Button>
                    ) : isPayPalPlanAvailable ? (
                      <div className="w-full">
                        <PayPalSubscribeButton
                          tierId={tier.id}
                          paypalPlanId={tier.paypal_plan_id!}
                          onSubscriptionSuccess={handleSubscriptionSuccess}
                        />
                      </div>
                    ) : (
                      <Button className="w-full" disabled>
                        Payment Not Configured
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        <MadeWithDyad />
      </div>
    </PayPalScriptProvider>
  );
};

export default UserSubscriptionsPage;