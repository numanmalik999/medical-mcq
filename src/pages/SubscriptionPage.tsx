"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import StripeSubscribeButton from '@/components/StripeSubscribeButton';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';

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

const SubscriptionPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [subscriptionTiers, setSubscriptionTiers] = useState<SubscriptionTier[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      fetchSubscriptionTiers();
    }
  }, [hasCheckedInitialSession]);

  // Handle Stripe redirect status messages
  useEffect(() => {
    const status = searchParams.get('status');
    const subId = searchParams.get('subId');

    if (status === 'success') {
      toast({ title: "Subscription Activated!", description: `Your subscription (ID: ${subId}) is now active.`, variant: "default" });
      // Redirect to user dashboard after successful payment
      navigate('/user/dashboard', { replace: true });
    } else if (status === 'cancelled') {
      toast({ title: "Subscription Cancelled", description: "You cancelled the checkout process.", variant: "default" });
    } else if (status === 'failure') {
      toast({ title: "Payment Failed", description: "There was an issue processing your payment. Please try again.", variant: "destructive" });
    }

    // Clear search params after displaying toast
    if (status) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, toast, setSearchParams, navigate]);


  const fetchSubscriptionTiers = async () => {
    setIsFetchingData(true);
    const { data: tiersData, error: tiersError } = await supabase
      .from('subscription_tiers')
      .select('*, stripe_price_id') // Select new Stripe field
      .order('price', { ascending: true });

    if (tiersError) {
      console.error('Error fetching subscription tiers:', tiersError);
      toast({ title: "Error", description: "Failed to load subscription plans.", variant: "destructive" });
      setSubscriptionTiers([]);
    } else {
      setSubscriptionTiers(tiersData || []);
    }
    setIsFetchingData(false);
  };

  if (!hasCheckedInitialSession || isFetchingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading subscription plans...</p>
      </div>
    );
  }

  const preselectedTierId = searchParams.get('tierId');

  return (
    <div className="space-y-6 p-4 md:p-8">
      <h1 className="text-3xl font-bold text-center">Choose Your Plan</h1>
      <p className="text-center text-muted-foreground max-w-2xl mx-auto">
        Select a subscription plan to unlock full access to all content and features.
      </p>

      {subscriptionTiers.length === 0 ? (
        <Card className="max-w-2xl mx-auto">
          <CardContent className="p-6 text-center text-muted-foreground">
            No subscription plans available at the moment. Please check back later.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {subscriptionTiers.map((tier) => {
            const isStripePlanAvailable = !!tier.stripe_price_id;
            const isPreselected = preselectedTierId === tier.id;

            return (
              <Card key={tier.id} className={`flex flex-col ${isPreselected ? 'ring-4 ring-primary shadow-lg' : ''}`}>
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
                  {user ? ( // User is logged in
                    isStripePlanAvailable ? (
                      <div className="w-full">
                        {/* Note: StripeSubscribeButton uses hosted checkout for existing users */}
                        <StripeSubscribeButton
                          tierId={tier.id}
                          stripePriceId={tier.stripe_price_id!}
                          onSubscriptionSuccess={() => { /* Handled by redirect */ }}
                        />
                      </div>
                    ) : (
                      <Button className="w-full" disabled>
                        Payment Not Configured
                      </Button>
                    )
                  ) : ( // User is not logged in
                    <Link to={`/signup?tierId=${tier.id}`} className="w-full">
                      <Button className="w-full">Sign Up to Subscribe</Button>
                    </Link>
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

export default SubscriptionPage;