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
import { Loader2, CheckCircle2, UserPlus } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

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
  whatsapp_number: z.string().min(10, "WhatsApp number required."),
});

const SignUp = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

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

  const validateDisposableEmail = (email: string) => {
    const domain = email.split('@')[1]?.toLowerCase();
    return !DISPOSABLE_DOMAINS.includes(domain);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!validateDisposableEmail(values.email)) {
        toast({ title: "Invalid Email", description: "Temporary email providers are not allowed.", variant: "destructive" });
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
          },
        },
      });

      if (error) throw error;
      
      setIsSubmitted(true);
      toast({
        title: "Account Created!",
        description: "Please check your email to confirm your account.",
      });
    } catch (error: any) {
      console.error("SignUp Error:", error);
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
                <p className="text-sm text-muted-foreground mt-2">Check your inbox to confirm your account. You can then log in to access your student dashboard.</p>
              </div>
              <Link to="/login" className="block"><Button className="w-full h-12 rounded-xl">Back to Login</Button></Link>
            </div>
          ) : (
            <div className="space-y-6">
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

                  <Button 
                    type="submit" 
                    className="w-full h-14 rounded-2xl text-base font-black uppercase tracking-widest shadow-xl mt-4" 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
                    Create Account
                  </Button>
                </form>
              </Form>
              
              <div className="flex items-center gap-4 py-2">
                 <Separator className="flex-1" />
                 <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Secure Registration</span>
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