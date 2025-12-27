"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Wand2, AlertTriangle } from 'lucide-react';

const formSchema = z.object({
  title: z.string().min(1, "Title is required."),
  description: z.string().min(1, "Description is required."),
  youtube_video_id: z.string().min(11, "Valid YouTube ID is required.").max(11),
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
  const [searchTopic, setSearchTopic] = useState('');
  const [aiFailedToFindId, setAiFailedToFindId] = useState(false);

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
      setSearchTopic('');
      setAiFailedToFindId(false);
    }
  }, [video, open, form]);

  const handleAiGenerate = async () => {
    if (!searchTopic.trim()) {
      toast({ title: "Topic Required", description: "Please enter a topic for the AI to search.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setAiFailedToFindId(false);
    try {
      const { data, error } = await supabase.functions.invoke('ai-find-video', {
        body: { topic: searchTopic },
      });

      if (error) throw error;

      form.setValue('title', data.title);
      form.setValue('description', data.description);
      
      if (data.youtube_video_id) {
        form.setValue('youtube_video_id', data.youtube_video_id);
        toast({ title: "Video Found!", description: "AI has populated the video details." });
      } else {
        setAiFailedToFindId(true);
        form.setValue('youtube_video_id', '');
        toast({ title: "ID Not Found", description: "AI found a topic but couldn't verify a specific video ID. Please enter it manually.", variant: "default" });
      }
      
    } catch (error: any) {
      toast({ title: "AI Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      if (video?.id) {
        const { error } = await supabase.from('videos').update(values).eq('id', video.id);
        if (error) throw error;
        toast({ title: "Success", description: "Video updated." });
      } else {
        const { error } = await supabase.from('videos').insert(values);
        if (error) throw error;
        toast({ title: "Success", description: "Video added." });
      }
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
          <DialogTitle>{video ? 'Edit Video' : 'Add New Video'}</DialogTitle>
          <DialogDescription>Use the AI search or enter details manually.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Input 
              placeholder="Search topic with AI..." 
              value={searchTopic} 
              onChange={(e) => setSearchTopic(e.target.value)} 
            />
            <Button onClick={handleAiGenerate} disabled={isGenerating} variant="secondary">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
              AI Find
            </Button>
          </div>

          {aiFailedToFindId && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md flex gap-2 text-sm text-yellow-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p>The AI found information on this topic but couldn't recall a verified YouTube ID. Please paste a valid 11-character ID below.</p>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="youtube_video_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>YouTube Video ID</FormLabel>
                  <FormControl><Input placeholder="11 character ID (e.g., dQw4w9WgXcQ)" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              {form.watch('youtube_video_id')?.length === 11 && (
                <div className="aspect-video rounded-md overflow-hidden border bg-black">
                   <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${form.watch('youtube_video_id')}`} frameBorder="0" allowFullScreen></iframe>
                </div>
              )}

              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Video"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditVideoDialog;