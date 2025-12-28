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
import { Loader2, Wand2, Youtube, ExternalLink } from 'lucide-react';

const formSchema = z.object({
  title: z.string().min(1, "Title is required."),
  description: z.string().min(1, "Description is required."),
  youtube_video_id: z.string().min(11, "Must be 11 characters.").max(11, "Must be 11 characters."),
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
  const [topic, setTopic] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", youtube_video_id: "" },
  });

  useEffect(() => {
    if (video && open) {
      form.reset({
        title: video.title,
        description: video.description || "",
        youtube_video_id: video.youtube_video_id,
      });
    } else if (!open) {
      form.reset({ title: "", description: "", youtube_video_id: "" });
      setTopic('');
    }
  }, [video, open, form]);

  const handleAiSearch = async () => {
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
      const { error } = video?.id 
        ? await supabase.from('videos').update(values).eq('id', video.id)
        : await supabase.from('videos').insert(values);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{video ? 'Edit Video' : 'Add Video'}</DialogTitle>
          <DialogDescription>Quickly find and add educational videos.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-2">
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

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Video Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <FormField control={form.control} name="youtube_video_id" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex justify-between">
                    <span>YouTube ID (11 chars)</span>
                    {field.value?.length === 11 && (
                      <a href={`https://youtube.com/watch?v=${field.value}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 flex items-center gap-1">
                        Open <ExternalLink className="h-3 w-3" />
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
              
              {currentId?.length === 11 ? (
                <div className="aspect-video rounded border overflow-hidden bg-black">
                   <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${currentId}`} frameBorder="0" allowFullScreen></iframe>
                </div>
              ) : (
                <div className="aspect-video rounded border border-dashed flex items-center justify-center bg-muted/30 text-muted-foreground text-sm">
                  Video preview will appear here
                </div>
              )}

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Youtube className="mr-2 h-4 w-4" />}
                {video ? "Update Video" : "Add to Library"}
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditVideoDialog;