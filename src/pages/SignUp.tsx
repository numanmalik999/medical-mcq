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
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { dismissToast } from '@/utils/toast';

const formSchema = z.object({
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  first_name: z.string().min(1, "First name is required."),
  last_name: z.string().min(1, "Last name is required."),
  phone_number: z.string().optional().or(z.literal('')),
  whatsapp_number: z.string().optional().or(z.literal('')),
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

// Load Stripe outside of the component render cycle
// @ts-ignore
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

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

const SignUpForm = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);

  const { hasCheckedInitialSession } = useSession();
  const [searchParams] = useSearchParams();
  const tierId = searchParams.get('tierId');

  const stripe = useStripe();
  const elements = useElements();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      phone_number: "",
      whatsapp_number: "",
    },
  });

  const fetchTierDetails = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error("Error fetching tier details:", error);
      toast({ title: "Error", description: "Failed to load subscription plan details.", variant: "destructive" });
      setSelectedTier(null);
    } else {
      setSelectedTier(data);
    }
  }, [toast]);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      if (tierId) {
        fetchTierDetails(tierId);
      }
      setIsPageLoading(false);
    }
  }, [hasCheckedInitialSession, tierId, fetchTierDetails]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!stripe || !elements || !selectedTier || !selectedTier.stripe_price_id) {
      toast({ title: "Error", description: "Payment system not initialized or plan missing.", variant: "destructive" });
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
      // 1. Show initial loading toast
      loadingToastId = toast({
        title: "Processing Payment...",
        description: "Creating account and subscription. Please wait.",
        duration: 999999,
      }) as ToastReturn;

      // 2. Create Payment Method
      const { paymentMethod, error: paymentMethodError } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: { email: values.email, name: `${values.first_name} ${values.last_name}`.trim() || undefined },
      });

      if (paymentMethodError) {
        throw new Error(paymentMethodError.message || "Failed to create payment method.");
      }

      // 3. Call Edge Function to create user and subscription
      const { data: edgeFunctionData, error: invokeError } = await supabase.functions.invoke('create-user-and-subscription', {
        body: {
          ...values, // user details (email, password, profile fields)
          payment_method_id: paymentMethod.id,
          price_id: selectedTier.stripe_price_id,
          tier_id: selectedTier.id,
        },
      });

      if (invokeError) {
        throw invokeError;
      }

      // 4. Handle response (3D Secure confirmation if required)
      if (edgeFunctionData.requires_action && edgeFunctionData.client_secret) {
        if (loadingToastId) dismissToast(loadingToastId.id);
        
        loadingToastId = toast({
          title: "Confirming Payment...",
          description: "A security check is required. Please complete the 3D Secure verification.",
          duration: 999999,
        }) as ToastReturn;

        const { error: confirmError } = await stripe.confirmCardPayment(edgeFunctionData.client_secret);

        if (confirmError) {
          throw new Error(confirmError.message || "Payment confirmation failed.");
        }
      }

      // 5. Final Success
      if (loadingToastId) dismissToast(loadingToastId.id);
      
      if (edgeFunctionData.user_id && edgeFunctionData.subscription_status === 'active') {
        // If payment was successful and user is logged in (or will be logged in via magic link/session update)
        toast({
          title: "Signup & Subscription Complete!",
          description: "Welcome! You now have full access to all features.",
          variant: "default",
        });
        // Redirect to dashboard
        navigate('/user/dashboard', { replace: true });
      } else {
        // If email confirmation is required (no session returned by auth.admin.createUser)
        toast({
          title: "Check your email",
          description: "Account created and payment processed. Please check your email for a confirmation link to activate your account and log in.",
        });
        // Redirect to login page
        navigate(`/login?tierId=${tierId}`, { replace: true });
      }

    } catch (error: any) {
      if (loadingToastId) dismissToast(loadingToastId.id);
      console.error("Signup/Payment Error:", error);
      toast({
        title: "Signup/Payment Failed",
        description: error.message || "An unexpected error occurred during signup and payment.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasCheckedInitialSession || isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 pt-16">
        <p className="text-gray-700">Loading signup page...</p>
      </div>
    );
  }

  const isSubscriptionFlow = !!tierId && !!selectedTier;

  if (!isSubscriptionFlow) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 pt-16">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Select a Plan First</CardTitle>
            <CardDescription>
              Please choose a subscription plan before signing up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/subscription">
              <Button>View Plans</Button>
            </Link>
          </CardContent>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 pt-16">
      <div className="w-full max-w-4xl flex flex-col md:flex-row gap-6">
        {/* Left Side: Sign Up Form */}
        <Card className="w-full md:flex-1">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              Create Account & Subscribe
            </CardTitle>
            <CardDescription className="text-center">
              Enter your details and payment information to complete your subscription.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number (Optional)</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="+1234567890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="whatsapp_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp Number (Optional)</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="+1234567890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Stripe Card Element */}
                <div className="space-y-2">
                  <FormLabel>Card Details</FormLabel>
                  <div className="p-3 border rounded-md bg-white">
                    <CardElement options={CARD_ELEMENT_OPTIONS} />
                  </div>
                </div>
                
                <Button type="submit" className="w-full" disabled={isSubmitting || !stripe || !elements}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Complete Signup & Pay"
                  )}
                </Button>
              </form>
            </Form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to={`/login?tierId=${tierId}`} className="text-primary hover:underline">
                Log In
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Right Side: Subscription Details */}
        {selectedTier && (
          <Card className="w-full md:w-80 flex-shrink-0 h-max">
            <CardHeader className="bg-primary text-primary-foreground rounded-t-lg">
              <CardTitle className="text-xl">Selected Plan</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <p className="text-2xl font-bold">{selectedTier.name}</p>
              <p className="text-4xl font-bold text-primary">
                {selectedTier.currency} {selectedTier.price.toFixed(2)}
                <span className="text-lg font-normal text-muted-foreground"> / {selectedTier.duration_in_months} month{selectedTier.duration_in_months > 1 ? 's' : ''}</span>
              </p>
              <CardDescription>{selectedTier.description}</CardDescription>
              {selectedTier.features && selectedTier.features.length > 0 && (
                <ul className="list-none space-y-1 text-sm">
                  {selectedTier.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <MadeWithDyad />
    </div>
  );
};

const SignUp = () => {
  const { hasCheckedInitialSession } = useSession();
  const [searchParams] = useSearchParams();
  const tierId = searchParams.get('tierId');

  if (!hasCheckedInitialSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 pt-16">
        <p className="text-gray-700">Loading signup page...</p>
      </div>
    );
  }

  // Only render Elements if we have a tierId, otherwise the form will handle the redirect
  if (tierId) {
    // Check if the publishable key is available before rendering Elements
    if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 pt-16">
          <p className="text-red-500">Stripe is not configured. Please set VITE_STRIPE_PUBLISHABLE_KEY.</p>
        </div>
      );
    }
    return (
      <Elements stripe={stripePromise}>
        <SignUpForm />
      </Elements>
    );
  }

  // If no tierId, render the form directly (it will redirect to /subscription)
  return <SignUpForm />;
};

export default SignUp;