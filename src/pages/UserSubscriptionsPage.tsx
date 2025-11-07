"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import StripeSubscribeButton from '@/components/StripeSubscribeButton';
import { useSearchParams } from 'react-router-dom';

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration_in_months: number;
  description: string | null;
  features: string[] | null;
  stripe_price_id: string | null; // Updated field
}

interface UserSubscription {
  id: string;
  user_id: string;
  subscription_tier_id: string;
  start_date: string;
  end_date: string;
  status: string;
  stripe_subscription_id: string | null; // Updated field
  stripe_customer_id: string | null; // Updated field
  stripe_status: string | null; // Updated field
}

const UserSubscriptionsPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [subscriptionTiers, setSubscriptionTiers] = useState<SubscriptionTier[]>([]);
  const [userActiveSubscription, setUserActiveSubscription] = useState<UserSubscription | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [isFetchingData, setIsFetchingData] = useState(true);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      if (user) {
        fetchSubscriptionData();
      } else {
        setIsFetchingData(false);
      }
    }
  }, [user, hasCheckedInitialSession]);

  // Handle Stripe redirect status messages
  useEffect(() => {
    const status = searchParams.get('status');
    const subId = searchParams.get('subId');

    if (status === 'success') {
      toast({ title: "Subscription Activated!", description: `Your subscription (ID: ${subId}) is now active.`, variant: "default" });
    } else if (status === 'cancelled') {
      toast({ title: "Subscription Cancelled", description: "You cancelled the checkout process.", variant: "default" });
    } else if (status === 'failure') {
      toast({ title: "Payment Failed", description: "There was an issue processing your payment. Please try again.", variant: "destructive" });
    }

    // Clear search params after displaying toast
    if (status) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, toast, setSearchParams]);


  const fetchSubscriptionData = async () => {
    setIsFetchingData(true);

    // Fetch all subscription tiers
    const { data: tiersData, error: tiersError } = await supabase
      .from('subscription_tiers')
      .select('*, stripe_price_id') // Select new Stripe field
      .order('price', { ascending: true });

    if (tiersError) {
      console.error('UserSubscriptionsPage: Error fetching subscription tiers:', tiersError);
      toast({ title: "Error", description: "Failed to load subscription plans.", variant: "destructive" });
      setSubscriptionTiers([]);
    } else {
      setSubscriptionTiers(tiersData || []);
    }

    // Fetch user's active subscription
    if (user) {
      const { data: userSubsData, error: userSubError } = await supabase
        .from('user_subscriptions')
        .select('id, user_id, subscription_tier_id, start_date, end_date, status, stripe_subscription_id, stripe_customer_id, stripe_status') // Select new Stripe fields
        .eq('user_id', user.id)
        .order('end_date', { ascending: false });

      if (userSubError) {
        console.error('UserSubscriptionsPage: Error fetching user subscriptions from user_subscriptions table:', userSubError);
        toast({ title: "Error", description: "Failed to load your subscription status.", variant: "destructive" });
        setUserActiveSubscription(null);
        setDaysRemaining(null);
      } else if (userSubsData && userSubsData.length > 0) {
        const activeSub = userSubsData.find(sub => sub.status === 'active');
        if (activeSub) {
          setUserActiveSubscription(activeSub);
          const endDate = parseISO(activeSub.end_date);
          const today = new Date();
          const remaining = differenceInDays(endDate, today);
          setDaysRemaining(Math.max(0, remaining));
        } else {
          setUserActiveSubscription(null);
          setDaysRemaining(null);
        }
      } else {
        setUserActiveSubscription(null);
        setDaysRemaining(null);
      }
    }
    setIsFetchingData(false);
  };

  const handleSubscriptionSuccess = () => {
    // This function is called after a successful Stripe subscription capture (if triggered manually)
    // In the Stripe flow, the fulfillment Edge Function handles the DB update and redirects back.
    // We just need to trigger a refresh here to update the UI state.
    fetchSubscriptionData();
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
            const isStripePlanAvailable = !!tier.stripe_price_id;

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
                  ) : isStripePlanAvailable ? (
                    <div className="w-full">
                      <StripeSubscribeButton
                        tierId={tier.id}
                        stripePriceId={tier.stripe_price_id!}
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
  );
};

export default UserSubscriptionsPage;