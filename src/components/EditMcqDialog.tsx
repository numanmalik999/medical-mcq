"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { MCQ } from './mcq-columns';
import { Switch } from '@/components/ui/switch';
import { Loader2, Wand2 } from 'lucide-react'; // Removed X icon import
import MultiSelect from './MultiSelect'; // Import the new MultiSelect component

interface Category {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

interface EditMcqDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mcq: MCQ | null;
  onSave: () => void; // Callback to refresh data after save
}

const EditMcqDialog = ({ open, onOpenChange, mcq, onSave }: EditMcqDialogProps) => {
  const { toast, dismiss } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [availableSubcategories, setAvailableSubcategories] = useState<Subcategory[]>([]); // Subcategories filtered by selected categories

  // Define formSchema inside the component to access `subcategories` state
  const formSchema = z.object({
    id: z.string().uuid(), // MCQ ID
    question_text: z.string().min(1, "Question text is required."),
    option_a: z.string().min(1, "Option A is required."),
    option_b: z.string().min(1, "Option B is required."),
    option_c: z.string().min(1, "Option C is required."),
    option_d: z.string().min(1, "Option D is required."),
    correct_answer: z.enum(['A', 'B', 'C', 'D'], { message: "Correct answer is required." }),
    explanation_id: z.string().uuid().nullable(), // Explanation ID
    explanation_text: z.string().min(1, "Explanation text is required."),
    image_url: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
    category_ids: z.array(z.string().uuid("Invalid category ID.")).optional(), // Now an array
    subcategory_ids: z.array(z.string().uuid("Invalid subcategory ID.")).optional(), // Now an array
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
      category_ids: [], // Initialize as empty array
      subcategory_ids: [], // Initialize as empty array
      difficulty: "",
      is_trial_mcq: false,
    },
  });

  const selectedCategoryIds = form.watch("category_ids");

  // Fetch categories and subcategories
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

  // Filter available subcategories based on selected categories
  useEffect(() => {
    if (selectedCategoryIds && selectedCategoryIds.length > 0) {
      const filtered = subcategories.filter(sub => selectedCategoryIds.includes(sub.category_id));
      setAvailableSubcategories(filtered);

      // Also, remove any selected subcategories that no longer belong to the selected categories
      const currentSelectedSubcategories = form.getValues("subcategory_ids") || [];
      const validSelectedSubcategories = currentSelectedSubcategories.filter(subId =>
        filtered.some(fSub => fSub.id === subId)
      );
      if (validSelectedSubcategories.length !== currentSelectedSubcategories.length) {
        form.setValue("subcategory_ids", validSelectedSubcategories);
      }
    } else {
      setAvailableSubcategories([]);
      form.setValue("subcategory_ids", []); // Clear subcategories if no category is selected
    }
  }, [selectedCategoryIds, subcategories, form]);

  // Populate form when MCQ prop changes
  useEffect(() => {
    if (mcq && open) {
      const loadMcqData = async () => {
        let explanationText = "";
        let imageUrl = "";

        if (mcq.explanation_id) {
          const { data: explanationData, error: explanationError } = await supabase
            .from('mcq_explanations')
            .select('explanation_text, image_url')
            .eq('id', mcq.explanation_id)
            .single();

          if (explanationError) {
            console.error('Error fetching explanation for MCQ:', explanationError);
            toast({ title: "Error", description: "Failed to load MCQ explanation.", variant: "destructive" });
          } else if (explanationData) {
            explanationText = explanationData.explanation_text;
            imageUrl = explanationData.image_url || "";
          }
        }

        // Extract category_ids and subcategory_ids from mcq.category_links
        const initialCategoryIds = mcq.category_links?.map(link => link.category_id).filter((id): id is string => id !== null) || [];
        const initialSubcategoryIds = mcq.category_links?.map(link => link.subcategory_id).filter((id): id is string => id !== null) || [];

        form.reset({
          id: mcq.id,
          question_text: mcq.question_text,
          option_a: mcq.option_a,
          option_b: mcq.option_b,
          option_c: mcq.option_c,
          option_d: mcq.option_d,
          correct_answer: mcq.correct_answer,
          explanation_id: mcq.explanation_id,
          explanation_text: explanationText,
          image_url: imageUrl,
          category_ids: initialCategoryIds,
          subcategory_ids: initialSubcategoryIds,
          difficulty: mcq.difficulty || "",
          is_trial_mcq: mcq.is_trial_mcq || false,
        });
      };
      loadMcqData();
    } else if (!open) {
      form.reset(); // Reset form when dialog closes
    }
  }, [mcq, open, form, toast]);

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
      description: "Please wait while AI generates the explanation and difficulty.",
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
        description: "Explanation and difficulty have been generated. Please review.",
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
      let currentExplanationId = values.explanation_id;

      // Update or insert explanation
      if (currentExplanationId) {
        const { error: explanationError } = await supabase
          .from('mcq_explanations')
          .update({
            explanation_text: values.explanation_text,
            image_url: values.image_url || null,
          })
          .eq('id', currentExplanationId);

        if (explanationError) {
          throw explanationError;
        }
      } else {
        // If no explanation_id exists, but explanation text is provided, create one
        if (values.explanation_text.trim()) {
          const { data: newExplanationData, error: newExplanationError } = await supabase
            .from('mcq_explanations')
            .insert({
              explanation_text: values.explanation_text,
              image_url: values.image_url || null,
            })
            .select('id')
            .single();

          if (newExplanationError) {
            throw newExplanationError;
          }
          currentExplanationId = newExplanationData.id; // Assign new explanation ID
        }
      }

      // Update MCQ
      const { error: mcqError } = await supabase
        .from('mcqs')
        .update({
          question_text: values.question_text,
          option_a: values.option_a,
          option_b: values.option_b,
          option_c: values.option_c,
          option_d: values.option_d,
          correct_answer: values.correct_answer,
          explanation_id: currentExplanationId, // Use the resolved explanation ID
          difficulty: values.difficulty || null,
          is_trial_mcq: values.is_trial_mcq,
        })
        .eq('id', values.id);

      if (mcqError) {
        throw mcqError;
      }

      // Handle mcq_category_links
      // First, delete all existing links for this MCQ
      const { error: deleteLinksError } = await supabase
        .from('mcq_category_links')
        .delete()
        .eq('mcq_id', values.id);

      if (deleteLinksError) {
        console.error("Error deleting existing category links:", deleteLinksError);
        // Don't throw, try to proceed with inserting new ones
      }

      // Then, insert new links if category_ids are provided
      if (values.category_ids && values.category_ids.length > 0) {
        const linksToInsert = values.category_ids.map(catId => {
          // Find subcategories that belong to this category and are selected
          const selectedSubcategoriesForThisCategory = (values.subcategory_ids || []).filter(subId =>
            subcategories.some(sub => sub.id === subId && sub.category_id === catId)
          );

          if (selectedSubcategoriesForThisCategory.length > 0) {
            // Create a link for each selected subcategory within this category
            return selectedSubcategoriesForThisCategory.map(subId => ({
              mcq_id: values.id,
              category_id: catId,
              subcategory_id: subId,
            }));
          } else {
            // If no subcategories are selected for this category, create a link with null subcategory
            return [{
              mcq_id: values.id,
              category_id: catId,
              subcategory_id: null,
            }];
          }
        }).flat(); // Flatten the array of arrays

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
        description: "MCQ updated successfully.",
      });
      onSave(); // Refresh data in parent component
      onOpenChange(false); // Close dialog
    } catch (error: any) {
      console.error("Error updating MCQ:", error);
      toast({
        title: "Error",
        description: `Failed to update MCQ: ${error.message || 'Unknown error'}`,
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
          <DialogTitle>Edit MCQ</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
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

export default EditMcqDialog;