"use client";

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Mail, User, MessageSquare, Send, Loader2, Phone, MapPin } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  subject: z.string().min(5, "Subject must be at least 5 characters."),
  message: z.string().min(10, "Message must be at least 10 characters."),
});

const ContactPage = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  const whatsappNumber = "+923146616970";
  const address = "Muhalla Boarding House Chawinda, Sialkot";
  const supportEmail = "support@example.com"; // Placeholder, assuming admin email is used for sending

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: 'ADMIN_EMAIL', // Target the admin email set in secrets
          subject: `[Contact Form] ${values.subject}`,
          body: `
            <p>New contact form submission:</p>
            <ul>
              <li><strong>Name:</strong> ${values.name}</li>
              <li><strong>Email:</strong> ${values.email}</li>
              <li><strong>Subject:</strong> ${values.subject}</li>
            </ul>
            <hr/>
            <p><strong>Message:</strong></p>
            <p>${values.message.replace(/\n/g, '<br/>')}</p>
          `,
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Message Sent!",
        description: "Thank you for reaching out. We will respond shortly.",
      });
      form.reset();
    } catch (error: any) {
      console.error("Contact Form Submission Error:", error);
      toast({
        title: "Submission Failed",
        description: `Failed to send message: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16 pb-12">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Contact Information Card (Left Column) */}
        <Card className="lg:col-span-1 h-full flex flex-col justify-between bg-primary text-primary-foreground shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl">Get in Touch</CardTitle>
            <CardDescription className="text-primary-foreground/80">
              We are here to answer your questions and provide support.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-4">
              <Mail className="h-6 w-6 flex-shrink-0" />
              <div>
                <p className="font-semibold">Email Support</p>
                <a href={`mailto:${supportEmail}`} className="text-primary-foreground/90 hover:underline">
                  {supportEmail}
                </a>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Phone className="h-6 w-6 flex-shrink-0" />
              <div>
                <p className="font-semibold">WhatsApp / Phone</p>
                <a 
                  href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary-foreground/90 hover:underline"
                >
                  {whatsappNumber}
                </a>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <MapPin className="h-6 w-6 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold">Address</p>
                <p className="text-primary-foreground/90">{address}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Form Card (Right Column) */}
        <Card className="lg:col-span-2 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Send Us a Message</CardTitle>
            <CardDescription>Fill out the form below and we will get back to you as soon as possible.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2"><User className="h-4 w-4" /> Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Full Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Subject</FormLabel>
                      <FormControl>
                        <Input placeholder="Briefly describe your inquiry" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Message</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Your detailed message..." rows={6} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" /> Send Message
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default ContactPage;