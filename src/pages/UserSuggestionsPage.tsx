"use client";

import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface UserSuggestion {
  id: string;
  suggestion_text: string;
  status: 'pending' | 'reviewed' | 'implemented' | 'rejected';
  admin_notes: string | null;
  created_at: string;
}

const formSchema = z.object({
  suggestion_text: z.string().min(10, "Suggestion must be at least 10 characters long."),
});

const UserSuggestionsPage = () => {
  const { user } = useSession();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      suggestion_text: "",
    },
  });

  const fetchUserSuggestions = async () => {
    if (!user) {
      setIsLoadingSuggestions(false);
      return;
    }
    setIsLoadingSuggestions(true);
    try {
      const { data, error } = await supabase
        .from('user_suggestions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error: any) {
      console.error("Error fetching user suggestions:", error);
      toast({ title: "Error", description: "Failed to load your suggestions.", variant: "destructive" });
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserSuggestions();
    } else {
      setIsLoadingSuggestions(false);
    }
  }, [user]);

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
      fetchUserSuggestions(); // Refresh the list after submitting
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
    <div className="space-y-8">
      <Card className="w-full max-w-3xl">
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
                        rows={6}
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

      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Your Past Suggestions</CardTitle>
          <CardDescription>Track the status of your submitted ideas.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSuggestions ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-center text-muted-foreground">You haven't submitted any suggestions yet.</p>
          ) : (
            <div className="space-y-4">
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="border p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-2">
                    Submitted on {format(new Date(suggestion.created_at), 'PPP')}
                  </p>
                  <p className="mb-3">{suggestion.suggestion_text}</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">Status: </span>
                      <Badge variant={
                        suggestion.status === 'implemented' ? 'default' :
                        suggestion.status === 'rejected' ? 'destructive' :
                        suggestion.status === 'reviewed' ? 'secondary' : 'outline'
                      }>
                        {suggestion.status}
                      </Badge>
                    </div>
                  </div>
                  {suggestion.admin_notes && (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-sm font-semibold">Admin Notes:</p>
                      <p className="text-sm text-muted-foreground italic">"{suggestion.admin_notes}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <MadeWithDyad />
    </div>
  );
};

export default UserSuggestionsPage;