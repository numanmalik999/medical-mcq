"use client";

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/components/SessionContextProvider';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

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

interface CategoryPlan {
  id: string;
  name: string;
  stripe_price_id_1m: string | null;
  stripe_price_id_2m: string | null;
  stripe_price_id_3m: string | null;
}

const SubscriptionPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [subscriptionTiers, setSubscriptionTiers] = useState<SubscriptionTier[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [categories, setCategories] = useState<CategoryPlan[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<'1' | '2' | '3'>('1');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [selectedCategoryPriceLabel, setSelectedCategoryPriceLabel] = useState('');

  useEffect(() => {
    if (hasCheckedInitialSession) {
      fetchSubscriptionTiers();
    }
  }, [hasCheckedInitialSession]);

  useEffect(() => {
    const status = searchParams.get('status');
    const subId = searchParams.get('subId');

    if (status === 'success') {
      toast({ title: "Subscription Activated!", description: `Your subscription (ID: ${subId}) is now active.`, variant: "default" });
      navigate('/user/dashboard', { replace: true });
    } else if (status === 'cancelled') {
      toast({ title: "Subscription Cancelled", description: "You cancelled the checkout process.", variant: "default" });
    } else if (status === 'failure') {
      toast({ title: "Payment Failed", description: "There was an issue processing your payment. Please try again.", variant: "destructive" });
    }

    if (status) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, toast, setSearchParams, navigate]);


  const fetchSubscriptionTiers = async () => {
    setIsFetchingData(true);
    const { data: tiersData, error: tiersError } = await supabase
      .from('subscription_tiers')
      .select('*, stripe_price_id')
      .order('price', { ascending: true });

    if (tiersError) {
      console.error('Error fetching subscription tiers:', tiersError);
      toast({ title: "Error", description: "Failed to load subscription plans.", variant: "destructive" });
      setSubscriptionTiers([]);
    } else {
      setSubscriptionTiers((tiersData || []).filter((t: any) => {
        const name = (t?.name || '').toLowerCase();
        return !name.includes('3 day') && !name.includes('3-day');
      }));
    }
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name, stripe_price_id_1m, stripe_price_id_2m, stripe_price_id_3m')
      .order('name', { ascending: true });

    if (categoriesError) {
      console.error('Error fetching categories for category plans:', categoriesError);
    } else {
      const loadedCategories = (categoriesData || []) as CategoryPlan[];
      setCategories(loadedCategories);
      if (loadedCategories.length > 0) setSelectedCategoryId(loadedCategories[0].id);
    }

    setIsFetchingData(false);
  };

  const preselectedTierId = searchParams.get('tierId');

  const selectedCategory = useMemo(() => categories.find(c => c.id === selectedCategoryId) || null, [categories, selectedCategoryId]);
  const selectedCategoryPriceId = useMemo(() => {
    if (!selectedCategory) return null;
    if (selectedDuration === '1') return selectedCategory.stripe_price_id_1m;
    if (selectedDuration === '2') return selectedCategory.stripe_price_id_2m;
    return selectedCategory.stripe_price_id_3m;
  }, [selectedCategory, selectedDuration]);

  useEffect(() => {
    const loadPrice = async () => {
      setSelectedCategoryPriceLabel('');
      if (!selectedCategoryPriceId) return;

      const { data, error } = await supabase.functions.invoke('get-stripe-price', {
        body: { price_id: selectedCategoryPriceId },
      });

      if (error || !data) return;

      const amount = typeof data.unit_amount === 'number' ? data.unit_amount / 100 : null;
      const currency = (data.currency || 'usd').toUpperCase();
      if (amount !== null) setSelectedCategoryPriceLabel(`${currency} ${amount.toFixed(2)}`);
    };

    loadPrice();
  }, [selectedCategoryPriceId]);

  const handleSingleCategoryCheckout = async () => {
    if (!user || !selectedCategoryId || !selectedCategoryPriceId) return;

    setIsRedirecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          price_id: selectedCategoryPriceId,
          user_id: user.id,
          purchase_type: 'category_unlock',
          category_id: selectedCategoryId,
          duration_in_months: Number(selectedDuration),
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Could not retrieve checkout URL.');
      window.location.href = data.url;
    } catch (error: any) {
      toast({ title: 'Payment Error', description: error.message || 'Failed to start checkout.', variant: 'destructive' });
      setIsRedirecting(false);
    }
  };

  if (!hasCheckedInitialSession || isFetchingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading subscription plans...</p>
      </div>
    );
  }

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
            const tierName = (tier.name || 'Plan').toString();
            const tierPrice = Number(tier.price || 0);
            const tierCurrency = (tier.currency || 'USD').toString();
            const durationMonths = Number(tier.duration_in_months || 0);
            const isStripePlanAvailable = !!tier.stripe_price_id;
            const isFreeTier = tierPrice === 0 || tierName.toLowerCase().includes('trial');
            const isPreselected = preselectedTierId === tier.id;

            return (
              <Card key={tier.id} className={`flex flex-col ${isPreselected ? 'ring-4 ring-primary shadow-lg' : ''}`}>
                <CardHeader>
                  <CardTitle className="2xl">{tierName}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-4">
                  <div className="space-y-1">
                    <p className="text-4xl font-bold">
                      {tierPrice === 0 ? "Free" : `${tierCurrency} ${tierPrice.toFixed(2)}`}
                      {tierPrice > 0 && <span className="text-lg font-normal text-muted-foreground ml-1">total</span>}
                    </p>
                    {tierPrice > 0 && durationMonths > 1 && (
                      <p className="text-sm text-muted-foreground font-medium">
                        (Equates to {tierCurrency} {(tierPrice / durationMonths).toFixed(2)} / month)
                      </p>
                    )}
                  </div>
                  {tier.features && tier.features.length > 0 && (
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {tier.features.map((feature, index) => (
                        <li key={index}>{feature}</li>
                      ))}
                    </ul>
                  )}
                </CardContent>
                <CardFooter>
                  {user ? (
                    isFreeTier ? (
                      <Button className="w-full" variant="secondary" disabled>
                        Included with Signup
                      </Button>
                    ) : isStripePlanAvailable ? (
                      <Link to={`/user/payment/${tier.id}?priceId=${tier.stripe_price_id!}`} className="w-full">
                        <Button className="w-full">
                          Subscribe
                        </Button>
                      </Link>
                    ) : (
                      <Button className="w-full" disabled>
                        Payment Not Configured
                      </Button>
                    )
                  ) : (
                    <Link to={`/signup?tierId=${tier.id}`} className="w-full">
                      <Button className="w-full">{isFreeTier ? "Start Free Trial" : "Sign Up to Subscribe"}</Button>
                    </Link>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="max-w-6xl mx-auto">
        <CardHeader>
          <CardTitle>Single Category Plan</CardTitle>
          <CardDescription>Select a category and duration to unlock only that specialty.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedDuration} onValueChange={(v) => setSelectedDuration(v as '1' | '2' | '3')}>
            <SelectTrigger>
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 month</SelectItem>
              <SelectItem value="2">2 months</SelectItem>
              <SelectItem value="3">3 months</SelectItem>
            </SelectContent>
          </Select>

          {user ? (
            <Button onClick={handleSingleCategoryCheckout} disabled={!selectedCategoryId || !selectedCategoryPriceId || isRedirecting}>
              {isRedirecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Buy Category Plan {selectedCategoryPriceLabel ? `(${selectedCategoryPriceLabel})` : ''}
            </Button>
          ) : (
            <Link to="/signup" className="w-full">
              <Button className="w-full">Sign Up to Continue</Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionPage;