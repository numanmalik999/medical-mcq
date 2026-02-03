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
import { Loader2, Wand2, ExternalLink } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  title: z.string().min(1, "Title is required."),
  description: z.string().min(1, "Description is required."),
  youtube_video_id: z.string().min(1, "Video ID is required."),
  platform: z.enum(['youtube', 'vimeo', 'dailymotion']),
  group_id: z.string().optional().or(z.literal('none')),
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
  const [topic, setTopic] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
      title: "", 
      description: "", 
      youtube_video_id: "", 
      platform: 'youtube',
      group_id: 'none'
    },
  });

  useEffect(() => {
    const fetchGroups = async () => {
      const { data } = await supabase.from('video_groups').select('id, name').order('order');
      setGroups(data || []);
    };
    if (open) fetchGroups();
  }, [open]);

  useEffect(() => {
    if (video && open) {
      form.reset({
        title: video.title,
        description: video.description || "",
        youtube_video_id: video.youtube_video_id,
        platform: video.platform || 'youtube',
        group_id: video.group_id || 'none'
      });
    } else if (!open) {
      form.reset({ title: "", description: "", youtube_video_id: "", platform: 'youtube', group_id: 'none' });
      setTopic('');
    }
  }, [video, open, form]);

  const handleAiSearch = async () => {
    if (form.getValues('platform') !== 'youtube') {
      toast({ title: "YouTube Only", description: "AI Search currently only supports YouTube content." });
      return;
    }
    if (!topic.trim()) {
      toast({ title: "Topic Required", description: "What should I search for?", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-find-video', {
        body: { topic },
      });

      if (error) throw error;
      if (!data) throw new Error("No response from search service.");

      form.setValue('title', data.title);
      form.setValue('description', data.description);
      
      if (data.youtube_video_id) {
        form.setValue('youtube_video_id', data.youtube_video_id);
        toast({ title: "Match Found", description: "Video details updated." });
      } else {
        toast({ title: "Topic Found", description: "Details added. Please paste the Video ID manually." });
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(data.search_query)}`, '_blank');
      }
      
    } catch (error: any) {
      toast({ title: "Search Error", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const payload = {
        title: values.title,
        description: values.description,
        youtube_video_id: values.youtube_video_id,
        platform: values.platform,
        group_id: values.group_id === 'none' ? null : values.group_id
      };

      const { error } = video?.id 
        ? await supabase.from('videos').update(payload).eq('id', video.id)
        : await supabase.from('videos').insert(payload);

      if (error) throw error;
      toast({ title: "Success", description: "Video library updated." });
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentId = form.watch('youtube_video_id');
  const platform = form.watch('platform');

  const getEmbedUrl = () => {
    if (!currentId) return null;
    if (platform === 'youtube') return `https://www.youtube.com/embed/${currentId}`;
    if (platform === 'vimeo') return `https://player.vimeo.com/video/${currentId}`;
    if (platform === 'dailymotion') return `https://www.dailymotion.com/embed/video/${currentId}`;
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{video ? 'Edit Video' : 'Add Video'}</DialogTitle>
          <DialogDescription>Add educational content from YouTube, Vimeo, or Dailymotion.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {platform === 'youtube' && (
            <div className="flex gap-2 p-3 bg-muted rounded-md border">
              <Input 
                placeholder="Search topic (e.g. 'Ninja Nerd MI')" 
                value={topic} 
                onChange={(e) => setTopic(e.target.value)} 
              />
              <Button onClick={handleAiSearch} disabled={isGenerating} size="sm" type="button">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                AI Find
              </Button>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="platform" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video Platform</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="youtube">YouTube</SelectItem>
                        <SelectItem value="vimeo">Vimeo</SelectItem>
                        <SelectItem value="dailymotion">Dailymotion</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="group_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Video Group</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'none'}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Uncategorized" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">Uncategorized</SelectItem>
                        {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Video Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <FormField control={form.control} name="youtube_video_id" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex justify-between">
                    <span>{platform.charAt(0).toUpperCase() + platform.slice(1)} Video ID</span>
                    {field.value && platform === 'youtube' && (
                      <a href={`https://youtube.com/watch?v=${field.value}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 flex items-center gap-1">
                        Verify <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </FormLabel>
                  <FormControl><Input placeholder="e.g. dQw4w9WgXcQ" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              {currentId ? (
                <div className="aspect-video rounded border overflow-hidden bg-black">
                   <iframe width="100%" height="100%" src={getEmbedUrl() || ''} frameBorder="0" allowFullScreen></iframe>
                </div>
              ) : (
                <div className="aspect-video rounded border border-dashed flex items-center justify-center bg-muted/30 text-muted-foreground text-sm">
                  Video preview will appear here
                </div>
              )}

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save to Library"}
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditVideoDialog;