"use client";

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Lock } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';

const formSchema = z.object({
  password: z.string().min(6, "New password must be at least 6 characters long."),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

const PasswordResetPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, hasCheckedInitialSession } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const hasRecoveryToken = location.hash.includes('type=recovery');

    // This effect runs whenever the session or initial check status changes.
    if (hasCheckedInitialSession) {
      // If the initial check is done, we still don't have a session,
      // AND there's no recovery token in the URL, then the link is definitely invalid.
      if (!session && !hasRecoveryToken) {
        toast({
          title: "Invalid Link",
          description: "The password reset link is invalid or has expired. Please request a new one.",
          variant: "destructive",
        });
        navigate('/login');
      }
    }
  }, [session, hasCheckedInitialSession, location.hash, navigate, toast]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      // Update the user's password using the temporary session established by the recovery token
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your password has been updated. Please log in with your new password.",
      });
      
      // Sign out the temporary session and redirect to login
      await supabase.auth.signOut();
      navigate('/login');

    } catch (error: any) {
      console.error("Password Reset Error:", error);
      toast({
        title: "Reset Failed",
        description: `Failed to update password: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state if:
  // 1. The initial session check hasn't completed yet.
  // 2. OR, there's a recovery token in the URL, but the session hasn't been established by the context provider yet.
  const isLoading = !hasCheckedInitialSession || (location.hash.includes('type=recovery') && !session);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 pt-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-gray-700 dark:text-gray-300 ml-3">Verifying link...</p>
      </div>
    );
  }

  // If we are not loading but still don't have a session, the useEffect will handle the redirect.
  // Rendering null here prevents a brief flash of the form before redirection.
  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 pt-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Set New Password</CardTitle>
          <CardDescription className="text-center">Enter and confirm your new password below.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><Lock className="h-4 w-4" /> New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><Lock className="h-4 w-4" /> Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Reset Password"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default PasswordResetPage;