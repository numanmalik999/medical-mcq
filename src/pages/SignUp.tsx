"use client";

import { useState } from 'react';
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
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  first_name: z.string().min(2, "First name is required (min 2 characters)."),
  last_name: z.string().min(2, "Last name is required (min 2 characters)."),
  phone_number: z.string().optional().or(z.literal('')),
  whatsapp_number: z.string().optional().or(z.literal('')),
});

const SignUp = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const baseUrl = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
  const redirectToUrl = `${baseUrl}/redirect`;

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

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: values.first_name,
            last_name: values.last_name,
            phone_number: values.phone_number,
            whatsapp_number: values.whatsapp_number,
          },
        },
      });

      if (error) {
        throw error;
      }

      setIsSubmitted(true);
      toast({
        title: "Account Created!",
        description: "Please check your email to confirm your account and start your 3-day trial.",
      });
      form.reset();
    } catch (error: any) {
      console.error("Signup Error:", error);
      let errorMessage = error.message || 'An unexpected error occurred.';
      
      if (errorMessage.toLowerCase().includes('already registered') || errorMessage.toLowerCase().includes('already exists')) {
        errorMessage = "This email address is already registered. Please log in instead.";
      }

      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 pt-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Create Your Account</CardTitle>
          <CardDescription className="text-center">Sign up to get 3 days of full premium access.</CardDescription>
        </CardHeader>
        <CardContent>
          {isSubmitted ? (
            <div className="text-center space-y-4">
              <p className="text-lg font-semibold">Thank you for signing up!</p>
              <p className="text-muted-foreground">A confirmation link has been sent to your email address. Please click the link to activate your account and 3-day trial.</p>
              <Link to="/login">
                <Button>Back to Login</Button>
              </Link>
            </div>
          ) : (
            <>
              <Auth
                supabaseClient={supabase}
                providers={['google']}
                appearance={{
                  theme: ThemeSupa,
                  variables: {
                    default: {
                      colors: {
                        brand: 'hsl(var(--primary))',
                        brandAccent: 'hsl(var(--primary-foreground))',
                      },
                    },
                  },
                }}
                theme="light"
                view="sign_up"
                redirectTo={redirectToUrl}
                onlyThirdPartyProviders={true}
              />
              
              <Separator className="my-6" />
              
              <p className="text-center text-sm text-muted-foreground mb-4">Or sign up with email:</p>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="first_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input placeholder="John" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="last_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input placeholder="Doe" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input placeholder="you@example.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="phone_number" render={({ field }) => (
                      <FormItem><FormLabel>Phone (Optional)</FormLabel><FormControl><Input type="tel" placeholder="+1..." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="whatsapp_number" render={({ field }) => (
                      <FormItem><FormLabel>WhatsApp (Optional)</FormLabel><FormControl><Input type="tel" placeholder="+1..." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <Button type="submit" className="w-full h-11 text-base font-bold" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Account & Start Trial"}
                  </Button>
                </form>
              </Form>
            </>
          )}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary font-bold hover:underline">
              Log In
            </Link>
          </p>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default SignUp;