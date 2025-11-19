"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

interface StructuredTopicContent {
  title: string;
  definition: string;
  main_causes: string;
  symptoms: string;
  diagnostic_tests: string;
  diagnostic_criteria: string;
  treatment_management: string;
  youtube_embed_code: string;
}

interface TopicContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicContent: StructuredTopicContent | null;
}

const TopicContentDialog = ({ open, onOpenChange, topicContent }: TopicContentDialogProps) => {
  if (!topicContent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{topicContent.title}</DialogTitle>
          <DialogDescription>Detailed information on this topic.</DialogDescription>
        </DialogHeader>
        <div className="py-4 prose dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:underline">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{topicContent.definition || ''}</ReactMarkdown>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{topicContent.main_causes || ''}</ReactMarkdown>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{topicContent.symptoms || ''}</ReactMarkdown>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{topicContent.diagnostic_tests || ''}</ReactMarkdown>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{topicContent.diagnostic_criteria || ''}</ReactMarkdown>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{topicContent.treatment_management || ''}</ReactMarkdown>
          {topicContent.youtube_embed_code && (
            <div className="aspect-video mt-6" dangerouslySetInnerHTML={{ __html: topicContent.youtube_embed_code }} />
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TopicContentDialog;