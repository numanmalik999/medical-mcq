"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration_in_months: number;
  description: string | null;
  features: string[] | null; // Stored as JSONB in DB, handled as string[] here
  stripe_price_id: string | null; // Updated field
}

const formSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Tier name is required."),
  price: z.preprocess(
    (val) => parseFloat(String(val)),
    z.number().min(0.01, "Price must be a positive number.")
  ),
  currency: z.string().min(1, "Currency is required."),
  duration_in_months: z.preprocess(
    (val) => parseInt(String(val), 10),
    z.number().int().min(1, "Duration must be at least 1 month.")
  ),
  description: z.string().optional().or(z.literal('')),
  features: z.string().optional().or(z.literal('')), // Comma-separated string for input
  stripe_price_id: z.string().optional().or(z.literal('')), // New field
});

interface EditSubscriptionTierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: SubscriptionTier | null; // Null for adding, object for editing
  onSave: () => void; // Callback to refresh data after save
}

const EditSubscriptionTierDialog = ({ open, onOpenChange, tier, onSave }: EditSubscriptionTierDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      price: 0,
      currency: "USD",
      duration_in_months: 1,
      description: "",
      features: "",
      stripe_price_id: "", // Default value for new field
    },
  });

  useEffect(() => {
    if (tier && open) {
      form.reset({
        id: tier.id,
        name: tier.name,
        price: tier.price,
        currency: tier.currency,
        duration_in_months: tier.duration_in_months,
        description: tier.description || "",
        features: tier.features ? tier.features.join(', ') : "", // Convert array to comma-separated string
        stripe_price_id: tier.stripe_price_id || "", // Set new field value
      });
    } else if (!open) {
      form.reset(); // Reset form when dialog closes
    }
  }, [tier, open, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const featuresArray = values.features
        ? values.features.split(',').map(f => f.trim()).filter(f => f.length > 0)
        : null;

      const tierData = {
        name: values.name,
        price: values.price,
        currency: values.currency,
        duration_in_months: values.duration_in_months,
        description: values.description || null,
        features: featuresArray,
        stripe_price_id: values.stripe_price_id || null, // Include new field
      };

      if (tier?.id) {
        // Update existing tier
        const { error } = await supabase
          .from('subscription_tiers')
          .update(tierData)
          .eq('id', tier.id);

        if (error) throw error;
        toast({ title: "Success!", description: "Subscription tier updated successfully." });
      } else {
        // Add new tier
        const { error } = await supabase
          .from('subscription_tiers')
          .insert(tierData);

        if (error) throw error;
        toast({ title: "Success!", description: "Subscription tier added successfully." });
      }

      onSave(); // Refresh data in parent component
      onOpenChange(false); // Close dialog
    } catch (error: any) {
      console.error("Error saving subscription tier:", error);
      toast({
        title: "Error",
        description: `Failed to save subscription tier: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tier ? 'Edit Subscription Tier' : 'Add New Subscription Tier'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tier Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Monthly Basic, Yearly Premium" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="e.g., 9.99" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="duration_in_months"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (in months)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" placeholder="e.g., 1 for monthly, 12 for yearly" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stripe_price_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stripe Price ID (Required for payment)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., price_xxxxxxxxxxxxxx" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Brief description of the tier" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="features"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Features (Comma-separated, Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Ad-free, Offline access, HD streaming" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditSubscriptionTierDialog;