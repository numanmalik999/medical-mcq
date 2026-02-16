"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Loader2, Wand2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const formSchema = z.object({
  front_text: z.string().min(1, "Front text is required."),
  back_text: z.string().min(1, "Back text is required."),
  category_id: z.string().uuid().nullable(),
  mcq_id: z.string().uuid().nullable(),
});

interface EditFlashcardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: any | null;
  onSave: () => void;
}

const EditFlashcardDialog = ({ open, onOpenChange, card, onSave }: EditFlashcardDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [mcqSearchId, setMcqSearchId] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { front_text: "", back_text: "", category_id: null, mcq_id: null },
  });

  useEffect(() => {
    const fetchCats = async () => {
      const { data } = await supabase.from('categories').select('id, name').order('name');
      setCategories(data || []);
    };
    if (open) fetchCats();
  }, [open]);

  useEffect(() => {
    if (card && open) {
      form.reset({
        front_text: card.front_text,
        back_text: card.back_text,
        category_id: card.category_id,
        mcq_id: card.mcq_id,
      });
    } else if (!open) {
      form.reset({ front_text: "", back_text: "", category_id: null, mcq_id: null });
      setMcqSearchId('');
    }
  }, [card, open, form]);

  const handleGenerateFromMcq = async () => {
    if (!mcqSearchId) return;
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-flashcard', {
        body: { mcq_id: mcqSearchId },
      });
      if (error) throw error;
      form.setValue('front_text', data.front);
      form.setValue('back_text', data.back);
      form.setValue('mcq_id', mcqSearchId);
      toast({ title: "AI Generation Complete" });
    } catch (e: any) {
      toast({ title: "Generation Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const { error } = card?.id 
        ? await supabase.from('flashcards').update(values).eq('id', card.id)
        : await supabase.from('flashcards').insert(values);

      if (error) throw error;
      toast({ title: "Success", description: "Flashcard saved." });
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{card ? 'Edit Flashcard' : 'Add New Flashcard'}</DialogTitle>
          <DialogDescription>Manually create a card or generate one from an existing MCQ.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="p-4 bg-muted/50 rounded-xl border-2 border-dashed space-y-3">
             <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                <Wand2 className="h-3 w-3" /> AI Accelerator
             </div>
             <div className="flex gap-2">
                <Input 
                  placeholder="Paste MCQ ID here..." 
                  value={mcqSearchId} 
                  onChange={e => setMcqSearchId(e.target.value)}
                  className="bg-white"
                />
                <Button onClick={handleGenerateFromMcq} disabled={isGenerating || !mcqSearchId} variant="secondary">
                   {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Auto-Generate"}
                </Button>
             </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="category_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select specialty..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="front_text" render={({ field }) => (
                <FormItem><FormLabel>Front (Question/Scenario)</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
              )} />

              <FormField control={form.control} name="back_text" render={({ field }) => (
                <FormItem><FormLabel>Back (Key Clinical Pearl)</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
              )} />

              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Flashcard
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditFlashcardDialog;