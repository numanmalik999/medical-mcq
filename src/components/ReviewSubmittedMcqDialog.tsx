"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { UserSubmittedMcq } from '@/pages/ManageSubmittedMcqsPage'; // Import the interface

interface Category {
  id: string;
  name: string;
}

const formSchema = z.object({
  id: z.string().uuid(),
  question_text: z.string().min(1, "Question text is required."),
  option_a: z.string().min(1, "Option A is required."),
  option_b: z.string().min(1, "Option B is required."),
  option_c: z.string().min(1, "Option C is required."),
  option_d: z.string().min(1, "Option D is required."),
  correct_answer: z.enum(['A', 'B', 'C', 'D'], { message: "Correct answer is required." }),
  explanation_text: z.string().min(1, "Explanation text is required."),
  image_url: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  suggested_category_name: z.string().optional().or(z.literal('')),
  suggested_difficulty: z.string().optional().or(z.literal('')),
  admin_notes: z.string().optional().or(z.literal('')),
  is_trial_mcq: z.boolean().optional(), // For when it's approved and added to main MCQs
});

interface ReviewSubmittedMcqDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submittedMcq: UserSubmittedMcq;
  onSave: () => void; // Callback to refresh data after save
}

const ReviewSubmittedMcqDialog = ({ open, onOpenChange, submittedMcq, onSave }: ReviewSubmittedMcqDialogProps) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      id: submittedMcq.id,
      question_text: submittedMcq.question_text,
      option_a: submittedMcq.option_a,
      option_b: submittedMcq.option_b,
      option_c: submittedMcq.option_c,
      option_d: submittedMcq.option_d,
      correct_answer: submittedMcq.correct_answer,
      explanation_text: submittedMcq.explanation_text,
      image_url: submittedMcq.image_url || "",
      suggested_category_name: submittedMcq.suggested_category_name || "",
      suggested_difficulty: submittedMcq.suggested_difficulty || "",
      admin_notes: submittedMcq.admin_notes || "",
      is_trial_mcq: false, // Reset to default for review
    },
  });

  useEffect(() => {
    const fetchCategories = async () => {
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name'); // Select all required fields
      if (categoriesError) {
        console.error('Error fetching categories:', categoriesError);
        toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
      } else {
        setCategories(categoriesData || []);
      }
    };
    fetchCategories();
  }, [toast]);

  useEffect(() => {
    if (open) {
      form.reset({
        id: submittedMcq.id,
        question_text: submittedMcq.question_text,
        option_a: submittedMcq.option_a,
        option_b: submittedMcq.option_b,
        option_c: submittedMcq.option_c,
        option_d: submittedMcq.option_d,
        correct_answer: submittedMcq.correct_answer,
        explanation_text: submittedMcq.explanation_text,
        image_url: submittedMcq.image_url || "",
        suggested_category_name: submittedMcq.suggested_category_name || "",
        suggested_difficulty: submittedMcq.suggested_difficulty || "",
        admin_notes: submittedMcq.admin_notes || "",
        is_trial_mcq: false, // Reset to default for review
      });
    }
  }, [submittedMcq, open, form]);

  const handleApprove = async (values: z.infer<typeof formSchema>) => {
    setIsProcessing(true);
    try {
      // 1. Resolve Category ID
      let categoryId: string | null = null;

      if (values.suggested_category_name) {
        let existingCategory = categories.find(cat => cat.name === values.suggested_category_name);
        if (!existingCategory) {
          const { data: newCategory, error: catError } = await supabase
            .from('categories')
            .insert({ name: values.suggested_category_name })
            .select('id, name') // Select all required fields
            .single();
          if (catError) throw catError;
          existingCategory = newCategory;
        }
        if (existingCategory) { // Ensure existingCategory is not null/undefined
          categoryId = existingCategory.id;
        }
      }

      // 2. Insert Explanation
      const { data: explanationData, error: explanationError } = await supabase
        .from('mcq_explanations')
        .insert({
          explanation_text: values.explanation_text,
          image_url: values.image_url || null,
        })
        .select('id')
        .single();

      if (explanationError) throw explanationError;

      // 3. Insert MCQ into main mcqs table
      const { data: mcqData, error: mcqInsertError } = await supabase
        .from('mcqs')
        .insert({
          question_text: values.question_text,
          option_a: values.option_a,
          option_b: values.option_b,
          option_c: values.option_c,
          option_d: values.option_d,
          correct_answer: values.correct_answer,
          explanation_id: explanationData.id,
          difficulty: values.suggested_difficulty || null,
          is_trial_mcq: values.is_trial_mcq ?? false,
        })
        .select('id')
        .single();

      if (mcqInsertError) throw mcqInsertError;

      // 4. Link MCQ to category if categoryId exists
      if (categoryId) {
        const { error: linkError } = await supabase
          .from('mcq_category_links')
          .insert({
            mcq_id: mcqData.id,
            category_id: categoryId,
          });
        if (linkError) {
          console.error("Error linking MCQ to category:", linkError);
          // Don't throw, proceed with status update
        }
      }

      // 5. Update status of submitted MCQ
      const { error: updateStatusError } = await supabase
        .from('user_submitted_mcqs')
        .update({ status: 'approved', admin_notes: values.admin_notes || null })
        .eq('id', submittedMcq.id);

      if (updateStatusError) throw updateStatusError;

      // 6. Send email to user
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          to: submittedMcq.user_email,
          subject: 'Your MCQ Submission Has Been Approved!',
          body: `Dear ${submittedMcq.user_email},<br/><br/>
                 Good news! Your MCQ submission for "${submittedMcq.question_text.substring(0, 50)}..." has been approved and added to our question bank.<br/><br/>
                 Thank you for your contribution!<br/><br/>
                 Admin Notes: ${values.admin_notes || 'N/A'}`,
        },
      });

      if (emailError) {
        console.error('Error sending approval email:', emailError);
        toast({ title: "Warning", description: "MCQ approved, but failed to send email notification.", variant: "default" });
      } else {
        toast({ title: "Success!", description: "MCQ approved and added to main bank. User notified.", variant: "default" });
      }

      // Add a small delay before calling onSave to allow database changes to propagate
      setTimeout(() => {
        onSave();
      }, 500);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error approving MCQ:", error);
      toast({
        title: "Error",
        description: `Failed to approve MCQ: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (values: z.infer<typeof formSchema>) => {
    setIsProcessing(true);
    try {
      const { error: updateStatusError } = await supabase
        .from('user_submitted_mcqs')
        .update({ status: 'rejected', admin_notes: values.admin_notes || null })
        .eq('id', submittedMcq.id);

      if (updateStatusError) throw updateStatusError;

      // Send email to user
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          to: submittedMcq.user_email,
          subject: 'Update on Your MCQ Submission',
          body: `Dear ${submittedMcq.user_email},<br/><br/>
                 Thank you for your MCQ submission for "${submittedMcq.question_text.substring(0, 50)}...".<br/>
                 After review, we've decided not to add it to our main question bank at this time.<br/><br/>
                 Admin Notes: ${values.admin_notes || 'N/A'}<br/><br/>
                 We appreciate your effort and encourage you to submit more questions!`,
        },
      });

      if (emailError) {
        console.error('Error sending rejection email:', emailError);
        toast({ title: "Warning", description: "MCQ rejected, but failed to send email notification.", variant: "default" });
      } else {
        toast({ title: "Success!", description: "MCQ rejected. User notified.", variant: "default" });
      }

      // Add a small delay before calling onSave to allow database changes to propagate
      setTimeout(() => {
        onSave();
      }, 500);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error rejecting MCQ:", error);
      toast({
        title: "Error",
        description: `Failed to reject MCQ: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveEdits = async (values: z.infer<typeof formSchema>) => {
    setIsProcessing(true);
    try {
      const { error: updateError } = await supabase
        .from('user_submitted_mcqs')
        .update({
          question_text: values.question_text,
          option_a: values.option_a,
          option_b: values.option_b,
          option_c: values.option_c,
          option_d: values.option_d,
          correct_answer: values.correct_answer,
          explanation_text: values.explanation_text,
          image_url: values.image_url || null,
          suggested_category_name: values.suggested_category_name || null,
          suggested_difficulty: values.suggested_difficulty || null,
          admin_notes: values.admin_notes || null,
        })
        .eq('id', submittedMcq.id);

      if (updateError) throw updateError;

      toast({ title: "Success!", description: "Submitted MCQ edits saved.", variant: "default" });
      // Add a small delay before calling onSave to allow database changes to propagate
      setTimeout(() => {
        onSave(); // Refresh data in parent component
      }, 500); // 500ms delay
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving edits to submitted MCQ:", error);
      toast({
        title: "Error",
        description: `Failed to save edits: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Submitted MCQ</DialogTitle>
          <DialogDescription>
            Submitted by: {submittedMcq.user_email || 'N/A'} on {new Date(submittedMcq.created_at).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSaveEdits)} className="space-y-6 py-4">
            <FormField
              control={form.control}
              name="question_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question Text</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter the question text" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {['a', 'b', 'c', 'd'].map((optionKey) => (
              <FormField
                key={optionKey}
                control={form.control}
                name={`option_${optionKey}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{`Option ${optionKey.toUpperCase()}`}</FormLabel>
                    <FormControl>
                      <Input placeholder={`Enter option ${optionKey.toUpperCase()}`} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <FormField
              control={form.control}
              name="correct_answer"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Correct Answer</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-1"
                    >
                      {['A', 'B', 'C', 'D'].map((val) => (
                        <FormItem key={val} className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value={val} />
                          </FormControl>
                          <FormLabel className="font-normal">{val}</FormLabel>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="explanation_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Explanation Text</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Provide a detailed explanation for the correct answer" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Explanation Image URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., https://example.com/image.jpg" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="suggested_category_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Suggested Category Name (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select or type a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="suggested_difficulty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Suggested Difficulty (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Easy">Easy</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_trial_mcq"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Mark as Trial MCQ</FormLabel>
                    <FormDescription>
                      If approved, this MCQ will be available to users on a free trial.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Mark as trial MCQ"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="admin_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Admin Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Add notes for the user or internal reference" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} type="button" disabled={isProcessing}>Cancel</Button>
              <div className="flex gap-2">
                <Button type="submit" variant="secondary" disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Edits
                </Button>
                <Button
                  type="button"
                  onClick={form.handleSubmit(handleReject)}
                  variant="destructive"
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Reject
                </Button>
                <Button
                  type="button"
                  onClick={form.handleSubmit(handleApprove)}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Approve & Add
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewSubmittedMcqDialog;