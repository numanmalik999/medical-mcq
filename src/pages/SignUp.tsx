"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, UserPlus } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

const DISPOSABLE_DOMAINS = [
  'temp-mail.org', 'tempmail.com', 'guerrillamail.com', '10minutemail.com', 
  'mailinator.com', 'yopmail.com', 'dispostable.com', 'trashmail.com', 
  'temp-mail.net', 'minuteinbox.com', 'getnada.com'
];

const formSchema = z.object({
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  full_name: z.string().min(3, "Full name is required (min 3 characters)."),
  phone_number: z.string().min(10, "Valid phone number required (min 10 digits)."),
  whatsapp_number: z.string().min(10, "WhatsApp number required (min 10 digits)."),
  is_whatsapp_same: z.boolean().default(false),
});

const SignUp = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      full_name: "",
      phone_number: "",
      whatsapp_number: "",
      is_whatsapp_same: false,
    },
  });

  const { watch, setValue } = form;
  const isWhatsappSame = watch('is_whatsapp_same');
  const phoneNumber = watch('phone_number');

  // Sync WhatsApp with Phone if the toggle is active
  useEffect(() => {
    if (isWhatsappSame && phoneNumber) {
      setValue('whatsapp_number', phoneNumber, { shouldValidate: true });
    }
  }, [isWhatsappSame, phoneNumber, setValue]);

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
      const nameParts = values.full_name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            phone_number: values.phone_number,
            whatsapp_number: values.whatsapp_number,
          },
        },
      });

      if (error) throw error;
      
      toast({
        title: "Account Created!",
        description: "Your account has been created successfully. Welcome to Study Prometric!",
      });

      navigate('/redirect');
      
    } catch (error: any) {
      console.error("SignUp Error:", error);
      toast({ title: "Signup Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const redirectToUrl = `${window.location.origin}/redirect`;

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md border-none shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground py-10 text-center">
          <CardTitle className="text-2xl font-black uppercase tracking-tight">Create Account</CardTitle>
          <CardDescription className="text-primary-foreground/70 font-medium">Start your medical exam preparation today.</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <div className="space-y-6">
            <Auth
              supabaseClient={supabase}
              providers={['google']}
              onlyThirdPartyProviders
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
              redirectTo={redirectToUrl}
            />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground font-bold">Or continue with email</span>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="full_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex justify-between">
                      Full Name <span className="text-red-500 font-black">*</span>
                    </FormLabel>
                    <FormControl><Input placeholder="Dr. John Doe" className="h-11 rounded-xl" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex justify-between">
                      Email <span className="text-red-500 font-black">*</span>
                    </FormLabel>
                    <FormControl><Input type="email" placeholder="you@doctor.com" className="h-11 rounded-xl" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex justify-between">
                      Password <span className="text-red-500 font-black">*</span>
                    </FormLabel>
                    <FormControl><Input type="password" placeholder="••••••••" className="h-11 rounded-xl" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="phone_number" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex justify-between">
                      Phone Number <span className="text-red-500 font-black">*</span>
                    </FormLabel>
                    <FormControl><Input type="tel" placeholder="+971..." className="h-11 rounded-xl" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="space-y-3">
                  <FormField control={form.control} name="whatsapp_number" render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between items-end">
                        <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex gap-1">
                          WhatsApp Number <span className="text-red-500 font-black">*</span>
                        </FormLabel>
                        <div className="flex items-center gap-2 pb-1 group">
                           <Checkbox 
                             id="same-phone" 
                             checked={isWhatsappSame} 
                             onCheckedChange={(checked) => setValue('is_whatsapp_same', !!checked)}
                             className="rounded-sm border-muted-foreground/30 h-3.5 w-3.5"
                           />
                           <Label htmlFor="same-phone" className="text-[10px] font-bold uppercase text-muted-foreground cursor-pointer group-hover:text-primary transition-colors">Same as phone</Label>
                        </div>
                      </div>
                      <FormControl>
                        <Input 
                          type="tel" 
                          placeholder="+971..." 
                          className="h-11 rounded-xl" 
                          {...field} 
                          disabled={isWhatsappSame}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-14 rounded-2xl text-base font-black uppercase tracking-widest shadow-xl mt-4" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
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
        </CardContent>
      </Card>
    </div>
  );
};

export default SignUp;