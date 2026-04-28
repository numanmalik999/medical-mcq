"use client";

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail } from 'lucide-react';

const ForgotPasswordPage = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const baseUrl = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${baseUrl}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: 'Reset Link Sent',
        description: 'If this email exists, a password reset link has been sent.',
      });
      setEmail('');
    } catch (error: any) {
      toast({
        title: 'Request Failed',
        description: error?.message || 'Unable to send reset email right now.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-start bg-gray-50 p-4 pt-8 md:pt-12">
      <Card className="w-full max-w-md border-none shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground py-10 text-center">
          <div className="bg-white/20 p-3 rounded-2xl w-fit mx-auto mb-4 backdrop-blur-md">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-black uppercase tracking-tight">Reset Password</CardTitle>
          <CardDescription className="text-primary-foreground/70 font-medium">
            Enter your email to receive a password reset link.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Email
              </Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@doctor.com"
                className="h-11 rounded-xl"
                autoComplete="email"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-2xl text-sm font-black uppercase tracking-widest"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send Reset Link
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Back to{' '}
              <Link to="/login" className="text-primary font-black uppercase hover:underline">
                Login
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;
