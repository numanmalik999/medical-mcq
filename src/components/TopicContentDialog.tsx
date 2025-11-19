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
  youtube_video_id: string;
}

interface TopicContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicContent: StructuredTopicContent | null;
}

const safeStringify = (content: any): string => {
  if (typeof content === 'string') {
    return content;
  }
  if (content === null || content === undefined) {
    return '';
  }
  if (Array.isArray(content)) {
    return `<ul>${content.map(item => `<li>${String(item)}</li>`).join('')}</ul>`;
  }
  if (typeof content === 'object') {
    return Object.entries(content)
      .map(([key, value]) => `<p><strong>${key.replace(/_/g, ' ')}:</strong> ${String(value)}</p>`)
      .join('');
  }
  return String(content);
};

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
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{safeStringify(topicContent.definition)}</ReactMarkdown>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{safeStringify(topicContent.main_causes)}</ReactMarkdown>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{safeStringify(topicContent.symptoms)}</ReactMarkdown>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{safeStringify(topicContent.diagnostic_tests)}</ReactMarkdown>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{safeStringify(topicContent.diagnostic_criteria)}</ReactMarkdown>
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{safeStringify(topicContent.treatment_management)}</ReactMarkdown>
          {topicContent.youtube_video_id && (
            <div className="aspect-video mt-6">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${topicContent.youtube_video_id}`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
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