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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  group_id: z.string().min(1, "Main group is required."),
  name: z.string().min(1, "Sub-group name is required."),
  description: z.string().optional().or(z.literal('')),
  order: z.preprocess((val) => parseInt(String(val), 10), z.number().min(0)),
});

interface EditVideoSubgroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subgroup: any | null;
  onSave: () => void;
}

const EditVideoSubgroupDialog = ({ open, onOpenChange, subgroup, onSave }: EditVideoSubgroupDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { group_id: "", name: "", description: "", order: 0 },
  });

  useEffect(() => {
    const fetchGroups = async () => {
      const { data } = await supabase.from('video_groups').select('id, name').order('order');
      setGroups(data || []);
    };
    if (open) fetchGroups();
  }, [open]);

  useEffect(() => {
    if (subgroup && open) {
      form.reset({
        group_id: subgroup.group_id,
        name: subgroup.name,
        description: subgroup.description || "",
        order: subgroup.order,
      });
    } else if (!open) {
      form.reset({ group_id: "", name: "", description: "", order: 0 });
    }
  }, [subgroup, open, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const { error } = subgroup?.id 
        ? await supabase.from('video_subgroups').update(values).eq('id', subgroup.id)
        : await supabase.from('video_subgroups').insert(values);

      if (error) throw error;
      toast({ title: "Success", description: "Sub-group saved." });
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
          <DialogTitle>{subgroup ? 'Edit Sub-group' : 'Add New Sub-group'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="group_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Parent Group</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select a group" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Sub-group Name</FormLabel><FormControl><Input placeholder="e.g., Heart Failure" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="order" render={({ field }) => (
              <FormItem><FormLabel>Display Order</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Sub-group"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditVideoSubgroupDialog;