"use client";

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

interface FlashcardProps {
  front: string;
  back: string;
  isFlipped: boolean;
  onFlip: () => void;
}

const Flashcard = ({ front, back, isFlipped, onFlip }: FlashcardProps) => {
  return (
    <div 
      className="group perspective-1000 w-full max-w-2xl h-[400px] cursor-pointer"
      onClick={onFlip}
    >
      <div className={cn(
        "relative w-full h-full duration-500 preserve-3d transition-transform",
        isFlipped ? "rotate-y-180" : ""
      )}>
        {/* Front Face */}
        <Card className="absolute inset-0 backface-hidden flex flex-col items-center justify-center p-8 text-center shadow-xl border-2 border-primary/10 rounded-3xl bg-white">
          <div className="absolute top-4 left-4">
             <span className="text-[10px] font-black uppercase tracking-widest text-primary/40 bg-primary/5 px-3 py-1 rounded-full">Question / Scenario</span>
          </div>
          <div className="prose dark:prose-invert max-w-none text-xl font-bold leading-relaxed text-slate-800">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{front}</ReactMarkdown>
          </div>
          <p className="mt-8 text-xs text-muted-foreground font-medium uppercase tracking-tighter animate-pulse">Click to Reveal Answer</p>
        </Card>

        {/* Back Face */}
        <Card className="absolute inset-0 backface-hidden rotate-y-180 flex flex-col items-center justify-center p-8 text-center shadow-xl border-2 border-green-500/20 rounded-3xl bg-green-50/10">
          <div className="absolute top-4 left-4">
             <span className="text-[10px] font-black uppercase tracking-widest text-green-600 bg-green-100 px-3 py-1 rounded-full">Clinical Pearl</span>
          </div>
          <div className="prose dark:prose-invert max-w-none text-lg font-medium leading-relaxed text-slate-700">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{back}</ReactMarkdown>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Flashcard;