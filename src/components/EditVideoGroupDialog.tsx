"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';

export interface VideoGroup {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  order: number;
}

const formSchema = z.object({
  name: z.string().min(1, "Group name is required."),
  description: z.string().optional().or(z.literal('')),
  image_url: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  order: z.preprocess((val) => parseInt(String(val), 10), z.number().min(0)),
});

interface EditVideoGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: VideoGroup | null;
  onSave: () => void;
}

const EditVideoGroupDialog = ({ open, onOpenChange, group, onSave }: EditVideoGroupDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "", image_url: "", order: 0 },
  });

  useEffect(() => {
    if (group && open) {
      form.reset({
        name: group.name,
        description: group.description || "",
        image_url: group.image_url || "",
        order: group.order,
      });
    } else if (!open) {
      form.reset({ name: "", description: "", image_url: "", order: 0 });
    }
  }, [group, open, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...values,
        description: values.description || null,
        image_url: values.image_url || null,
      };

      const { error } = group?.id 
        ? await supabase.from('video_groups').update(payload).eq('id', group.id)
        : await supabase.from('video_groups').insert(payload);

      if (error) throw error;
      toast({ title: "Success", description: "Video group saved." });
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{group ? 'Edit Group' : 'Add New Group'}</DialogTitle>
          <DialogDescription>Create a high-level category for your video lessons.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Group Name</FormLabel><FormControl><Input placeholder="e.g., Cardiology Basics" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            
            <FormField control={form.control} name="image_url" render={({ field }) => (
              <FormItem>
                <FormLabel>Cover Image URL</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <Input placeholder="https://images.unsplash.com/..." {...field} />
                  </div>
                </FormControl>
                <FormDescription>Visual thumbnail for this specialty.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Short summary of this group..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <FormField control={form.control} name="order" render={({ field }) => (
              <FormItem><FormLabel>Display Order</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Group
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditVideoGroupDialog;