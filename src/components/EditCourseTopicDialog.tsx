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
import { Loader2, Wand2 } from 'lucide-react';
import { useSession } from './SessionContextProvider';

export interface CourseTopic {
  id: string;
  course_id: string;
  title: string;
  content: string | null;
  order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

const formSchema = z.object({
  id: z.string().uuid().optional(),
  course_id: z.string().uuid(),
  title: z.string().min(1, "Topic title is required."),
  content: z.string().optional().or(z.literal('')),
  order: z.preprocess(
    (val) => parseInt(String(val), 10),
    z.number().int().min(0, "Order must be a non-negative number.")
  ),
});

interface EditCourseTopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  topic: CourseTopic | null; // Null for adding, object for editing
  onSave: () => void; // Callback to refresh data after save
}

const EditCourseTopicDialog = ({ open, onOpenChange, courseId, topic, onSave }: EditCourseTopicDialogProps) => {
  const { toast, dismiss } = useToast();
  const { user } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      course_id: courseId,
      title: "",
      content: "",
      order: 0,
    },
  });

  useEffect(() => {
    if (topic && open) {
      form.reset({
        id: topic.id,
        course_id: topic.course_id,
        title: topic.title,
        content: topic.content || "",
        order: topic.order,
      });
    } else if (!open) {
      form.reset({
        course_id: courseId,
        title: "",
        content: "",
        order: 0,
      }); // Reset form when dialog closes, keep courseId
    }
  }, [topic, open, form, courseId]);

  const handleGenerateWithAI = async () => {
    const { title } = form.getValues();

    if (!title) {
      toast({
        title: "Missing Information",
        description: "Please fill in the topic title before generating content with AI.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingAI(true);
    const loadingToastId = toast({
      title: "Generating with AI...",
      description: "Please wait while AI generates the topic content.",
      duration: 999999,
      action: <Loader2 className="h-4 w-4 animate-spin" />,
    });

    try {
      const { data, error } = await supabase.functions.invoke('generate-course-topic-content', {
        body: {
          topic_title: title,
        },
      });

      if (error) {
        throw error;
      }

      form.setValue("content", data.content);
      
      dismiss(loadingToastId.id);
      toast({
        title: "AI Generation Complete!",
        description: "Topic content has been generated. Please review.",
        variant: "default",
      });
    } catch (error: any) {
      dismiss(loadingToastId.id);
      console.error("Error generating with AI:", error);
      toast({
        title: "AI Generation Failed",
        description: `Failed to generate content with AI: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const topicData = {
        course_id: values.course_id,
        title: values.title,
        content: values.content || null,
        order: values.order,
        updated_at: new Date().toISOString(),
      };

      if (topic?.id) {
        // Update existing topic
        const { error } = await supabase
          .from('course_topics')
          .update(topicData)
          .eq('id', topic.id);

        if (error) throw error;
        toast({ title: "Success!", description: "Course topic updated successfully." });
      } else {
        // Add new topic
        const { error } = await supabase
          .from('course_topics')
          .insert({ ...topicData, created_by: user?.id || null });

        if (error) throw error;
        toast({ title: "Success!", description: "Course topic added successfully." });
      }

      onSave(); // Refresh data in parent component
      onOpenChange(false); // Close dialog
    } catch (error: any) {
      console.error("Error saving course topic:", error);
      toast({
        title: "Error",
        description: `Failed to save course topic: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{topic ? 'Edit Topic' : 'Add New Topic'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Introduction to Anatomy, Cardiovascular System" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" placeholder="e.g., 1, 2, 3" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="button"
              onClick={handleGenerateWithAI}
              disabled={isGeneratingAI || isSubmitting || !form.watch('title')}
              className="w-full flex items-center gap-2"
            >
              {isGeneratingAI ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" /> Generate Content with AI
                </>
              )}
            </Button>

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content (JSON format)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Detailed content for the topic (will be populated by AI in JSON format)" rows={15} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancel</Button>
              <Button type="submit" disabled={isSubmitting || isGeneratingAI}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditCourseTopicDialog;