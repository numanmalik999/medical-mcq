"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Hash } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  title: z.string().min(1, "Title is required."),
  description: z.string().optional().or(z.literal('')),
  youtube_video_id: z.string().min(1, "Video ID is required."),
  platform: z.enum(['vimeo']), // Restricted to vimeo only
  group_id: z.string().optional().or(z.literal('none')),
  subgroup_id: z.string().optional().or(z.literal('none')),
  order: z.preprocess((val) => parseInt(String(val), 10), z.number().min(0)),
});

interface EditVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: any | null;
  onSave: () => void;
}

const EditVideoDialog = ({ open, onOpenChange, video, onSave }: EditVideoDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [subgroups, setSubgroups] = useState<any[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      title: "", 
      description: "", 
      youtube_video_id: "", 
      platform: 'vimeo',
      group_id: 'none',
      subgroup_id: 'none',
      order: 0
    },
  });

  const selectedGroupId = form.watch('group_id');

  useEffect(() => {
    const fetchGroups = async () => {
      const { data } = await supabase.from('video_groups').select('id, name').order('order');
      setGroups(data || []);
    };
    if (open) fetchGroups();
  }, [open]);

  useEffect(() => {
    const fetchSubgroups = async () => {
      if (!selectedGroupId || selectedGroupId === 'none') {
        setSubgroups([]);
        return;
      }
      const { data } = await supabase
        .from('video_subgroups')
        .select('id, name')
        .eq('group_id', selectedGroupId)
        .order('order');
      setSubgroups(data || []);
    };
    fetchSubgroups();
  }, [selectedGroupId]);

  useEffect(() => {
    if (video && open) {
      form.reset({
        title: video.title,
        description: video.description || "",
        youtube_video_id: video.youtube_video_id,
        platform: 'vimeo',
        group_id: video.group_id || 'none',
        subgroup_id: video.subgroup_id || 'none',
        order: video.order || 0
      });
    } else if (!open) {
      form.reset({ title: "", description: "", youtube_video_id: "", platform: 'vimeo', group_id: 'none', subgroup_id: 'none', order: 0 });
    }
  }, [video, open, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const payload = {
        title: values.title,
        description: values.description || null,
        youtube_video_id: values.youtube_video_id,
        platform: 'vimeo',
        group_id: values.group_id === 'none' ? null : values.group_id,
        subgroup_id: values.subgroup_id === 'none' ? null : values.subgroup_id,
        order: values.order
      };

      const { error } = video?.id 
        ? await supabase.from('videos').update(payload).eq('id', video.id)
        : await supabase.from('videos').insert(payload);

      if (error) throw error;
      toast({ title: "Success", description: "Video saved successfully." });
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
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{video ? 'Edit Lesson' : 'Add New Lesson'}</DialogTitle>
          <DialogDescription>
            Configure metadata for this Vimeo lesson.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="bg-muted/30 p-4 rounded-xl border space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Hash className="h-4 w-4" /> Lesson Placement
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="group_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parent Category</FormLabel>
                      <Select onValueChange={(v) => { field.onChange(v); form.setValue('subgroup_id', 'none'); }} value={field.value || 'none'}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Uncategorized" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">Uncategorized</SelectItem>
                          {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="order" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-primary font-bold">Display Number (Order)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="subgroup_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-group (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'none'} disabled={!selectedGroupId || selectedGroupId === 'none'}>
                      <FormControl><SelectTrigger><SelectValue placeholder="No Sub-group" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Sub-group</SelectItem>
                        {subgroups.map(sg => <SelectItem key={sg.id} value={sg.id}>{sg.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormItem>
                  <FormLabel>Platform</FormLabel>
                  <Input value="Vimeo" disabled />
                </FormItem>

                <FormField control={form.control} name="youtube_video_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vimeo ID</FormLabel>
                    <FormControl><Input placeholder="e.g. 123456789" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Lesson Title</FormLabel>
                  <FormControl><Input placeholder="Title as seen by students" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Summary</FormLabel>
                  <FormControl><Textarea placeholder="Quick lesson takeaway..." rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" disabled={isSubmitting} className="w-full h-11 text-lg font-bold">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Lesson"}
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditVideoDialog;