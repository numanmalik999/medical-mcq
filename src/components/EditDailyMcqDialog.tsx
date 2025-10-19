"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

interface DailyMcqEntry {
  id?: string;
  date: string; // YYYY-MM-DD
  mcq_id: string;
  mcq_question_text?: string; // For display purposes
}

interface MCQ {
  id: string;
  question_text: string;
}

const formSchema = z.object({
  id: z.string().uuid().optional(),
  date: z.date({ required_error: "A date is required." }),
  mcq_id: z.string().uuid({ message: "An MCQ must be selected." }),
  mcq_question_text: z.string().optional(), // For internal use, not directly submitted
});

interface EditDailyMcqDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dailyMcqEntry: DailyMcqEntry | null; // Null for adding, object for editing
  onSave: () => void; // Callback to refresh data after save
}

const EditDailyMcqDialog = ({ open, onOpenChange, dailyMcqEntry, onSave }: EditDailyMcqDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mcqSearchTerm, setMcqSearchTerm] = useState('');
  const [mcqSearchResults, setMcqSearchResults] = useState<MCQ[]>([]);
  const [isSearchingMcqs, setIsSearchingMcqs] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      mcq_id: "",
      mcq_question_text: "",
    },
  });

  useEffect(() => {
    if (dailyMcqEntry && open) {
      form.reset({
        id: dailyMcqEntry.id,
        date: new Date(dailyMcqEntry.date),
        mcq_id: dailyMcqEntry.mcq_id,
        mcq_question_text: dailyMcqEntry.mcq_question_text || "",
      });
      setMcqSearchTerm(dailyMcqEntry.mcq_question_text || "");
    } else if (!open) {
      form.reset({
        date: new Date(),
        mcq_id: "",
        mcq_question_text: "",
      }); // Reset form when dialog closes
      setMcqSearchTerm('');
      setMcqSearchResults([]);
    }
  }, [dailyMcqEntry, open, form]);

  const searchMcqs = useCallback(async (term: string) => {
    if (term.length < 3) {
      setMcqSearchResults([]);
      return;
    }
    setIsSearchingMcqs(true);
    const { data, error } = await supabase
      .from('mcqs')
      .select('id, question_text')
      .ilike('question_text', `%${term}%`)
      .limit(10);

    if (error) {
      console.error('Error searching MCQs:', error);
      toast({ title: "Error", description: "Failed to search MCQs.", variant: "destructive" });
      setMcqSearchResults([]);
    } else {
      setMcqSearchResults(data || []);
    }
    setIsSearchingMcqs(false);
  }, [toast]);

  useEffect(() => {
    const handler = setTimeout(() => {
      searchMcqs(mcqSearchTerm);
    }, 500); // Debounce search

    return () => {
      clearTimeout(handler);
    };
  }, [mcqSearchTerm, searchMcqs]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const formattedDate = format(values.date, 'yyyy-MM-dd');
      const dailyMcqData = {
        date: formattedDate,
        mcq_id: values.mcq_id,
      };

      if (dailyMcqEntry?.id) {
        // Update existing daily MCQ
        const { error } = await supabase
          .from('daily_mcqs')
          .update(dailyMcqData)
          .eq('id', dailyMcqEntry.id);

        if (error) throw error;
        toast({ title: "Success!", description: "Daily MCQ updated successfully." });
      } else {
        // Add new daily MCQ
        const { error } = await supabase
          .from('daily_mcqs')
          .insert(dailyMcqData);

        if (error) throw error;
        toast({ title: "Success!", description: "Daily MCQ added successfully." });
      }

      onSave(); // Refresh data in parent component
      onOpenChange(false); // Close dialog
    } catch (error: any) {
      console.error("Error saving daily MCQ:", error);
      toast({
        title: "Error",
        description: `Failed to save daily MCQ: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dailyMcqEntry ? 'Edit Daily MCQ' : 'Add New Daily MCQ'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mcq_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Select MCQ</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? mcqSearchResults.find((mcq) => mcq.id === field.value)?.question_text || form.getValues('mcq_question_text') || "Search and select MCQ"
                            : "Search and select MCQ"}
                          <Loader2 className={cn("ml-2 h-4 w-4 shrink-0 opacity-0", isSearchingMcqs && "animate-spin opacity-100")} />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search MCQs..."
                          value={mcqSearchTerm}
                          onValueChange={setMcqSearchTerm}
                        />
                        <CommandList>
                          {isSearchingMcqs && mcqSearchTerm.length >= 3 ? (
                            <CommandEmpty>Searching...</CommandEmpty>
                          ) : (
                            <CommandEmpty>No MCQ found.</CommandEmpty>
                          )}
                          <CommandGroup>
                            {mcqSearchResults.map((mcq) => (
                              <CommandItem
                                value={mcq.question_text}
                                key={mcq.id}
                                onSelect={() => {
                                  form.setValue("mcq_id", mcq.id);
                                  form.setValue("mcq_question_text", mcq.question_text);
                                  setMcqSearchTerm(mcq.question_text); // Keep selected text in search input
                                }}
                              >
                                {mcq.question_text}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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

export default EditDailyMcqDialog;