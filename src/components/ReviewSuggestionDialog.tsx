"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export interface UserSuggestion {
  id: string;
  user_id: string;
  suggestion_text: string;
  status: 'pending' | 'reviewed' | 'implemented' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  user_email?: string;
}

interface ReviewSuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestion: UserSuggestion;
  onSave: () => void;
}

const ReviewSuggestionDialog = ({ open, onOpenChange, suggestion, onSave }: ReviewSuggestionDialogProps) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(suggestion.status);
  const [adminNotes, setAdminNotes] = useState(suggestion.admin_notes || '');

  useEffect(() => {
    if (open) {
      setCurrentStatus(suggestion.status);
      setAdminNotes(suggestion.admin_notes || '');
    }
  }, [suggestion, open]);

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('user_suggestions')
        .update({ status: currentStatus, admin_notes: adminNotes })
        .eq('id', suggestion.id);

      if (error) throw error;

      toast({ title: "Success!", description: "Suggestion status updated.", variant: "default" });
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating suggestion:", error);
      toast({
        title: "Error",
        description: `Failed to update suggestion: ${error.message || 'Unknown error'}`,
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
          <DialogTitle>Review Suggestion</DialogTitle>
          <DialogDescription>
            From: {suggestion.user_email || 'N/A'} | Submitted: {new Date(suggestion.created_at).toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <h3 className="font-semibold">Suggestion Text:</h3>
            <Textarea
              value={suggestion.suggestion_text}
              readOnly
              rows={8}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status-select">Status</Label>
            <Select value={currentStatus} onValueChange={(value) => setCurrentStatus(value as UserSuggestion['status'])}>
              <SelectTrigger id="status-select">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="implemented">Implemented</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-notes">Admin Notes (Optional)</Label>
            <Textarea
              id="admin-notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add internal notes or feedback for the user..."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button" disabled={isProcessing}>Close</Button>
          <Button onClick={handleSave} disabled={isProcessing}>
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewSuggestionDialog;