"use client";

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Lock, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface SubscribePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  description?: string;
  lockedCategoryId?: string | null;
}

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  stripe_price_id: string | null;
}

interface CategoryPlan {
  id: string;
  name: string;
  stripe_price_id_1m: string | null;
  stripe_price_id_2m: string | null;
  stripe_price_id_3m: string | null;
}

const SubscribePromptDialog = ({ open, onOpenChange, featureName, description, lockedCategoryId = null }: SubscribePromptDialogProps) => {
  const { user } = useSession();
  const { toast } = useToast();

  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [categories, setCategories] = useState<CategoryPlan[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<'1' | '2' | '3'>('1');
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [selectedCategoryPriceLabel, setSelectedCategoryPriceLabel] = useState<string>('');

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      setIsLoadingPlans(true);
      try {
        const [{ data: tiersData, error: tiersError }, { data: categoriesData, error: catError }] = await Promise.all([
          supabase
            .from('subscription_tiers')
            .select('id, name, price, currency, stripe_price_id')
            .order('price', { ascending: true }),
          supabase
            .from('categories')
            .select('id, name, stripe_price_id_1m, stripe_price_id_2m, stripe_price_id_3m')
            .order('name', { ascending: true }),
        ]);

        if (tiersError) throw tiersError;
        if (catError) throw catError;

        const filteredTiers = (tiersData || []).filter((t: any) => !/3\s*day/i.test((t.name || '').toLowerCase()));
        setTiers(filteredTiers);
        const catPlans = (categoriesData || []) as CategoryPlan[];
        setCategories(catPlans);

        const defaultCategoryId = lockedCategoryId && catPlans.some(c => c.id === lockedCategoryId)
          ? lockedCategoryId
          : (catPlans[0]?.id || '');
        setSelectedCategoryId(defaultCategoryId);
      } catch (e: any) {
        toast({ title: 'Error', description: e.message || 'Failed to load plans.', variant: 'destructive' });
      } finally {
        setIsLoadingPlans(false);
      }
    };

    load();
  }, [open, toast, lockedCategoryId]);

  const selectedCategory = useMemo(
    () => categories.find(c => c.id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );

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

    if (open) loadPrice();
  }, [open, selectedCategoryPriceId]);

  const startCheckout = async (priceId: string, purchaseType: 'subscription_tier' | 'category_unlock') => {
    if (!user) {
      toast({ title: 'Login Required', description: 'Please sign in to continue.', variant: 'default' });
      return;
    }

    setIsRedirecting(true);
    try {
      const body: any = {
        price_id: priceId,
        user_id: user.id,
        purchase_type: purchaseType,
      };

      if (purchaseType === 'category_unlock') {
        body.category_id = selectedCategoryId;
        body.duration_in_months = Number(selectedDuration);
      }

      const { data, error } = await supabase.functions.invoke('create-checkout-session', { body });
      if (error) throw error;
      if (!data?.url) throw new Error('Could not retrieve checkout URL.');

      window.location.href = data.url;
    } catch (error: any) {
      toast({ title: 'Payment Error', description: error.message || 'Checkout failed.', variant: 'destructive' });
      setIsRedirecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[560px] max-h-[90vh] overflow-y-auto rounded-3xl p-0 border-none shadow-2xl">
        <div className="bg-primary p-8 text-primary-foreground text-center relative">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-[-10%] right-[-10%] w-32 h-32 bg-white rounded-full blur-2xl"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-32 h-32 bg-white rounded-full blur-2xl"></div>
          </div>
          <div className="mx-auto bg-white/20 p-4 rounded-full w-fit mb-4 backdrop-blur-sm shadow-inner">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight mb-2">Premium Access Required</DialogTitle>
          <p className="text-primary-foreground/80 text-sm font-medium">Unlock the full potential of your study session.</p>
        </div>

        <div className="p-4 sm:p-6 space-y-5 bg-background">
          <div className="space-y-2">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {featureName}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {description || 'Choose any plan below. For full details, visit the subscription page.'}
            </p>
          </div>

          {isLoadingPlans ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading plans...
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Standard Plans</p>
                <div className="grid grid-cols-1 gap-2">
                  {tiers.filter(t => !!t.stripe_price_id).map((tier) => (
                    <Button
                      key={tier.id}
                      variant="outline"
                      className="h-10 justify-between"
                      disabled={isRedirecting}
                      onClick={() => startCheckout(tier.stripe_price_id!, 'subscription_tier')}
                    >
                      <span>{tier.name}</span>
                      <span className="text-xs opacity-80">{tier.currency} {tier.price.toFixed(2)}</span>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border rounded-xl p-3">
                <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Single Category Plan</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                </div>

                <Button
                  className="w-full"
                  disabled={!selectedCategoryId || !selectedCategoryPriceId || isRedirecting}
                  onClick={() => selectedCategoryPriceId && startCheckout(selectedCategoryPriceId, 'category_unlock')}
                >
                  {isRedirecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Continue with Single Category Plan {selectedCategoryPriceLabel ? `(${selectedCategoryPriceLabel})` : ''}
                </Button>
              </div>
            </>
          )}

          <p className="text-center text-xs text-muted-foreground">
            <Link to="/subscription" className="font-bold text-primary hover:underline inline-flex items-center gap-1">
              See all features on subscription page <ArrowRight className="h-3 w-3" />
            </Link>
          </p>

          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full text-muted-foreground hover:text-foreground">
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscribePromptDialog;
