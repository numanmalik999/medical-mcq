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
import { Loader2, CheckCircle2 } from 'lucide-react';

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
}

const SignUp = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [tierFetchError, setTierFetchError] = useState<string | null>(null);

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
    setTierFetchError(null);
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error("Error fetching tier details:", error);
      setTierFetchError("Failed to load subscription plan details. Please ensure the tier ID is valid.");
      setSelectedTier(null);
    } else {
      setSelectedTier(data);
    }
  }, []);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      if (tierId) {
        fetchTierDetails(tierId);
      }
      setIsPageLoading(false);
    }
  }, [hasCheckedInitialSession, tierId, fetchTierDetails]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user-account-only', {
        body: values,
      });

      if (error) {
        throw error;
      }

      const newUserId = data.userId;
      if (!newUserId) {
        throw new Error("Failed to get user ID after account creation.");
      }

      toast({
        title: "Account Created!",
        description: "Redirecting to payment to complete your subscription.",
      });

      // Redirect to the new payment page with user and tier info
      navigate(`/payment?userId=${newUserId}&tierId=${tierId}`, { replace: true });

    } catch (error: any) {
      console.error("Signup Error:", error);
      toast({
        title: "Signup Failed",
        description: error.message || 'An unexpected error occurred.',
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

  if (!tierId || !selectedTier) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 pt-16">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Select a Plan First</CardTitle>
            <CardDescription>
              {tierFetchError || "Please choose a subscription plan before signing up."}
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
        <Card className="w-full md:flex-1">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Create Your Account</CardTitle>
            <CardDescription className="text-center">Step 1 of 2: Set up your login details.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="first_name" render={({ field }) => (
                    <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="last_name" render={({ field }) => (
                    <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="you@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="phone_number" render={({ field }) => (
                    <FormItem><FormLabel>Phone (Optional)</FormLabel><FormControl><Input type="tel" placeholder="+1234567890" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="whatsapp_number" render={({ field }) => (
                    <FormItem><FormLabel>WhatsApp (Optional)</FormLabel><FormControl><Input type="tel" placeholder="+1234567890" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Continue to Payment"}
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
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default SignUp;