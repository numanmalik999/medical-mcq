"use client";

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useSession } from './SessionContextProvider';

interface BulkGenerateTopicsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  onSave: () => void;
}

const BulkGenerateTopicsDialog = ({ open, onOpenChange, courseId, onSave }: BulkGenerateTopicsDialogProps) => {
  const { toast } = useToast();
  const { user } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [topicTitles, setTopicTitles] = useState('');

  const handleGenerate = async () => {
    const titles = topicTitles.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    if (titles.length === 0) {
      toast({ title: "Error", description: "Please enter at least one topic title.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-generate-course-topics', {
        body: {
          course_id: courseId,
          topic_titles: titles,
          user_id: user?.id,
        },
      });

      if (error) throw error;

      if (data.errorCount > 0) {
        toast({
          title: "Partial Success",
          description: `Generated ${data.successCount} topics. ${data.errorCount} failed. Check console for details.`,
          variant: "default",
        });
        console.error("Bulk Generate Errors:", data.errors);
      } else {
        toast({ title: "Success!", description: `Successfully generated ${data.successCount} topics.` });
      }
      
      onSave();
      onOpenChange(false);
      setTopicTitles('');
    } catch (error: any) {
      console.error("Error bulk generating topics:", error);
      toast({
        title: "Error",
        description: `Failed to generate topics: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bulk Generate Topics with AI</DialogTitle>
          <DialogDescription>
            Paste a list of topic titles below, one per line. The AI will generate content for each one.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea
            placeholder="Myocardial Infarction&#10;Atrial Fibrillation&#10;Pneumonia..."
            rows={15}
            value={topicTitles}
            onChange={(e) => setTopicTitles(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSubmitting ? `Generating ${topicTitles.split('\n').filter(t => t.trim()).length} Topics...` : "Generate Topics"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkGenerateTopicsDialog;