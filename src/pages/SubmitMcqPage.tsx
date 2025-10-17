"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useSession } from '@/components/SessionContextProvider';
import { Loader2, Trash2 } from 'lucide-react';

const formSchema = z.object({
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
});

const LOCAL_STORAGE_KEY = 'submit_mcq_draft';

const SubmitMcqPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true); // New loading state for initial check

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question_text: "",
      option_a: "",
      option_b: "",
      option_c: "",
      option_d: "",
      correct_answer: 'A',
      explanation_text: "",
      image_url: "",
      suggested_category_name: "",
      suggested_difficulty: "",
    },
  });

  useEffect(() => {
    if (hasCheckedInitialSession) {
      setIsPageLoading(false); // Once initial session check is done, stop page loading
      const savedDraft = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          form.reset(draft);
          toast({
            title: "Draft Loaded",
            description: "Your previous draft has been loaded.",
            duration: 3000,
          });
        } catch (e) {
          console.error("Failed to parse saved draft:", e);
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }
    }
  }, [hasCheckedInitialSession, form, toast]); // Dependencies changed

  useEffect(() => {
    const subscription = form.watch((value) => {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(value));
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const clearDraft = () => {
    if (window.confirm("Are you sure you want to clear your saved draft? This action cannot be undone.")) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      form.reset();
      toast({
        title: "Draft Cleared",
        description: "Your saved draft has been removed.",
        duration: 3000,
      });
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to submit an MCQ.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from('user_submitted_mcqs')
        .insert({
          user_id: user.id,
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
          status: 'pending',
        });

      if (insertError) {
        throw insertError;
      }

      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          to: 'ADMIN_EMAIL',
          subject: `New MCQ Submission from ${user.email}`,
          body: `User ${user.email} (${user.id}) submitted a new MCQ for review.<br/><br/>
                 Question: ${values.question_text}<br/>
                 Correct Answer: ${values.correct_answer}<br/>
                 Suggested Category: ${values.suggested_category_name || 'N/A'}<br/>
                 Suggested Difficulty: ${values.suggested_difficulty || 'N/A'}<br/><br/>
                 Explanation: ${values.explanation_text}<br/><br/>
                 Review in admin panel (future feature).`,
        },
      });

      if (emailError) {
        console.error('Error sending MCQ submission email:', emailError);
        toast({ title: "Warning", description: "MCQ submitted, but failed to send email notification.", variant: "default" });
      } else {
        toast({
          title: "MCQ Submitted!",
          description: "Your MCQ has been submitted for review. Thank you!",
        });
      }
      form.reset();
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (error: any) {
      console.error("Error submitting MCQ:", error);
      toast({
        title: "Error",
        description: `Failed to submit MCQ: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasCheckedInitialSession || isPageLoading) { // Use hasCheckedInitialSession for initial loading
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading submission page...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-2xl">Submit a New MCQ</CardTitle>
          <CardDescription>Help us grow our question bank by submitting your own Multiple Choice Questions for review.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        defaultValue={field.value}
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
                    <FormControl>
                      <Input placeholder="e.g., Biology, Chemistry" {...field} />
                    </FormControl>
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

              <div className="flex flex-col sm:flex-row gap-4">
                <Button type="submit" className="w-full sm:flex-1" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                    </>
                  ) : (
                    "Submit MCQ for Review"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={clearDraft} className="w-full sm:flex-1">
                  <Trash2 className="mr-2 h-4 w-4" /> Clear Saved Draft
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default SubmitMcqPage;