"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { McqFeedback } from '@/pages/ManageMcqFeedbackPage'; // Import the interface
import { Badge } from '@/components/ui/badge'; // Import Badge

interface ReviewFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedback: McqFeedback;
  onSave: () => void; // Callback to refresh data after save
}

const ReviewFeedbackDialog = ({ open, onOpenChange, feedback, onSave }: ReviewFeedbackDialogProps) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(feedback.status);

  useEffect(() => {
    if (open) {
      setCurrentStatus(feedback.status);
    }
  }, [feedback, open]);

  const handleMarkAsReviewed = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('mcq_feedback')
        .update({ status: 'reviewed' })
        .eq('id', feedback.id);

      if (error) throw error;

      toast({ title: "Success!", description: "Feedback marked as reviewed.", variant: "default" });
      setCurrentStatus('reviewed'); // Update local state
      onSave(); // Refresh parent list
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error marking feedback as reviewed:", error);
      toast({
        title: "Error",
        description: `Failed to mark feedback as reviewed: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review MCQ Feedback</DialogTitle>
          <DialogDescription>
            From: {feedback.user_email || 'N/A'} | Question: {feedback.mcq_question_text?.substring(0, 50)}...
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Feedback Details:</h3>
            <p className="text-sm text-muted-foreground">Submitted on: {new Date(feedback.created_at).toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Current Status: <Badge variant={currentStatus === 'reviewed' ? "default" : "outline"}>{currentStatus}</Badge></p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Feedback Text:</h3>
            <Textarea
              value={feedback.feedback_text}
              readOnly
              rows={8}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button" disabled={isProcessing}>Close</Button>
          {currentStatus === 'pending' && (
            <Button onClick={handleMarkAsReviewed} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Mark as Reviewed
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewFeedbackDialog;