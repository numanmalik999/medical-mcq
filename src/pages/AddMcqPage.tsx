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

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

const AddMcqPage = () => {
  const { toast, dismiss } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [availableSubcategories, setAvailableSubcategories] = useState<Subcategory[]>([]);
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
    subcategory_ids: z.array(z.string().uuid("Invalid subcategory ID.")).optional(),
    difficulty: z.string().optional().or(z.literal('')),
    is_trial_mcq: z.boolean().optional(),
  }).refine((data) => {
    // If subcategories are selected, at least one category must be selected
    if (data.subcategory_ids && data.subcategory_ids.length > 0 && (!data.category_ids || data.category_ids.length === 0)) {
      return false;
    }
    // Also, ensure selected subcategories belong to selected categories
    if (data.subcategory_ids && data.subcategory_ids.length > 0 && data.category_ids && data.category_ids.length > 0) {
      const selectedSubcategoryObjects = subcategories.filter((sub: Subcategory) => data.subcategory_ids?.includes(sub.id));
      const allSelectedSubcategoriesBelongToSelectedCategories = selectedSubcategoryObjects.every((sub: Subcategory) => data.category_ids?.includes(sub.category_id));
      if (!allSelectedSubcategoriesBelongToSelectedCategories) {
        return false;
      }
    }
    return true;
  }, {
    message: "Selected subcategories must belong to selected categories, and a category must be selected if a subcategory is chosen.",
    path: ["subcategory_ids"],
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
      subcategory_ids: [],
      difficulty: "",
      is_trial_mcq: false,
    },
  });

  const selectedCategoryIds = form.watch("category_ids");

  useEffect(() => {
    if (hasCheckedInitialSession) { // Only fetch if initial session check is done
      const fetchCategoriesAndSubcategories = async () => {
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

        const { data: subcategoriesData, error: subcategoriesError } = await supabase
          .from('subcategories')
          .select('*');
        if (subcategoriesError) {
          console.error('Error fetching subcategories:', subcategoriesError);
          toast({ title: "Error", description: "Failed to load subcategories.", variant: "destructive" });
        } else {
          setSubcategories(subcategoriesData || []);
        }
        setIsPageLoading(false); // Clear loading for this specific fetch
      };
      fetchCategoriesAndSubcategories();
    }
  }, [hasCheckedInitialSession, toast]); // Dependencies changed

  useEffect(() => {
    if (selectedCategoryIds && selectedCategoryIds.length > 0) {
      const filtered = subcategories.filter(sub => selectedCategoryIds.includes(sub.category_id));
      setAvailableSubcategories(filtered);

      const currentSelectedSubcategories = form.getValues("subcategory_ids") || [];
      const validSelectedSubcategories = currentSelectedSubcategories.filter(subId =>
        filtered.some(fSub => fSub.id === subId)
      );
      if (validSelectedSubcategories.length !== currentSelectedSubcategories.length) {
        form.setValue("subcategory_ids", validSelectedSubcategories);
      }
    } else {
      setAvailableSubcategories([]);
      form.setValue("subcategory_ids", []);
    }
  }, [selectedCategoryIds, subcategories, form]);

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

      if (data.suggested_subcategory_name) {
        const currentSelectedCategoryIds = form.getValues("category_ids") || [];
        if (currentSelectedCategoryIds.length > 0) {
          const matchedSubcategory = availableSubcategories.find(
            (sub) => sub.name.toLowerCase() === data.suggested_subcategory_name.toLowerCase() &&
                     currentSelectedCategoryIds.includes(sub.category_id)
          );
          if (matchedSubcategory) {
            const currentSubcategoryIds = form.getValues("subcategory_ids") || [];
            if (!currentSubcategoryIds.includes(matchedSubcategory.id)) {
              form.setValue("subcategory_ids", [...currentSubcategoryIds, matchedSubcategory.id]);
            }
            toast({
              title: "Subcategory Suggested",
              description: `AI suggested and matched subcategory: "${matchedSubcategory.name}".`,
              variant: "default",
            });
          } else {
            toast({
              title: "Subcategory Suggested",
              description: `AI suggested subcategory "${data.suggested_subcategory_name}", but no match found in selected categories. Please select manually.`,
              variant: "default",
            });
          }
        } else {
          toast({
            title: "Subcategory Suggested",
            description: `AI suggested subcategory "${data.suggested_subcategory_name}", but a category must be selected first. Please select manually.`,
            variant: "default",
          });
        }
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
        const linksToInsert = values.category_ids.map(catId => {
          const selectedSubcategoriesForThisCategory = (values.subcategory_ids || []).filter(subId =>
            subcategories.some(sub => sub.id === subId && sub.category_id === catId)
          );

          if (selectedSubcategoriesForThisCategory.length > 0) {
            return selectedSubcategoriesForThisCategory.map(subId => ({
              mcq_id: mcqData.id,
              category_id: catId,
              subcategory_id: subId,
            }));
          } else {
            return [{
              mcq_id: mcqData.id,
              category_id: catId,
              subcategory_id: null,
            }];
          }
        }).flat();

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
        <p className="text-gray-700 dark:text-gray-300">Loading categories and subcategories...</p>
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
                name="subcategory_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategories (Optional)</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={availableSubcategories.map(sub => ({ value: sub.id, label: sub.name }))}
                        selectedValues={field.value || []}
                        onValueChange={field.onChange}
                        placeholder="Select subcategories"
                        disabled={!selectedCategoryIds || selectedCategoryIds.length === 0}
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