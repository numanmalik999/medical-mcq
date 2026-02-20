"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const formSchema = z.object({
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  password: z.string().min(6, "Password must be at least 6 characters long."),
  full_name: z.string().min(3, "Full name is required."),
  phone_number: z.string().min(10, "Phone number required."),
  whatsapp_number: z.string().min(10, "WhatsApp number required."),
  is_whatsapp_same: z.boolean().default(false),
  is_admin: z.boolean().optional(),
});

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

const AddUserDialog = ({ open, onOpenChange, onSave }: AddUserDialogProps) => {
  const { toast } = useToast();
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
      is_admin: false,
    },
  });

  const { watch, setValue } = form;
  const isWhatsappSame = watch('is_whatsapp_same');
  const phoneNumber = watch('phone_number');

  useEffect(() => {
    if (isWhatsappSame) {
      setValue('whatsapp_number', phoneNumber, { shouldValidate: true });
    }
  }, [isWhatsappSame, phoneNumber, setValue]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: values.email,
          password: values.password,
          full_name: values.full_name,
          phone_number: values.phone_number,
          whatsapp_number: values.whatsapp_number,
          is_admin: values.is_admin,
        },
      });

      if (error) throw error;

      toast({ title: "Success!", description: `User ${values.email} registered.` });
      onSave();
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || 'Failed to create user.',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register New Practitioner</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField control={form.control} name="full_name" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex justify-between">Full Name <span className="text-red-500">*</span></FormLabel>
                <FormControl><Input placeholder="Dr. John Doe" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex justify-between">Email <span className="text-red-500">*</span></FormLabel>
                  <FormControl><Input type="email" placeholder="you@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex justify-between">Password <span className="text-red-500">*</span></FormLabel>
                  <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="phone_number" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex justify-between">Phone Number <span className="text-red-500">*</span></FormLabel>
                <FormControl><Input type="tel" placeholder="+971..." {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="whatsapp_number" render={({ field }) => (
              <FormItem>
                <div className="flex justify-between items-end">
                  <FormLabel className="flex gap-1">WhatsApp <span className="text-red-500">*</span></FormLabel>
                  <div className="flex items-center gap-2 pb-1">
                    <Checkbox id="admin-same-phone" checked={isWhatsappSame} onCheckedChange={(c) => setValue('is_whatsapp_same', !!c)} />
                    <Label htmlFor="admin-same-phone" className="text-[10px] font-bold uppercase text-muted-foreground">Same as phone</Label>
                  </div>
                </div>
                <FormControl><Input type="tel" placeholder="+971..." {...field} disabled={isWhatsappSame} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField
              control={form.control}
              name="is_admin"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/20">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Admin Access</FormLabel>
                    <FormDescription>Grant administrative privileges.</FormDescription>
                  </div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddUserDialog;