"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast, ToastReturn } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { dismissToast } from '@/utils/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  billing_address_line1: z.string().min(1, "Address Line 1 is required."),
  billing_address_city: z.string().min(1, "City is required."),
  billing_address_postal_code: z.string().min(1, "Postal Code is required."),
  billing_address_country: z.string().min(1, "Country is required."),
});

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

interface UserProfile {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
}

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise: Promise<Stripe | null> | null = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: "hsl(var(--foreground))",
      '::placeholder': {
        color: 'hsl(var(--muted-foreground))',
      },
    },
    invalid: {
      color: 'hsl(var(--destructive))',
    },
  },
};

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'OM', name: 'Oman' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'IN', name: 'India' },
  { code: 'PK', name: 'Pakistan' },
];

const PaymentForm = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const tierId = searchParams.get('tierId');
  const userId = searchParams.get('userId');

  const stripe = useStripe();
  const elements = useElements();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      billing_address_line1: "",
      billing_address_city: "",
      billing_address_postal_code: "",
      billing_address_country: "US",
    },
  });

  const fetchData = useCallback(async (currentUserId: string, currentTierId: string) => {
    setFetchError(null);
    
    const [tierResult, userResult] = await Promise.all([
      supabase.from('subscription_tiers').select('*').eq('id', currentTierId).single(),
      supabase.functions.invoke('get-user-email-by-id', { body: { user_id: currentUserId } })
    ]);

    if (tierResult.error) {
      console.error("Error fetching tier details:", tierResult.error);
      setFetchError("Failed to load subscription plan details.");
    } else {
      setSelectedTier(tierResult.data);
    }

    if (userResult.error) {
      console.error("Error fetching user details:", userResult.error);
      setFetchError("Failed to load user details for payment.");
    } else {
      // We need to fetch the name from the profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', currentUserId)
        .single();
      
      if (profileError) {
        console.error("Error fetching user profile name:", profileError);
        setFetchError("Failed to load user name for payment.");
      } else {
        setUserProfile({
          id: currentUserId,
          email: userResult.data.email,
          first_name: profileData.first_name,
          last_name: profileData.last_name,
        });
      }
    }

    setIsPageLoading(false);
  }, []);

  useEffect(() => {
    if (userId && tierId) {
      fetchData(userId, tierId);
    } else {
      setIsPageLoading(false);
      setFetchError("User ID or Tier ID is missing. Please sign up again.");
    }
  }, [userId, tierId, fetchData]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!stripe || !elements || !selectedTier || !selectedTier.stripe_price_id || !userProfile) {
      toast({ title: "Initialization Error", description: "Payment system or user data is not ready.", variant: "destructive" });
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      toast({ title: "Error", description: "Card input element not found.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    let loadingToastId: ToastReturn | undefined;

    try {
      loadingToastId = toast({ title: "Processing Payment...", duration: 999999 }) as ToastReturn;

      const { paymentMethod, error: paymentMethodError } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          email: userProfile.email,
          name: `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim(),
          address: {
            line1: values.billing_address_line1,
            city: values.billing_address_city,
            postal_code: values.billing_address_postal_code,
            country: values.billing_address_country,
          }
        },
      });

      if (paymentMethodError) throw new Error(paymentMethodError.message);

      const { data: edgeFunctionData, error: invokeError } = await supabase.functions.invoke('process-payment-for-new-user', {
        body: {
          userId: userProfile.id,
          email: userProfile.email,
          name: `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim(),
          payment_method_id: paymentMethod.id,
          price_id: selectedTier.stripe_price_id,
          tier_id: selectedTier.id,
        },
      });

      if (invokeError) throw invokeError;

      if (edgeFunctionData.requires_action && edgeFunctionData.client_secret) {
        if (loadingToastId) dismissToast(loadingToastId.id);
        loadingToastId = toast({ title: "Confirming Payment...", description: "Please complete the security check.", duration: 999999 }) as ToastReturn;
        const { error: confirmError } = await stripe.confirmCardPayment(edgeFunctionData.client_secret);
        if (confirmError) throw new Error(confirmError.message);
      }

      if (loadingToastId) dismissToast(loadingToastId.id);
      toast({ title: "Subscription Complete!", description: "Welcome! Please log in to access your dashboard.", variant: "default" });
      navigate('/login', { replace: true });

    } catch (error: any) {
      if (loadingToastId) dismissToast(loadingToastId.id);
      console.error("Payment Error:", error);
      toast({ title: "Payment Failed", description: error.message || 'An unexpected error occurred.', variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPageLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p>Loading payment details...</p></div>;
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader><CardTitle className="text-destructive">Error</CardTitle></CardHeader>
          <CardContent><p>{fetchError}</p></CardContent>
        </Card>
      </div>
    );
  }

  const isStripeReady = !!stripe && !!elements;
  const isButtonDisabled = isSubmitting || !isStripeReady;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 pt-16">
      <div className="w-full max-w-4xl flex flex-col md:flex-row gap-6">
        <Card className="w-full md:flex-1">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Complete Your Subscription</CardTitle>
            <CardDescription className="text-center">Enter your billing and payment information to activate your plan.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2">Billing Information</h3>
                <FormField control={form.control} name="billing_address_line1" render={({ field }) => (
                  <FormItem><FormLabel>Address Line 1</FormLabel><FormControl><Input placeholder="Street address" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField control={form.control} name="billing_address_city" render={({ field }) => (
                    <FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="City" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="billing_address_postal_code" render={({ field }) => (
                    <FormItem><FormLabel>Postal Code</FormLabel><FormControl><Input placeholder="10001" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="billing_address_country" render={({ field }) => (
                    <FormItem><FormLabel>Country</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Country" /></SelectTrigger></FormControl><SelectContent className="max-h-60 overflow-y-auto">{COUNTRIES.map((c) => (<SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                </div>
                <h3 className="text-lg font-semibold border-b pb-2 pt-4">Payment Details</h3>
                <div className="space-y-2">
                  <FormLabel>Card Information</FormLabel>
                  <div className="p-4 border border-input bg-white rounded-md shadow-sm">
                    {isStripeReady ? <CardElement options={CARD_ELEMENT_OPTIONS} /> : <div className="flex items-center justify-center h-10 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</div>}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isButtonDisabled}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : `Pay & Complete Subscription`}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        {selectedTier && (
          <Card className="w-full md:w-80 flex-shrink-0 h-max">
            <CardHeader className="bg-primary text-primary-foreground rounded-t-lg"><CardTitle className="text-xl">Selected Plan</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-2xl font-bold">{selectedTier.name}</p>
              <p className="text-4xl font-bold text-primary">{selectedTier.currency} {selectedTier.price.toFixed(2)}<span className="text-lg font-normal text-muted-foreground"> / {selectedTier.duration_in_months} month{selectedTier.duration_in_months > 1 ? 's' : ''}</span></p>
              <CardDescription>{selectedTier.description}</CardDescription>
              {selectedTier.features && selectedTier.features.length > 0 && (
                <ul className="list-none space-y-1 text-sm">{selectedTier.features.map((f, i) => (<li key={i} className="flex items-center gap-2 text-green-600 dark:text-green-400"><CheckCircle2 className="h-4 w-4 flex-shrink-0" />{f}</li>))}</ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <MadeWithDyad />
    </div>
  );
};

const PaymentPage = () => {
  if (!STRIPE_PUBLISHABLE_KEY) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-red-500">Stripe is not configured.</p></div>;
  }
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm />
    </Elements>
  );
};

export default PaymentPage;