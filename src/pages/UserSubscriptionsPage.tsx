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
import { Link, useSearchParams, useNavigate } from 'react-router-dom';

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

interface UserSubscription {
  id: string;
  user_id: string;
  subscription_tier_id: string;
  start_date: string;
  end_date: string;
  status: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_status: string | null;
}

const UserSubscriptionsPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [subscriptionTiers, setSubscriptionTiers] = useState<SubscriptionTier[]>([]);
  const [userActiveSubscription, setUserActiveSubscription] = useState<UserSubscription | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [isFetchingData, setIsFetchingData] = useState(true);

  const fetchSubscriptionData = async () => {
    setIsFetchingData(true);

    const { data: tiersData, error: tiersError } = await supabase
      .from('subscription_tiers')
      .select('*, stripe_price_id')
      .order('price', { ascending: true });

    if (tiersError) {
      console.error('Error fetching subscription tiers:', tiersError);
      toast({ title: "Error", description: "Failed to load subscription plans.", variant: "destructive" });
    } else {
      setSubscriptionTiers(tiersData || []);
    }

    if (user) {
      const { data: userSubsData, error: userSubError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('end_date', { ascending: false });

      if (userSubError) {
        console.error('Error fetching user subscriptions:', userSubError);
        toast({ title: "Error", description: "Failed to load your subscription status.", variant: "destructive" });
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

  useEffect(() => {
    if (hasCheckedInitialSession) {
      if (user) {
        fetchSubscriptionData();
      } else {
        setIsFetchingData(false);
      }
    }
  }, [user, hasCheckedInitialSession]);

  useEffect(() => {
    const status = searchParams.get('status');

    if (status === 'success') {
      toast({ title: "Payment Successful!", description: "Your subscription is being activated. Please wait a moment for the page to update.", variant: "default" });
      setTimeout(() => {
        fetchSubscriptionData();
      }, 3000); 
    } else if (status === 'cancelled') {
      toast({ title: "Payment Cancelled", description: "You cancelled the checkout process.", variant: "default" });
    }

    if (status) {
      navigate('/user/subscriptions', { replace: true });
    }
  }, [searchParams, toast, navigate]);


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
            <CardDescription>Please log in to manage your subscriptions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/login')}>Go to Login</Button>
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
            const isFreeTier = tier.price === 0 || tier.name.toLowerCase().includes('trial');

            return (
              <Card key={tier.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="2xl">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-4">
                  <p className="text-4xl font-bold">
                    {tier.price === 0 ? "Free" : `${tier.currency} ${tier.price.toFixed(2)}`}
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
                  ) : isFreeTier ? (
                    <Button className="w-full" variant="secondary" disabled>
                      Included / Used
                    </Button>
                  ) : isStripePlanAvailable ? (
                    <Link to={`/user/payment/${tier.id}?priceId=${tier.stripe_price_id}`} className="w-full">
                      <Button className="w-full">
                        {hasActiveSubscriptionFromSession ? 'Change Plan' : 'Subscribe'}
                      </Button>
                    </Link>
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