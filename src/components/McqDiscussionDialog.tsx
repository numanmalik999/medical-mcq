"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import McqDiscussion from './McqDiscussion';

interface McqDiscussionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mcqId: string;
  questionText?: string;
}

const McqDiscussionDialog = ({ open, onOpenChange, mcqId, questionText }: McqDiscussionDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] rounded-3xl p-6 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight">Question Discussion</DialogTitle>
          {questionText && (
            <DialogDescription className="line-clamp-2 italic text-xs mt-1">
              "{questionText}"
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="pt-4">
          <McqDiscussion mcqId={mcqId} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default McqDiscussionDialog;