"use client";

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

interface ExplanationDisplayProps {
  explanationText: string;
  onDiagnosisClick: (diagnosisTitle: string) => void;
}

const ExplanationDisplay = ({ explanationText, onDiagnosisClick }: ExplanationDisplayProps) => {
  const contentWithClickableDiagnosis = useMemo(() => {
    const regex = /(<h2[^>]*>The Diagnosis<\/h2>\s*<p[^>]*>)([^<]+)(<\/p>)/i;
    const match = explanationText.match(regex);
    if (match && match[2]) {
      const diagnosis = match[2].trim();
      return explanationText.replace(
        regex,
        `$1<button data-diagnosis="${diagnosis}" class="diagnosis-button">${diagnosis}</button>$3`
      );
    }
    return explanationText;
  }, [explanationText]);

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' && target.dataset.diagnosis) {
      onDiagnosisClick(target.dataset.diagnosis);
    }
  };

  return (
    <div
      onClick={handleContentClick}
      className="prose dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:underline [&_.diagnosis-button]:text-blue-600 [&_.diagnosis-button]:font-semibold [&_.diagnosis-button]:underline [&_.diagnosis-button]:cursor-pointer"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {contentWithClickableDiagnosis}
      </ReactMarkdown>
    </div>
  );
};

export default ExplanationDisplay;