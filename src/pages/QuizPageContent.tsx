"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, CheckCircle2, MessageSquareText, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MCQ } from '@/components/mcq-columns';
import { cn } from '@/lib/utils'; // Import cn utility for conditional class names

// Interfaces copied from QuizLayout.tsx for type consistency
interface MCQExplanation {
  id: string;
  explanation_text: string;
  image_url: string | null;
}

interface UserAnswerData {
  selectedOption: string | null;
  isCorrect: boolean | null;
  submitted: boolean;
}

interface QuizPageContentProps {
  quizQuestions: MCQ[];
  currentQuestionIndex: number;
  setCurrentQuestionIndex: (index: number | ((prev: number) => number)) => void;
  userAnswers: Map<string, UserAnswerData>;
  setUserAnswers: (answers: Map<string, UserAnswerData> | ((prev: Map<string, UserAnswerData>) => Map<string, UserAnswerData>)) => void;
  selectedAnswer: string | null;
  setSelectedAnswer: (answer: string | null) => void;
  feedback: string | null;
  setFeedback: (feedback: string | null) => void;
  showExplanation: boolean;
  setShowExplanation: (show: boolean) => void;
  isSubmittingAnswer: boolean;
  setIsSubmittingAnswer: (submitting: boolean) => void;
  isTrialActiveSession: boolean;
  fetchExplanation: (explanationId: string) => Promise<MCQExplanation | null>;
  submitFullQuiz: () => Promise<void>;
  handleBackToSelection: () => void;
  handleSaveProgress: () => void;
  isFeedbackDialogOpen: boolean;
  setIsFeedbackDialogOpen: (open: boolean) => void;
  feedbackText: string;
  setFeedbackText: (text: string) => void;
  isSubmittingFeedback: boolean;
  setIsSubmittingFeedback: (submitting: boolean) => void;
  explanations: Map<string, MCQExplanation>;
  user: any; // User object from session
}

const TRIAL_MCQ_LIMIT = 10; // Keep for display logic

