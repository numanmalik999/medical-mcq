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
import { Loader2, Wand2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  title: z.string().min(1, "Title is required."),
  description: z.string().optional().or(z.literal('')), // Now optional
  youtube_video_id: z.string().min(1, "Video ID is required."),
  platform: z.enum(['youtube', 'vimeo', 'dailymotion']),
  group_id: z.string().optional().or(z.literal('none')),
  subgroup_id: z.string().optional().or(z.literal('none')),
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [subgroups, setSubgroups] = useState<any[]>([]);
  const [topic, setTopic] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      title: "", 
      description: "", 
      youtube_video_id: "", 
      platform: 'youtube',
      group_id: 'none',
      subgroup_id: 'none'
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
        platform: video.platform || 'youtube',
        group_id: video.group_id || 'none',
        subgroup_id: video.subgroup_id || 'none'
      });
    } else if (!open) {
      form.reset({ title: "", description: "", youtube_video_id: "", platform: 'youtube', group_id: 'none', subgroup_id: 'none' });
      setTopic('');
    }
  }, [video, open, form]);

  const handleAiSearch = async () => {
    const currentId = form.getValues('youtube_video_id');
    const query = topic.trim() || currentId;

    if (!query) {
      toast({ title: "Input Required", description: "Enter a search topic or Video ID.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-find-video', {
        body: { topic: query },
      });

      if (error) throw error;
      form.setValue('title', data.title);
      form.setValue('description', data.description || "");
      if (data.youtube_video_id && !currentId) {
        form.setValue('youtube_video_id', data.youtube_video_id);
      }
      toast({ title: "Data Fetched" });
    } catch (error: any) {
      toast({ title: "Fetch Error", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const payload = {
        title: values.title,
        description: values.description || null,
        youtube_video_id: values.youtube_video_id,
        platform: values.platform,
        group_id: values.group_id === 'none' ? null : values.group_id,
        subgroup_id: values.subgroup_id === 'none' ? null : values.subgroup_id
      };

      const { error } = video?.id 
        ? await supabase.from('videos').update(payload).eq('id', video.id)
        : await supabase.from('videos').insert(payload);

      if (error) throw error;
      toast({ title: "Success", description: "Video saved." });
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{video ? 'Edit Video' : 'Add Video'}</DialogTitle>
          <DialogDescription>Use the AI Fetch tool to quickly fill in details.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          <div className="flex gap-2 p-3 bg-muted rounded-md border">
            <Input placeholder="Search topic for details..." value={topic} onChange={(e) => setTopic(e.target.value)} />
            <Button onClick={handleAiSearch} disabled={isGenerating} size="sm" type="button" variant="outline">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
              Fetch Info
            </Button>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="group_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Main Group</FormLabel>
                    <Select onValueChange={(v) => { field.onChange(v); form.setValue('subgroup_id', 'none'); }} value={field.value || 'none'}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Uncategorized" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">Uncategorized</SelectItem>
                        {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="subgroup_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-group</FormLabel>
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

              <FormField control={form.control} name="youtube_video_id" render={({ field }) => (
                <FormItem><FormLabel>Video ID</FormLabel><FormControl><Input placeholder="e.g. dQw4w9WgXcQ" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Video Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Video"}
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditVideoDialog;