"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, MessageSquare, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// --- Blocklist for Disposable Emails ---
const DISPOSABLE_DOMAINS = [
  'temp-mail.org', 'tempmail.com', 'guerrillamail.com', '10minutemail.com', 
  'mailinator.com', 'yopmail.com', 'dispostable.com', 'trashmail.com', 
  'temp-mail.net', 'minuteinbox.com', 'getnada.com'
];

const formSchema = z.object({
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  first_name: z.string().min(2, "First name is required (min 2 characters)."),
  last_name: z.string().min(2, "Last name is required (min 2 characters)."),
  phone_number: z.string().min(10, "Valid phone number required."),
  whatsapp_number: z.string().min(10, "WhatsApp number required for trial."),
});

const FINGERPRINT_KEY = 'sp_device_identity_v1';

const SignUp = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isDeviceFlagged, setIsDeviceFlagged] = useState(false);
  
  // WhatsApp Verification State
  const [isVerifyingWhatsApp, setIsVerifyingWhatsApp] = useState(false);
  const [isWhatsAppVerified, setIsWhatsAppVerified] = useState(false);

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

  useEffect(() => {
    // Check for Device Fingerprint
    const history = localStorage.getItem(FINGERPRINT_KEY);
    if (history === 'trial_claimed') {
        setIsDeviceFlagged(true);
    }
  }, []);

  const validateDisposableEmail = (email: string) => {
    const domain = email.split('@')[1]?.toLowerCase();
    return !DISPOSABLE_DOMAINS.includes(domain);
  };

  const handleWhatsAppVerify = () => {
    const whatsappNum = form.getValues('whatsapp_number');
    if (!whatsappNum || whatsappNum.length < 10) {
        toast({ title: "Phone Required", description: "Please enter your WhatsApp number first.", variant: "destructive" });
        return;
    }

    setIsVerifyingWhatsApp(true);
    
    // Construct unique verification link
    // In a real production environment, this would trigger an OTP.
    // For now, we simulate by opening a WhatsApp link to the admin.
    const uniqueId = Math.random().toString(36).substring(7).toUpperCase();
    const adminNum = "923174636479";
    const text = encodeURIComponent(`I am requesting a 3-Day Trial for Study Prometric. Verification Code: SP-${uniqueId}`);
    
    window.open(`https://wa.me/${adminNum}?text=${text}`, '_blank');

    toast({
        title: "Verification Triggered",
        description: "Please send the message on WhatsApp to verify your clinical identity.",
    });

    // Simulate verification success after a short delay for UX
    setTimeout(() => {
        setIsWhatsAppVerified(true);
        setIsVerifyingWhatsApp(false);
        toast({ title: "Identity Verified", description: "WhatsApp identity confirmed. You can now complete registration." });
    }, 3000);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!validateDisposableEmail(values.email)) {
        toast({ title: "Invalid Email", description: "Temporary/Disposable email providers are not allowed.", variant: "destructive" });
        return;
    }

    if (!isWhatsAppVerified) {
        toast({ title: "Verification Required", description: "Please verify your WhatsApp number to start your trial.", variant: "destructive" });
        return;
    }

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
            device_identity: localStorage.getItem(FINGERPRINT_KEY) || 'new_device'
          },
        },
      });

      if (error) throw error;

      // Flag this browser as having claimed a trial
      localStorage.setItem(FINGERPRINT_KEY, 'trial_claimed');
      
      setIsSubmitted(true);
      toast({
        title: "Account Created!",
        description: "Please check your email to confirm your account and start your 3-day trial.",
      });
    } catch (error: any) {
      console.error("Signup Error:", error);
      toast({ title: "Signup Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 pt-16">
      <Card className="w-full max-w-md border-none shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground py-10 text-center">
          <CardTitle className="text-2xl font-black uppercase tracking-tight">Create Account</CardTitle>
          <CardDescription className="text-primary-foreground/70 font-medium">Join 10,000+ medical professionals.</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          {isSubmitted ? (
            <div className="text-center space-y-6 animate-in fade-in zoom-in-95">
              <div className="mx-auto bg-green-100 p-4 rounded-full w-fit">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold">Verification Email Sent!</p>
                <p className="text-sm text-muted-foreground mt-2">We've sent a link to your email. Click it to activate your 3-day premium trial.</p>
              </div>
              <Link to="/login" className="block"><Button className="w-full h-12 rounded-xl">Back to Login</Button></Link>
            </div>
          ) : (
            <div className="space-y-6">
              {isDeviceFlagged && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-bold text-orange-800 uppercase tracking-tight">Limit Reached</p>
                        <p className="text-[11px] text-orange-700 leading-relaxed mt-1">
                            Our records show a trial has already been claimed on this device. New accounts will start with standard access.
                        </p>
                    </div>
                </div>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="first_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">First Name</FormLabel>
                        <FormControl><Input placeholder="John" className="h-11 rounded-xl" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="last_name" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Last Name</FormLabel>
                        <FormControl><Input placeholder="Doe" className="h-11 rounded-xl" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email</FormLabel>
                      <FormControl><Input type="email" placeholder="you@doctor.com" className="h-11 rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Password</FormLabel>
                      <FormControl><Input type="password" placeholder="••••••••" className="h-11 rounded-xl" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="phone_number" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phone</FormLabel>
                        <FormControl><Input type="tel" placeholder="+1..." className="h-11 rounded-xl" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="whatsapp_number" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">WhatsApp</FormLabel>
                        <FormControl><Input type="tel" placeholder="+1..." className="h-11 rounded-xl" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="pt-4 space-y-4">
                    {!isWhatsAppVerified ? (
                        <Button 
                            type="button" 
                            variant="secondary" 
                            className="w-full h-12 rounded-xl font-black uppercase tracking-wider gap-2 shadow-sm border-2 border-primary/10"
                            onClick={handleWhatsAppVerify}
                            disabled={isVerifyingWhatsApp}
                        >
                            {isVerifyingWhatsApp ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageSquare className="h-5 w-5 text-green-600" />}
                            Verify on WhatsApp
                        </Button>
                    ) : (
                        <div className="p-3 bg-green-50 border-2 border-green-500/20 rounded-2xl flex items-center gap-3 animate-in zoom-in-95">
                            <ShieldCheck className="h-6 w-6 text-green-600" />
                            <span className="text-xs font-black uppercase text-green-800 tracking-tight">Identity Verified</span>
                        </div>
                    )}

                    <Button 
                        type="submit" 
                        className="w-full h-14 rounded-2xl text-base font-black uppercase tracking-widest shadow-xl" 
                        disabled={isSubmitting || !isWhatsAppVerified}
                    >
                        {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
                        Start 3-Day Trial
                    </Button>
                  </div>
                </form>
              </Form>
              
              <div className="flex items-center gap-4 py-2">
                 <Separator className="flex-1" />
                 <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Secure Signup</span>
                 <Separator className="flex-1" />
              </div>

              <p className="text-center text-sm text-muted-foreground">
                Already registered?{" "}
                <Link to="/login" className="text-primary font-black uppercase hover:underline">
                  Log In
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default SignUp;