"use client";

import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const formSchema = z.object({
  question_text: z.string().min(1, "Question text is required."),
  option_a: z.string().min(1, "Option A is required."),
  option_b: z.string().min(1, "Option B is required."),
  option_c: z.string().min(1, "Option C is required."),
  option_d: z.string().min(1, "Option D is required."),
  correct_answer: z.enum(['A', 'B', 'C', 'D'], { message: "Correct answer is required." }),
  explanation_text: z.string().min(1, "Explanation text is required."),
  image_url: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  category: z.string().optional().or(z.literal('')),
  difficulty: z.string().optional().or(z.literal('')),
});

const AddMcqPage = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      category: "",
      difficulty: "",
    },
  });

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

      // Then, insert the MCQ with the explanation_id
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
          category: values.category || null,
          difficulty: values.difficulty || null,
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
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Anatomy, Physiology, Pharmacology" {...field} />
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

              <Button type="submit" className="w-full" disabled={isSubmitting}>
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