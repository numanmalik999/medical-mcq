"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
// Removed unused 'Label' import
// import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { MCQ } from './mcq-columns'; // Import MCQ type

interface Category {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

// Define a schema for the form data, similar to AddMcqPage but for editing
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
  category_id: z.string().uuid("Invalid category ID.").optional().or(z.literal('')),
  subcategory_id: z.string().uuid("Invalid subcategory ID.").optional().or(z.literal('')),
  difficulty: z.string().optional().or(z.literal('')),
}).refine((data) => {
  if (data.subcategory_id && !data.category_id) {
    return false;
  }
  return true;
}, {
  message: "A category must be selected if a subcategory is chosen.",
  path: ["category_id"],
});

interface EditMcqDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mcq: MCQ | null;
  onSave: () => void; // Callback to refresh data after save
}

const EditMcqDialog = ({ open, onOpenChange, mcq, onSave }: EditMcqDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    },
  });

  const selectedCategoryId = form.watch("category_id");

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

  // Filter subcategories based on selected category
  useEffect(() => {
    if (selectedCategoryId) {
      setFilteredSubcategories(subcategories.filter(sub => sub.category_id === selectedCategoryId));
    } else {
      setFilteredSubcategories([]);
      form.setValue("subcategory_id", "");
    }
  }, [selectedCategoryId, subcategories, form]);

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
          category_id: mcq.category_id || "",
          subcategory_id: mcq.subcategory_id || "",
          difficulty: mcq.difficulty || "",
        });
      };
      loadMcqData();
    } else if (!open) {
      form.reset(); // Reset form when dialog closes
    }
  }, [mcq, open, form, toast]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      // Update explanation
      if (values.explanation_id) {
        const { error: explanationError } = await supabase
          .from('mcq_explanations')
          .update({
            explanation_text: values.explanation_text,
            image_url: values.image_url || null,
          })
          .eq('id', values.explanation_id);

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
          values.explanation_id = newExplanationData.id; // Assign new explanation ID
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
          explanation_id: values.explanation_id, // Ensure explanation_id is updated
          category_id: values.category_id || null,
          subcategory_id: values.subcategory_id || null,
          difficulty: values.difficulty || null,
        })
        .eq('id', values.id);

      if (mcqError) {
        throw mcqError;
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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

export default EditMcqDialog;