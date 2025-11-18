"use client";

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useSession } from '@/components/SessionContextProvider';
import { Loader2, Lightbulb } from 'lucide-react';

const formSchema = z.object({
  suggestion_text: z.string().min(10, "Suggestion must be at least 10 characters long."),
});

const SuggestionPage = () => {
  const { user } = useSession();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      suggestion_text: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to submit a suggestion.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('user_suggestions')
        .insert({
          user_id: user.id,
          suggestion_text: values.suggestion_text,
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: "Suggestion Submitted!",
        description: "Thank you for your feedback. We appreciate your input!",
      });
      form.reset();
    } catch (error: any) {
      console.error("Error submitting suggestion:", error);
      toast({
        title: "Error",
        description: `Failed to submit suggestion: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Submit a Suggestion</h1>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" />
            Share Your Ideas
          </CardTitle>
          <CardDescription>Have an idea for a new feature or an improvement? We'd love to hear it!</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="suggestion_text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Suggestion</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your suggestion in detail..."
                        rows={8}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  "Submit Suggestion"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default SuggestionPage;