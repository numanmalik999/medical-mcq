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
import { Loader2 } from 'lucide-react';

export interface VideoGroup {
  id: string;
  name: string;
  description: string | null;
  order: number;
}

const formSchema = z.object({
  name: z.string().min(1, "Group name is required."),
  description: z.string().optional().or(z.literal('')),
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
    defaultValues: { name: "", description: "", order: 0 },
  });

  useEffect(() => {
    if (group && open) {
      form.reset({
        name: group.name,
        description: group.description || "",
        order: group.order,
      });
    } else if (!open) {
      form.reset({ name: "", description: "", order: 0 });
    }
  }, [group, open, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const { error } = group?.id 
        ? await supabase.from('video_groups').update(values).eq('id', group.id)
        : await supabase.from('video_groups').insert(values);

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{group ? 'Edit Group' : 'Add New Group'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Group Name</FormLabel><FormControl><Input placeholder="e.g., Cardiology Basics" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="order" render={({ field }) => (
              <FormItem><FormLabel>Display Order</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Group"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditVideoGroupDialog;