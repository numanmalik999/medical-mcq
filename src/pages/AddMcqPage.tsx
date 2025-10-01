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
import { Loader2, Wand2 } from 'lucide-react'; // Import Wand2 icon

interface Category {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

const formSchema = z.object({
  question_text: z.string().min(1, "Question text is required."),
  option_a: z.string().min(1, "Option A is required."),
  option_b: z.string().min(1, "Option B is required."),
  option_c: z.string().min(1, "Option C is required."),
  option_d: z.string().min(1, "Option D is required."),
  correct_answer: z.enum(['A', 'B', 'C', 'D'], { message: "Correct answer is required." }),
  explanation_text: z.string().min(1, "Explanation text is required."),
  image_url: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  category_id: z.string().uuid("Invalid category ID.").optional().or(z.literal('')),
  subcategory_id: z.string().uuid("Invalid subcategory ID.").optional().or(z.literal('')),
  difficulty: z.string().optional().or(z.literal('')),
  is_trial_mcq: z.boolean().optional(),
}).refine((data) => {
  if (data.subcategory_id && !data.category_id) {
    return false;
  }
  return true;
}, {
  message: "A category must be selected if a subcategory is chosen.",
  path: ["category_id"],
});

const AddMcqPage = () => {
  const { toast, dismiss } = useToast(); // Destructure dismiss from useToast
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false); // New state for AI generation
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState<Subcategory[]>([]);

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
      category_id: "",
      subcategory_id: "",
      difficulty: "",
      is_trial_mcq: false,
    },
  });

  const selectedCategoryId = form.watch("category_id");

  useEffect(() => {
    const fetchCategoriesAndSubcategories = async () => {
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*');
      if (categoriesError) {
        console.error('Error fetching categories:', categoriesError);
        toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
      } else {
        setCategories(categoriesData || []);
      }

      const { data: subcategoriesData, error: subcategoriesError } = await supabase
        .from('subcategories')
        .select('*');
      if (subcategoriesError) {
        console.error('Error fetching subcategories:', subcategoriesError);
        toast({ title: "Error", description: "Failed to load subcategories.", variant: "destructive" });
      } else {
        setSubcategories(subcategoriesData || []);
      }
    };
    fetchCategoriesAndSubcategories();
  }, [toast]);

  useEffect(() => {
    if (selectedCategoryId) {
      setFilteredSubcategories(subcategories.filter(sub => sub.category_id === selectedCategoryId));
    } else {
      setFilteredSubcategories([]);
      form.setValue("subcategory_id", "");
    }
  }, [selectedCategoryId, subcategories, form]);

  const handleGenerateWithAI = async () => {
    const { question_text, option_a, option_b, option_c, option_d, correct_answer } = form.getValues();

    if (!question_text || !option_a || !option_b || !option_c || !option_d || !correct_answer) {
      toast({
        title: "Missing Information",
        description: "Please fill in the question, all options, and the correct answer before generating with AI.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingAI(true);
    const loadingToastId = toast({
      title: "Generating with AI...",
      description: "Please wait while AI generates the explanation, difficulty, and subcategory.",
      duration: 999999,
      action: <Loader2 className="h-4 w-4 animate-spin" />,
    });

    try {
      const { data, error } = await supabase.functions.invoke('generate-mcq-content', {
        body: {
          question: question_text,
          options: { A: option_a, B: option_b, C: option_c, D: option_d },
          correct_answer: correct_answer,
        },
      });

      if (error) {
        throw error;
      }

      form.setValue("explanation_text", data.explanation_text);
      form.setValue("difficulty", data.difficulty);

      // NEW LOGIC: Handle suggested subcategory
      if (data.suggested_subcategory_name) {
        if (selectedCategoryId) {
          const matchedSubcategory = filteredSubcategories.find(
            (sub) => sub.name.toLowerCase() === data.suggested_subcategory_name.toLowerCase()
          );
          if (matchedSubcategory) {
            form.setValue("subcategory_id", matchedSubcategory.id);
            toast({
              title: "Subcategory Suggested",
              description: `AI suggested and matched subcategory: "${matchedSubcategory.name}".`,
              variant: "default",
            });
          } else {
            toast({
              title: "Subcategory Suggested",
              description: `AI suggested subcategory "${data.suggested_subcategory_name}", but no match found in selected category. Please select manually.`,
              variant: "default",
            });
            form.setValue("subcategory_id", ""); // Clear if no match
          }
        } else {
          toast({
            title: "Subcategory Suggested",
            description: `AI suggested subcategory "${data.suggested_subcategory_name}", but a category must be selected first. Please select manually.`,
            variant: "default",
          });
          form.setValue("subcategory_id", ""); // Clear if no category selected
        }
      } else {
        form.setValue("subcategory_id", ""); // Clear if AI didn't suggest one
      }

      dismiss(loadingToastId.id);
      toast({
        title: "AI Generation Complete!",
        description: "Explanation, difficulty, and subcategory (if matched) have been generated. Please review.",
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

      // Then, insert the MCQ with the explanation_id, category_id, subcategory_id, and is_trial_mcq
      const { error: mcqError } = await supabase
        .from('mcqs')
        .insert({
          question_text: values.question_text,
          option_a: values.option_a,
          option_b: values.option_b,
          option_c: values.option_c,
          option_d: values.option_d,
          correct_answer: values.correct_answer,
          explanation_id: explanationData.id,
          category_id: values.category_id || null,
          subcategory_id: values.subcategory_id || null,
          difficulty: values.difficulty || null,
          is_trial_mcq: values.is_trial_mcq,
        });

      if (mcqError) {
        throw mcqError;
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
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subcategory_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategory (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={!selectedCategoryId || filteredSubcategories.length === 0}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a subcategory" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredSubcategories.map((subcat) => (
                          <SelectItem key={subcat.id} value={subcat.id}>{subcat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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