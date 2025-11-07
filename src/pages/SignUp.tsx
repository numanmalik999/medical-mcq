"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { Loader2, CheckCircle2 } from 'lucide-react'; // Import Loader2 and CheckCircle2

const formSchema = z.object({
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  first_name: z.string().optional().or(z.literal('')),
  last_name: z.string().optional().or(z.literal('')),
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

const SignUp = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);

  const { hasCheckedInitialSession } = useSession();
  const [searchParams] = useSearchParams();
  const tierId = searchParams.get('tierId');

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

  const handleStripeCheckout = async (userId: string, priceId: string) => {
    const stripe = await (window as any).Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
    if (!stripe) {
      throw new Error("Failed to load Stripe library.");
    }

    const { data: edgeFunctionData, error: invokeError } = await supabase.functions.invoke('create-stripe-checkout-session', {
      body: {
        price_id: priceId,
        user_id: userId,
      },
    });

    if (invokeError) {
      throw invokeError;
    }

    const sessionId = edgeFunctionData.sessionId;

    const { error: redirectError } = await stripe.redirectToCheckout({
      sessionId: sessionId,
    });

    if (redirectError) {
      throw redirectError;
    }
    // Note: Execution stops here as the user is redirected to Stripe.
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: values.first_name || null,
            last_name: values.last_name || null,
            phone_number: values.phone_number || null,
            whatsapp_number: values.whatsapp_number || null,
          },
        },
      });

      if (error) {
        throw error;
      }

      if (data.user && data.session) {
        // User successfully signed up and is logged in
        toast({
          title: "Sign Up Successful!",
          description: "Account created. Redirecting to payment...",
        });

        if (selectedTier && selectedTier.stripe_price_id) {
          // Immediately redirect to payment
          await handleStripeCheckout(data.user.id, selectedTier.stripe_price_id);
          // If handleStripeCheckout succeeds, this code won't run due to redirect.
        } else {
          // Fallback if no tier was selected or price ID is missing
          navigate('/user/dashboard');
        }
      } else if (data.user && !data.session) {
        // Email confirmation required
        toast({
          title: "Check your email",
          description: "Please check your email for a confirmation link to activate your account.",
        });
        navigate('/login');
      }
    } catch (error: any) {
      console.error("Sign Up Error:", error);
      toast({
        title: "Sign Up Failed",
        description: error.message || "An unexpected error occurred during sign up.",
        variant: "destructive",
      });
    } finally {
      // If Stripe redirect fails, we stop loading here.
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 pt-16">
      <div className="w-full max-w-4xl flex flex-col md:flex-row gap-6">
        {/* Left Side: Sign Up Form */}
        <Card className="w-full md:flex-1">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {isSubscriptionFlow ? "Create Account & Subscribe" : "Create an Account"}
            </CardTitle>
            <CardDescription className="text-center">
              Enter your details to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name (Optional)</FormLabel>
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
                        <FormLabel>Last Name (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
                
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : isSubscriptionFlow ? (
                    "Continue to Payment"
                  ) : (
                    "Sign Up"
                  )}
                </Button>
              </form>
            </Form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to={`/login${tierId ? `?tierId=${tierId}` : ''}`} className="text-primary hover:underline">
                Log In
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Right Side: Subscription Details (Conditional) */}
        {isSubscriptionFlow && selectedTier && (
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

export default SignUp;