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
import { useSession } from './SessionContextProvider';

export interface Course {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

const formSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, "Course title is required."),
  description: z.string().optional().or(z.literal('')),
});

interface EditCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course | null; // Null for adding, object for editing
  onSave: () => void; // Callback to refresh data after save
}

const EditCourseDialog = ({ open, onOpenChange, course, onSave }: EditCourseDialogProps) => {
  const { toast } = useToast();
  const { user } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  useEffect(() => {
    if (course && open) {
      form.reset({
        id: course.id,
        title: course.title,
        description: course.description || "",
      });
    } else if (!open) {
      form.reset(); // Reset form when dialog closes
    }
  }, [course, open, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const courseData = {
        title: values.title,
        description: values.description || null,
        updated_at: new Date().toISOString(),
      };

      if (course?.id) {
        // Update existing course
        const { error } = await supabase
          .from('courses')
          .update(courseData)
          .eq('id', course.id);

        if (error) throw error;
        toast({ title: "Success!", description: "Course updated successfully." });
      } else {
        // Add new course
        const { error } = await supabase
          .from('courses')
          .insert({ ...courseData, created_by: user?.id || null });

        if (error) throw error;
        toast({ title: "Success!", description: "Course added successfully." });
      }

      onSave(); // Refresh data in parent component
      onOpenChange(false); // Close dialog
    } catch (error: any) {
      console.error("Error saving course:", error);
      toast({
        title: "Error",
        description: `Failed to save course: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{course ? 'Edit Course' : 'Add New Course'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Course Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Anatomy Basics, Clinical Skills" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Brief description of the course" rows={5} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditCourseDialog;