"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Wand2, ExternalLink, Search, AlertCircle } from 'lucide-react';

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
  const [suggestedSearchQuery, setSuggestedSearchQuery] = useState('');

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
      setSuggestedSearchQuery('');
    }
  }, [video, open, form]);

  const handleAiGenerate = async () => {
    if (!searchTopic.trim()) {
      toast({ title: "Topic Required", description: "Please enter a topic for the AI to search.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setSuggestedSearchQuery('');
    try {
      const { data, error } = await supabase.functions.invoke('ai-find-video', {
        body: { topic: searchTopic },
      });

      if (error) throw error;

      form.setValue('title', data.title);
      form.setValue('description', data.description);
      setSuggestedSearchQuery(data.search_query);
      
      if (data.youtube_video_id) {
        form.setValue('youtube_video_id', data.youtube_video_id);
        toast({ title: "Video Found!", description: "Verify the ID using the preview below." });
      } else {
        form.setValue('youtube_video_id', '');
        toast({ title: "Query Generated", description: "AI found the best match. Use the search button to get the ID." });
      }
      
    } catch (error: any) {
      toast({ title: "AI Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualSearch = () => {
    const query = suggestedSearchQuery || searchTopic || form.getValues('title');
    if (query) {
      window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
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
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{video ? 'Edit Video' : 'Add New Video'}</DialogTitle>
          <DialogDescription>1. Search topic with AI. 2. Verify/Find ID on YouTube. 3. Save.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="flex flex-col gap-3 p-4 bg-muted/30 rounded-lg border">
            <div className="flex gap-2">
              <Input 
                placeholder="Topic (e.g., 'Ninja Nerd COPD')" 
                value={searchTopic} 
                onChange={(e) => setSearchTopic(e.target.value)} 
              />
              <Button onClick={handleAiGenerate} disabled={isGenerating} variant="secondary">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                AI Fetch
              </Button>
            </div>
            
            {suggestedSearchQuery && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Verification Helper:</p>
                <Button onClick={handleManualSearch} variant="outline" size="sm" className="w-full text-blue-600 border-blue-200 hover:bg-blue-50">
                  <Search className="h-4 w-4 mr-2" /> Find on YouTube: "{suggestedSearchQuery}"
                </Button>
              </div>
            )}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Video Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              <FormField control={form.control} name="youtube_video_id" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    YouTube Video ID (11 chars)
                    {field.value?.length === 11 && (
                      <a href={`https://youtube.com/watch?v=${field.value}`} target="_blank" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                        (Check Link <ExternalLink className="h-3 w-3" />)
                      </a>
                    )}
                  </FormLabel>
                  <FormControl><Input placeholder="e.g. dQw4w9WgXcQ" {...field} /></FormControl>
                  <FormDescription className="text-xs">Copy the characters after <strong>v=</strong> in the YouTube URL.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Short Description</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              
              {form.watch('youtube_video_id')?.length === 11 ? (
                <div className="aspect-video rounded-md overflow-hidden border bg-black shadow-inner">
                   <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${form.watch('youtube_video_id')}`} frameBorder="0" allowFullScreen></iframe>
                </div>
              ) : (
                <div className="aspect-video rounded-md flex items-center justify-center bg-muted/50 border border-dashed">
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Enter a valid ID to see preview</p>
                </div>
              )}

              <DialogFooter className="pt-4 border-t mt-4">
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {video ? "Update Video" : "Save to Library"}
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