"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import PayPalSubscribeButton from '@/components/PayPalSubscribeButton';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
// Removed unused 'Loader2' import
// import { Loader2 } from 'lucide-react';

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

const SubscriptionPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [subscriptionTiers, setSubscriptionTiers] = useState<SubscriptionTier[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // PayPal script options
  const initialPayPalOptions = {
    // @ts-ignore
    clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "YOUR_PAYPAL_CLIENT_ID",
    vault: true,
    intent: "subscription",
  };

  useEffect(() => {
    if (hasCheckedInitialSession) {
      fetchSubscriptionTiers();
    }
  }, [hasCheckedInitialSession]);

  const fetchSubscriptionTiers = async () => {
    setIsFetchingData(true);
    const { data: tiersData, error: tiersError } = await supabase
      .from('subscription_tiers')
      .select('*')
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

  const handleSubscriptionSuccess = () => {
    toast({ title: "Success!", description: "Your subscription has been activated.", variant: "default" });
    // Redirect to user dashboard or subscriptions page after successful payment
    navigate('/user/dashboard');
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

  const preselectedTierId = searchParams.get('tierId');

  return (
    <PayPalScriptProvider options={initialPayPalOptions}>
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
              const isPayPalPlanAvailable = !!tier.paypal_plan_id;
              const isPreselected = preselectedTierId === tier.id;

              return (
                <Card key={tier.id} className={`flex flex-col ${isPreselected ? 'ring-2 ring-primary' : ''}`}>
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
                      isPayPalPlanAvailable ? (
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
                      )
                    ) : ( // User is not logged in
                      <Link to={`/signup?tierId=${tier.id}`}>
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
    </PayPalScriptProvider>
  );
};

export default SubscriptionPage;