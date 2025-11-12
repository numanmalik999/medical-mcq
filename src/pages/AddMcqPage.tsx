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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Loader2, Wand2 } from 'lucide-react';
import MultiSelect from '@/components/MultiSelect';
import { useSession } from '@/components/SessionContextProvider'; // Import useSession

interface Category {
  id: string;
  name: string;
}

const AddMcqPage = () => {
  const { toast, dismiss } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true); // New loading state for initial data fetch

  const { hasCheckedInitialSession } = useSession(); // Get hasCheckedInitialSession

  // Define formSchema inside the component to access `subcategories` state
  const formSchema = z.object({
    question_text: z.string().min(1, "Question text is required."),
    option_a: z.string().min(1, "Option A is required."),
    option_b: z.string().min(1, "Option B is required."),
    option_c: z.string().min(1, "Option C is required."),
    option_d: z.string().min(1, "Option D is required."),
    correct_answer: z.enum(['A', 'B', 'C', 'D'], { message: "Correct answer is required." }),
    explanation_text: z.string().min(1, "Explanation text is required."),
    image_url: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
    category_ids: z.array(z.string().uuid("Invalid category ID.")).optional(),
    difficulty: z.string().optional().or(z.literal('')),
    is_trial_mcq: z.boolean().optional(),
  });

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
      category_ids: [],
      difficulty: "",
      is_trial_mcq: false,
    },
  });

  useEffect(() => {
    if (hasCheckedInitialSession) { // Only fetch if initial session check is done
      const fetchCategories = async () => {
        setIsPageLoading(true); // Set loading for this specific fetch
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('*');
        if (categoriesError) {
          console.error('Error fetching categories:', categoriesError);
          toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
        } else {
          setCategories(categoriesData || []);
        }
        setIsPageLoading(false); // Clear loading for this specific fetch
      };
      fetchCategories();
    }
  }, [hasCheckedInitialSession, toast]); // Dependencies changed

  const handleGenerateWithAI = async () => {
    const { question_text, option_a, option_b, option_c, option_d } = form.getValues();

    if (!question_text || !option_a || !option_b || !option_c || !option_d) {
      toast({
        title: "Missing Information",
        description: "Please fill in the question and all options before generating with AI.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingAI(true);
    const loadingToastId = toast({
      title: "Generating with AI...",
      description: "Please wait while AI determines the correct answer, generates the explanation, and difficulty.",
      duration: 999999,
      action: <Loader2 className="h-4 w-4 animate-spin" />,
    });

    try {
      const { data, error } = await supabase.functions.invoke('generate-mcq-content', {
        body: {
          question: question_text,
          options: { A: option_a, B: option_b, C: option_c, D: option_d },
          // Removed correct_answer from body as AI determines it
        },
      });

      if (error) {
        throw error;
      }

      // Use the AI-determined correct answer
      form.setValue("correct_answer", data.correct_answer);
      form.setValue("explanation_text", data.explanation_text);
      form.setValue("difficulty", data.difficulty);
      
      dismiss(loadingToastId.id);
      toast({
        title: "AI Generation Complete!",
        description: `Correct answer determined as ${data.correct_answer}. Explanation and difficulty have been generated. Please review.`,
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
      // First, insert the explanation
      const { data: explanationData, error: explanationError } = await supabase
        .from('mcq_explanations')
        .insert({
          explanation_text: values.explanation_text,
          image_url: values.image_url || null,
        })
        .select('id')
        .single();

      if (explanationError) {
        throw explanationError;
      }

      // Then, insert the MCQ
      const { data: mcqData, error: mcqError } = await supabase
        .from('mcqs')
        .insert({
          question_text: values.question_text,
          option_a: values.option_a,
          option_b: values.option_b,
          option_c: values.option_c,
          option_d: values.option_d,
          correct_answer: values.correct_answer,
          explanation_id: explanationData.id,
          difficulty: values.difficulty || null,
          is_trial_mcq: values.is_trial_mcq,
        })
        .select('id')
        .single();

      if (mcqError) {
        throw mcqError;
      }

      // Handle mcq_category_links
      if (values.category_ids && values.category_ids.length > 0) {
        const linksToInsert = values.category_ids.map(catId => ({
          mcq_id: mcqData.id,
          category_id: catId,
        }));

        if (linksToInsert.length > 0) {
          const { error: insertLinkError } = await supabase
            .from('mcq_category_links')
            .insert(linksToInsert);

          if (insertLinkError) {
            console.error("Error inserting new category links:", insertLinkError);
            throw insertLinkError;
          }
        }
      }

      toast({
        title: "Success!",
        description: "MCQ added successfully.",
      });
      form.reset();
    } catch (error: any) {
      console.error("Error adding MCQ:", error);
      toast({
        title: "Error",
        description: `Failed to add MCQ: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasCheckedInitialSession || isPageLoading) { // Use hasCheckedInitialSession for initial loading
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-2xl">Add New MCQ</CardTitle>
          <CardDescription>Fill in the details for a new Multiple Choice Question.</CardDescription>
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
                    <FormLabel>Correct Answer (AI will override this if used)</FormLabel>
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

              <Button
                type="button"
                onClick={handleGenerateWithAI}
                disabled={isGeneratingAI || isSubmitting}
                className="w-full flex items-center gap-2"
              >
                {isGeneratingAI ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" /> Generate with AI
                  </>
                )}
              </Button>

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
                name="category_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categories (Optional)</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
                        selectedValues={field.value || []}
                        onValueChange={field.onChange}
                        placeholder="Select categories"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty (Optional)</FormLabel>
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
                        If enabled, this MCQ will be available to users on a free trial.
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

              <Button type="submit" className="w-full" disabled={isSubmitting || isGeneratingAI}>
                {isSubmitting ? "Adding MCQ..." : "Add MCQ"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default AddMcqPage;