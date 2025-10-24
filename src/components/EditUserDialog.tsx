"use client";

import { useState, useEffect, useCallback } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, CalendarIcon, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email: string | null;
  is_admin: boolean;
  phone_number: string | null;
  whatsapp_number: string | null;
  has_active_subscription: boolean;
  // NEW FIELDS
  subscription_status: string | null;
  subscription_end_date: string | null;
}

const formSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string().optional().or(z.literal('')),
  last_name: z.string().optional().or(z.literal('')),
  avatar_url: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  is_admin: z.boolean(),
  phone_number: z.string().optional().or(z.literal('')),
  whatsapp_number: z.string().optional().or(z.literal('')),
  has_active_subscription: z.boolean(),
  // NEW FIELD for admin control
  subscriptionEndDate: z.date().nullable().optional(),
});

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userProfile: UserProfile;
  onSave: () => void; // Callback to refresh data after save
}

const EditUserDialog = ({ open, onOpenChange, userProfile, onSave }: EditUserDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: userProfile.id,
      first_name: userProfile.first_name || "",
      last_name: userProfile.last_name || "",
      avatar_url: userProfile.avatar_url || "",
      is_admin: userProfile.is_admin,
      phone_number: userProfile.phone_number || "",
      whatsapp_number: userProfile.whatsapp_number || "",
      has_active_subscription: userProfile.has_active_subscription,
      subscriptionEndDate: userProfile.subscription_end_date ? parseISO(userProfile.subscription_end_date) : null,
    },
  });

  const fetchSubscriptionData = useCallback(async () => {
    // Fetch the ID and end date of the current active subscription for this user
    let currentEndDate: string | null = null;
    let isActive = userProfile.has_active_subscription; // Start with profile's status

    const { data: subData, error: subError } = await supabase
      .from('user_subscriptions')
      .select('end_date, status')
      .eq('user_id', userProfile.id)
      .order('end_date', { ascending: false })
      .limit(1)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('Error fetching active subscription ID:', subError);
    } else if (subData) {
      currentEndDate = subData.end_date;
      isActive = subData.status === 'active';
    }
    
    // Reset form values based on the latest fetched data
    form.reset({
      id: userProfile.id,
      first_name: userProfile.first_name || "",
      last_name: userProfile.last_name || "",
      avatar_url: userProfile.avatar_url || "",
      is_admin: userProfile.is_admin,
      phone_number: userProfile.phone_number || "",
      whatsapp_number: userProfile.whatsapp_number || "",
      has_active_subscription: isActive, // Use fetched sub status as source of truth
      subscriptionEndDate: currentEndDate ? parseISO(currentEndDate) : null,
    });
  }, [userProfile, form]);

  useEffect(() => {
    if (open) {
      fetchSubscriptionData();
    }
  }, [open, fetchSubscriptionData]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const payload = {
        id: values.id,
        first_name: values.first_name || null,
        last_name: values.last_name || null,
        avatar_url: values.avatar_url || null,
        is_admin: values.is_admin,
        phone_number: values.phone_number || null,
        whatsapp_number: values.whatsapp_number || null,
        has_active_subscription: values.has_active_subscription,
        subscriptionEndDate: values.subscriptionEndDate?.toISOString() || null,
      };

      // Call the secure Edge Function to handle all updates
      const { error } = await supabase.functions.invoke('admin-update-user-profile', {
        body: payload,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success!",
        description: "User profile and subscription status updated successfully.",
      });
      
      setTimeout(() => {
        onSave(); // Refresh data in parent component
      }, 500);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating user profile:", error);
      toast({
        title: "Error",
        description: `Failed to update user profile: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const subscriptionEndDate = form.watch('subscriptionEndDate');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User: {userProfile.email}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={form.watch('avatar_url') || undefined} alt="User Avatar" />
                <AvatarFallback>
                  <UserIcon className="h-12 w-12 text-gray-500" />
                </AvatarFallback>
              </Avatar>
            </div>

            <FormField
              control={form.control}
              name="avatar_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Avatar URL</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., https://example.com/avatar.jpg" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="First Name" {...field} />
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
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Last Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormItem>
              <FormLabel>Email</FormLabel>
              <Input value={userProfile.email || 'N/A'} disabled />
              <p className="text-sm text-muted-foreground">Email cannot be changed here.</p>
            </FormItem>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="e.g., +1234567890" {...field} />
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
                    <FormLabel>WhatsApp Number</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="e.g., +1234567890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="is_admin"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Admin Access</FormLabel>
                    <FormDescription>
                      Grant or revoke administrator privileges for this user.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Toggle admin status"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="has_active_subscription"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Subscription</FormLabel>
                    <FormDescription>
                      Toggle this user's active subscription status.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Toggle active subscription status"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch('has_active_subscription') && (
              <FormField
                control={form.control}
                name="subscriptionEndDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Subscription End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Set end date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      {subscriptionEndDate && `Days remaining: ${differenceInDays(subscriptionEndDate, new Date())}`}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserDialog;