"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, SkipForward } from "lucide-react"; // Import SkipForward
import { cn } from "@/lib/utils"; // Import cn utility

// New interface for userAnswers map value, matching QuizPage
interface UserAnswerData {
  selectedOption: string | null;
  isCorrect: boolean | null;
  submitted: boolean;
}

export type McqCategoryLink = {
  category_id: string;
  category_name: string; // For display
};

export type MCQ = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation_id: string | null;
  difficulty: string | null;
  is_trial_mcq: boolean | null;
  // New: Array of category links
  category_links: McqCategoryLink[];
};

interface QuizNavigatorProps {
  mcqs: MCQ[];
  userAnswers: Map<string, UserAnswerData>; // Updated type
  currentQuestionIndex: number;
  goToQuestion: (index: number) => void;
  showResults: boolean;
  score: number;
  skippedMcqIds?: Set<string>; // New prop for skipped questions in test mode
}

const QuizNavigator = ({ mcqs, userAnswers, currentQuestionIndex, goToQuestion, showResults, score, skippedMcqIds }: QuizNavigatorProps) => {
  const totalQuestions = mcqs.length;
  const correctPercentage = totalQuestions > 0 ? ((score / totalQuestions) * 100).toFixed(2) : '0.00';

  return (
    <div className="w-full md:w-64 p-4 bg-card border-r border-border flex flex-col gap-4">
      <h3 className="text-lg font-semibold mb-2">Quiz Progress</h3>
      <div className="grid grid-cols-5 gap-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        {mcqs.map((mcq, index) => {
          const userAnswerData = userAnswers.get(mcq.id);
          const isAnswered = userAnswerData?.selectedOption !== null;
          const isCorrect = userAnswerData?.isCorrect;
          const isCurrent = index === currentQuestionIndex;
          const isSkipped = skippedMcqIds?.has(mcq.id); // Check if explicitly skipped

          let buttonClass = "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium";
          let icon = null;

          if (showResults) {
            // Logic for final results view (after test submission)
            if (isCorrect) {
              buttonClass += " !bg-green-100 !text-green-700 dark:!bg-green-900 dark:!text-green-300";
              icon = <CheckCircle2 className="h-4 w-4" />;
            } else if (isAnswered && !isCorrect) { // Answered incorrectly
              buttonClass += " !bg-red-100 !text-red-700 dark:!bg-red-900 dark:!text-red-300";
              icon = <XCircle className="h-4 w-4" />;
            } else { // Not answered (could be skipped or just not touched)
              buttonClass += " bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
            }
          } else {
            // Logic for quiz/test in progress
            if (isAnswered) {
              if (isCorrect) { // Answered correctly
                buttonClass += " !bg-green-100 !text-green-700 dark:!bg-green-900 dark:!text-green-300";
                icon = <CheckCircle2 className="h-4 w-4" />;
              } else { // Answered incorrectly
                buttonClass += " !bg-red-100 !text-red-700 dark:!bg-red-900 dark:!text-red-300";
                icon = <XCircle className="h-4 w-4" />;
              }
            } else if (isSkipped) {
              buttonClass += " !bg-yellow-100 !text-yellow-700 dark:!bg-yellow-900 dark:!text-yellow-300"; // Skipped
              icon = <SkipForward className="h-4 w-4" />;
            } else {
              buttonClass += " bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"; // Unanswered/Unvisited
            }
          }

          if (isCurrent) {
            buttonClass += " ring-2 ring-primary ring-offset-2";
          }

          return (
            <Button
              key={mcq.id}
              variant="ghost" // Keep ghost variant for base styling, !bg- will override
              className={cn(buttonClass, "p-0 relative")}
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