const QuizPageContent = ({
  quizQuestions,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  userAnswers,
  setUserAnswers,
  selectedAnswer,
  setSelectedAnswer,
  feedback,
  setFeedback,
  showExplanation,
  setShowExplanation,
  isSubmittingAnswer,
  setIsSubmittingAnswer,
  isTrialActiveSession,
  fetchExplanation,
  submitFullQuiz,
  handleBackToSelection,
  handleSaveProgress,
  isFeedbackDialogOpen,
  setIsFeedbackDialogOpen,
  feedbackText,
  setFeedbackText,
  isSubmittingFeedback,
  setIsSubmittingFeedback,
  explanations,
  user,
}: QuizPageContentProps) => {
  const { toast } = useToast();

  const currentMcq = quizQuestions[currentQuestionIndex];

  const handleOptionSelect = useCallback((value: string) => {
    if (currentMcq) {
      setSelectedAnswer(value);
      setUserAnswers((prev: Map<string, UserAnswerData>) => {
        const newMap = new Map(prev);
        newMap.set(currentMcq.id, { selectedOption: value, isCorrect: null, submitted: false });
        return newMap;
      });
      setFeedback(null);
      setShowExplanation(false);
    }
  }, [currentMcq, setUserAnswers, setSelectedAnswer, setFeedback, setShowExplanation]);

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !currentMcq) return;

    setIsSubmittingAnswer(true);
    const isCorrect = selectedAnswer === currentMcq.correct_answer;
    if (isCorrect) {
      setFeedback('Correct!');
    } else {
      setFeedback(`Incorrect. The correct answer was ${currentMcq.correct_answer}.`);
    }
    setShowExplanation(true);

    setUserAnswers((prev: Map<string, UserAnswerData>) => {
      const newMap = new Map(prev);
      newMap.set(currentMcq.id, { selectedOption: selectedAnswer, isCorrect: isCorrect, submitted: true });
      return newMap;
    });

    if (user) {
      try {
        const firstCategoryLink = currentMcq.category_links?.[0];
        const { error } = await supabase.from('user_quiz_attempts').insert({
          user_id: user.id,
          mcq_id: currentMcq.id,
          category_id: firstCategoryLink?.category_id || null,
          subcategory_id: firstCategoryLink?.subcategory_id || null,
          selected_option: selectedAnswer,
          is_correct: isCorrect,
        });

        if (error) {
          console.error('Error recording quiz attempt:', error);
          toast({
            title: "Error",
            description: `Failed to record quiz attempt: ${error.message}`,
            variant: "destructive",
          });
        }
      } catch (error: any) {
        console.error('Unhandled error recording quiz attempt:', error);
        toast({
          title: "Error",
          description: `An unexpected error occurred while recording your attempt: ${error.message}`,
          variant: "destructive",
        });
      }
    } else {
      console.log("Guest user, not recording quiz attempt.");
    }
    
    setIsSubmittingAnswer(false);
    if (currentMcq.explanation_id) {
      fetchExplanation(currentMcq.explanation_id);
    }
  };

  const handleNextQuestion = () => {
    if (isTrialActiveSession && currentQuestionIndex + 1 >= TRIAL_MCQ_LIMIT) {
      toast({ title: "Trial Limit Reached", description: "You have reached the limit for trial questions. Please subscribe to continue.", variant: "default" });
      submitFullQuiz();
      return;
    }

    if (currentQuestionIndex < quizQuestions.length - 1) {
      const nextQuestion = quizQuestions[currentQuestionIndex + 1];
      setCurrentQuestionIndex((prev) => prev + 1);
      const nextAnswerData = userAnswers.get(nextQuestion?.id || '');
      setSelectedAnswer(nextAnswerData?.selectedOption || null);
      setFeedback(nextAnswerData?.submitted ? (nextAnswerData.isCorrect ? 'Correct!' : `Incorrect. The correct answer was ${nextQuestion.correct_answer}.`) : null);
      setShowExplanation(nextAnswerData?.submitted || false);
      if (nextAnswerData?.submitted && nextQuestion.explanation_id) {
        fetchExplanation(nextQuestion.explanation_id);
      }
    } else {
      submitFullQuiz();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      const prevQuestion = quizQuestions[currentQuestionIndex - 1];
      setCurrentQuestionIndex((prev) => prev - 1);
      const prevAnswerData = userAnswers.get(prevQuestion?.id || '');
      setSelectedAnswer(prevAnswerData?.selectedOption || null);
      setFeedback(prevAnswerData?.submitted ? (prevAnswerData.isCorrect ? 'Correct!' : `Incorrect. The correct answer was ${prevQuestion.correct_answer}.`) : null);
      setShowExplanation(prevAnswerData?.submitted || false);
      if (prevAnswerData?.submitted && prevQuestion.explanation_id) {
        fetchExplanation(prevQuestion.explanation_id);
      }
    }
  };

  const handleSubmitFeedback = async () => {
    if (!user || !currentMcq || !feedbackText.trim()) {
      toast({ title: "Error", description: "Feedback cannot be empty.", variant: "destructive" });
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      const { error: insertError } = await supabase.from('mcq_feedback').insert({
        user_id: user.id,
        mcq_id: currentMcq.id,
        feedback_text: feedbackText.trim(),
      });

      if (insertError) {
        throw insertError;
      }

      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          to: 'ADMIN_EMAIL',
          subject: `New MCQ Feedback from ${user.email}`,
          body: `User ${user.email} (${user.id}) submitted feedback for MCQ ID: ${currentMcq.id}.<br/><br/>
                 Question: ${currentMcq.question_text}<br/><br/>
                 Feedback: ${feedbackText.trim()}<br/><br/>
                 Review in admin panel (future feature).`,
        },
      });

      if (emailError) {
        console.error('Error sending feedback email:', emailError);
        toast({ title: "Warning", description: "Feedback submitted, but failed to send email notification.", variant: "default" });
      } else {
        toast({ title: "Feedback Submitted!", description: "Thank you for your notes. We will review them shortly.", variant: "default" });
      }

      setFeedbackText('');
      setIsFeedbackDialogOpen(false);
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      toast({ title: "Error", description: `Failed to submit feedback: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  if (!currentMcq) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading current question...</p>
      </div>
    );
  }

  const currentAnswerData = userAnswers.get(currentMcq.id);
  const isAnswered = currentAnswerData?.selectedOption !== null;
  const isSubmitted = currentAnswerData?.submitted;
  const isLastQuestion = currentQuestionIndex === quizQuestions.length - 1;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="text-xl">Question {currentQuestionIndex + 1} / {quizQuestions.length}</CardTitle>
        {isTrialActiveSession && (
          <CardDescription className="text-sm text-blue-500 dark:text-blue-400">
            Trial Mode ({currentQuestionIndex + 1} / {TRIAL_MCQ_LIMIT} questions)
          </CardDescription>
        )}
        {currentMcq?.difficulty && (
          <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
            Difficulty: {currentMcq.difficulty}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-lg font-semibold mb-4">{currentMcq?.question_text}</p>
        <RadioGroup
          onValueChange={handleOptionSelect}
          value={selectedAnswer || ""}
          className="space-y-2"
          disabled={isSubmitted} // Disable radio group if already submitted
        >
          {['A', 'B', 'C', 'D'].map((optionKey) => {
            const optionText = currentMcq?.[`option_${optionKey.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'];
            const userSelectedThisOptionWhenSubmitted = currentAnswerData?.selectedOption === optionKey;
            const isCorrectOption = currentMcq.correct_answer === optionKey;

            return (
              <div
                key={optionKey}
                className={cn(
                  "flex items-center space-x-2 p-2 rounded-md cursor-pointer transition-colors duration-200",
                  isSubmitted && userSelectedThisOptionWhenSubmitted && currentAnswerData?.isCorrect && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                  isSubmitted && userSelectedThisOptionWhenSubmitted && !currentAnswerData?.isCorrect && "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
                  isSubmitted && !userSelectedThisOptionWhenSubmitted && isCorrectOption && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                  !isSubmitted && selectedAnswer === optionKey && "bg-accent text-accent-foreground dark:bg-accent dark:text-accent-foreground"
                )}
                onClick={() => !isSubmitted && handleOptionSelect(optionKey)}
              >
                <RadioGroupItem value={optionKey} id={`option-${optionKey}`} />
                <Label
                  htmlFor={`option-${optionKey}`}
                  className={cn(
                    "cursor-pointer flex-grow",
                    isSubmitted && userSelectedThisOptionWhenSubmitted && currentAnswerData?.isCorrect && "text-green-700 dark:text-green-300",
                    isSubmitted && userSelectedThisOptionWhenSubmitted && !currentAnswerData?.isCorrect && "text-red-700 dark:text-red-300",
                    isSubmitted && !userSelectedThisOptionWhenSubmitted && isCorrectOption && "text-green-700 dark:text-green-300",
                    !isSubmitted && selectedAnswer === optionKey && "text-accent-foreground dark:text-accent-foreground"
                  )}
                >
                  {`${optionKey}. ${optionText as string}`}
                </Label>
              </div>
            );
          })}
        </RadioGroup>

        {feedback && (
          <p className={`mt-4 text-lg font-semibold flex items-center gap-2 ${feedback.startsWith('Correct') ? 'text-green-600' : 'text-red-600'}`}>
            {feedback.startsWith('Correct') ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            {feedback}
          </p>
        )}

        {showExplanation && explanations.has(currentMcq.explanation_id || '') && (
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
            <h3 className="text-lg font-semibold mb-2">Explanation:</h3>
            <p className="text-gray-800 dark:text-gray-200">{explanations.get(currentMcq.explanation_id || '')?.explanation_text}</p>
            {explanations.get(currentMcq.explanation_id || '')?.image_url && (
              <img src={explanations.get(currentMcq.explanation_id || '')?.image_url || ''} alt="Explanation" className="mt-4 max-w-full h-auto rounded-md" />
            )}
            {user && (
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => setIsFeedbackDialogOpen(true)}
              >
                <MessageSquareText className="h-4 w-4 mr-2" /> Add Notes or Feedback
              </Button>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-between gap-2">
        <div className="flex gap-2">
          <Button onClick={handleBackToSelection} variant="outline" disabled={isSubmittingAnswer}>
            Back to Selection
          </Button>
          <Button onClick={handleSaveProgress} variant="secondary" disabled={isSubmittingAnswer || !user}>
            <Save className="h-4 w-4 mr-2" /> Save Progress
          </Button>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0 || isSubmittingAnswer} variant="outline">
            Previous
          </Button>
          {!isSubmitted ? (
            <Button onClick={handleSubmitAnswer} disabled={!isAnswered || isSubmittingAnswer}>
              {isSubmittingAnswer ? "Submitting..." : "Submit Answer"}
            </Button>
          ) : (
            <Button onClick={handleNextQuestion} disabled={isSubmittingAnswer}>
              {isLastQuestion ? "Submit Quiz" : "Next Question"}
            </Button>
          )}
        </div>
      </CardFooter>

      <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Notes or Feedback for this MCQ</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              Your feedback helps us improve the questions and explanations.
            </p>
            <Textarea
              placeholder="Write your notes or feedback here..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={5}
              disabled={isSubmittingFeedback}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFeedbackDialogOpen(false)} disabled={isSubmittingFeedback}>Cancel</Button>
            <Button onClick={handleSubmitFeedback} disabled={isSubmittingFeedback || !feedbackText.trim()}>
              {isSubmittingFeedback ? "Submitting..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default QuizPageContent;