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
import { Loader2, Wand2 } from 'lucide-react';
import MultiSelect from './MultiSelect';

interface Category {
  id: string;
  name: string;
}

interface Topic {
  id: string;
  title: string;
}

interface EditMcqDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mcq: MCQ | null;
  onSave: () => void;
}

const formSchema = z.object({
  id: z.string().uuid(),
  question_text: z.string().min(1, "Question text is required."),
  option_a: z.string().min(1, "Option A is required."),
  option_b: z.string().min(1, "Option B is required."),
  option_c: z.string().min(1, "Option C is required."),
  option_d: z.string().min(1, "Option D is required."),
  correct_answer: z.enum(['A', 'B', 'C', 'D'], { message: "Correct answer is required." }),
  explanation_id: z.string().uuid().nullable(),
  explanation_text: z.string().min(1, "Explanation text is required."),
  image_url: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  category_ids: z.array(z.string().uuid("Invalid category ID.")).optional(),
  topic_id: z.string().uuid().optional().or(z.literal('')),
  difficulty: z.string().optional().or(z.literal('')),
  is_trial_mcq: z.boolean().optional(),
});

const EditMcqDialog = ({ open, onOpenChange, mcq, onSave }: EditMcqDialogProps) => {
  const { toast, dismiss } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

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
      topic_id: "",
      difficulty: "",
      is_trial_mcq: false,
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data: categoriesData, error: categoriesError } = await supabase.from('categories').select('*');
      if (categoriesError) {
        console.error('Error fetching categories:', categoriesError);
        toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
      } else {
        setCategories(categoriesData || []);
      }

      const { data: topicsData, error: topicsError } = await supabase.from('course_topics').select('id, title');
      if (topicsError) {
        console.error('Error fetching topics:', topicsError);
        toast({ title: "Error", description: "Failed to load topics.", variant: "destructive" });
      } else {
        setTopics(topicsData || []);
      }
    };
    fetchData();
  }, [toast]);

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

        const initialCategoryIds = mcq.category_links?.map(link => link.category_id).filter((id): id is string => id !== null) || [];
        const initialTopicId = mcq.topic_links?.[0]?.topic_id || "";

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
          topic_id: initialTopicId,
          difficulty: mcq.difficulty || "",
          is_trial_mcq: mcq.is_trial_mcq || false,
        });
      };
      loadMcqData();
    } else if (!open) {
      form.reset();
    }
  }, [mcq, open, form, toast]);

  const handleGenerateWithAI = async () => {
    const { question_text, option_a, option_b, option_c, option_d } = form.getValues();
    if (!question_text || !option_a || !option_b || !option_c || !option_d) {
      toast({ title: "Missing Information", description: "Please fill in the question and all options before generating with AI.", variant: "destructive" });
      return;
    }
    setIsGeneratingAI(true);
    const loadingToastId = toast({ title: "Generating with AI...", description: "Please wait...", duration: 999999, action: <Loader2 className="h-4 w-4 animate-spin" /> });
    try {
      const { data, error } = await supabase.functions.invoke('generate-mcq-content', { body: { question: question_text, options: { A: option_a, B: option_b, C: option_c, D: option_d } } });
      if (error) throw error;
      form.setValue("correct_answer", data.correct_answer);
      form.setValue("explanation_text", data.explanation_text);
      form.setValue("difficulty", data.difficulty);
      dismiss(loadingToastId.id);
      toast({ title: "AI Generation Complete!", description: `Correct answer determined as ${data.correct_answer}. Please review.`, variant: "default" });
    } catch (error: any) {
      dismiss(loadingToastId.id);
      console.error("Error generating with AI:", error);
      toast({ title: "AI Generation Failed", description: `Failed to generate content: ${error.message || 'Unknown error'}`, variant: "destructive" });
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      let currentExplanationId = values.explanation_id;
      if (currentExplanationId) {
        const { error } = await supabase.from('mcq_explanations').update({ explanation_text: values.explanation_text, image_url: values.image_url || null }).eq('id', currentExplanationId);
        if (error) throw error;
      } else if (values.explanation_text.trim()) {
        const { data, error } = await supabase.from('mcq_explanations').insert({ explanation_text: values.explanation_text, image_url: values.image_url || null }).select('id').single();
        if (error) throw error;
        currentExplanationId = data.id;
      }

      const { error: mcqError } = await supabase.from('mcqs').update({
        question_text: values.question_text,
        option_a: values.option_a,
        option_b: values.option_b,
        option_c: values.option_c,
        option_d: values.option_d,
        correct_answer: values.correct_answer,
        explanation_id: currentExplanationId,
        difficulty: values.difficulty || null,
        is_trial_mcq: values.is_trial_mcq,
      }).eq('id', values.id);
      if (mcqError) throw mcqError;

      await supabase.from('mcq_category_links').delete().eq('mcq_id', values.id);
      if (values.category_ids && values.category_ids.length > 0) {
        const linksToInsert = values.category_ids.map(catId => ({ mcq_id: values.id, category_id: catId }));
        const { error } = await supabase.from('mcq_category_links').insert(linksToInsert);
        if (error) throw error;
      }

      await supabase.from('mcq_topic_links').delete().eq('mcq_id', values.id);
      if (values.topic_id) {
        const { error } = await supabase.from('mcq_topic_links').insert({ mcq_id: values.id, topic_id: values.topic_id });
        if (error) throw error;
      }

      toast({ title: "Success!", description: "MCQ updated successfully." });
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating MCQ:", error);
      toast({ title: "Error", description: `Failed to update MCQ: ${error.message || 'Unknown error'}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit MCQ</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <FormField control={form.control} name="question_text" render={({ field }) => (<FormItem><FormLabel>Question Text</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
            {['a', 'b', 'c', 'd'].map(key => (<FormField key={key} control={form.control} name={`option_${key}` as any} render={({ field }) => (<FormItem><FormLabel>{`Option ${key.toUpperCase()}`}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />))}
            <FormField control={form.control} name="correct_answer" render={({ field }) => (<FormItem><FormLabel>Correct Answer</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-1">{['A', 'B', 'C', 'D'].map(val => (<FormItem key={val} className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value={val} /></FormControl><FormLabel className="font-normal">{val}</FormLabel></FormItem>))}</RadioGroup></FormControl><FormMessage /></FormItem>)} />
            <Button type="button" onClick={handleGenerateWithAI} disabled={isGeneratingAI || isSubmitting} className="w-full flex items-center gap-2">{isGeneratingAI ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Wand2 className="h-4 w-4" /> Generate with AI</>}</Button>
            <FormField control={form.control} name="explanation_text" render={({ field }) => (<FormItem><FormLabel>Explanation Text</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="image_url" render={({ field }) => (<FormItem><FormLabel>Image URL</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="category_ids" render={({ field }) => (<FormItem><FormLabel>Categories</FormLabel><FormControl><MultiSelect options={categories.map(c => ({ value: c.id, label: c.name }))} selectedValues={field.value || []} onValueChange={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
            <FormField
              control={form.control}
              name="topic_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic (Optional)</FormLabel>
                  <Select onValueChange={(value) => field.onChange(value === 'no-topic' ? '' : value)} value={field.value ? field.value : 'no-topic'}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a topic to link" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="no-topic">None</SelectItem>
                      {topics.map(t => (<SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="difficulty" render={({ field }) => (<FormItem><FormLabel>Difficulty</FormLabel><Select onValueChange={field.onChange} value={field.value || ''}><FormControl><SelectTrigger><SelectValue placeholder="Select difficulty" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Easy">Easy</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="Hard">Hard</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="is_trial_mcq" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel>Trial MCQ</FormLabel><FormDescription>Available to users on a free trial.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || isGeneratingAI}>{isSubmitting ? "Saving..." : "Save Changes"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditMcqDialog;