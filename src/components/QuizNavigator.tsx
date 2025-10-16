"use client";

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle } from 'lucide-react';
import { MCQ } from './mcq-columns'; // Import MCQ from mcq-columns

interface QuizNavigatorProps {
  mcqs: MCQ[];
  userAnswers: Map<string, string | null>;
  currentQuestionIndex: number;
  goToQuestion: (index: number) => void;
  showResults: boolean;
  score: number;
}

const QuizNavigator = ({ mcqs, userAnswers, currentQuestionIndex, goToQuestion, showResults, score }: QuizNavigatorProps) => {
  const totalQuestions = mcqs.length;
  const correctPercentage = totalQuestions > 0 ? ((score / totalQuestions) * 100).toFixed(2) : '0.00';

  return (
    <div className="w-full md:w-64 p-4 bg-card border-r border-border flex flex-col gap-4">
      <h3 className="text-lg font-semibold mb-2">Quiz Progress</h3>
      <div className="grid grid-cols-5 gap-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        {mcqs.map((mcq, index) => {
          const userAnswer = userAnswers.get(mcq.id);
          const isAnswered = userAnswer !== undefined && userAnswer !== null;
          const isCorrect = isAnswered && userAnswer === mcq.correct_answer;
          const isCurrent = index === currentQuestionIndex;

          let buttonClass = "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium";
          let icon = null;

          if (showResults) {
            if (isCorrect) {
              buttonClass += " bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
              icon = <CheckCircle2 className="h-4 w-4" />;
            } else if (isAnswered) {
              buttonClass += " bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
              icon = <XCircle className="h-4 w-4" />;
            } else {
              buttonClass += " bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
            }
          } else if (isAnswered) {
            buttonClass += " bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
          } else {
            buttonClass += " bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
          }

          if (isCurrent) {
            buttonClass += " ring-2 ring-primary ring-offset-2";
          }

          return (
            <Button
              key={mcq.id}
              variant="ghost"
              className={cn(buttonClass, "p-0")}
              onClick={() => goToQuestion(index)}
              title={`Question ${index + 1}`}
            >
              {icon || (index + 1)}
            </Button>
          );
        })}
      </div>
      {showResults && (
        <div className="mt-4 p-3 border rounded-md bg-background dark:bg-gray-800 text-center">
          <p className="text-sm text-muted-foreground">Overall Accuracy:</p>
          <p className="text-2xl font-bold text-primary">{correctPercentage}%</p>
          <p className="text-sm text-muted-foreground">({score} / {totalQuestions} Correct)</p>
        </div>
      )}
    </div>
  );
};

export default QuizNavigator;