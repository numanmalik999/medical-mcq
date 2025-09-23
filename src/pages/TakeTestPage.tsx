"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/components/SessionContextProvider';
import { useNavigate } from 'react-router-dom';
import { TimerIcon } from 'lucide-react';

interface MCQ {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  difficulty: string | null;
}

interface MCQExplanation {
  id: string;
  explanation_text: string;
  image_url: string | null;
}

const TOTAL_QUESTIONS = 300;
const TEST_DURATION_SECONDS = 3 * 60 * 60; // 3 hours

const TakeTestPage = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Map<string, string | null>>(new Map());
  const [isTestSubmitted, setIsTestSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [timer, setTimer] = useState(TEST_DURATION_SECONDS);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [explanations, setExplanations] = useState<Map<string, MCQExplanation>>(new Map());

  // Memoized function to fetch a single explanation
  const fetchExplanation = useCallback(async (explanationId: string): Promise<MCQExplanation | null> => {
    if (explanations.has(explanationId)) {
      return explanations.get(explanationId)!;
    }
    const { data, error } = await supabase
      .from('mcq_explanations')
      .select('*')
      .eq('id', explanationId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Supabase Error fetching explanation:', error);
      toast({
        title: "Error",
        description: `Failed to load explanation: ${error.message || 'Unknown error'}.`,
        variant: "destructive",
      });
      return null;
    } else if (data) {
      setExplanations(prev => new Map(prev).set(explanationId, data));
      return data;
    }
    return null;
  }, [explanations, toast]);

  // Fetch MCQs
  useEffect(() => {
    const fetchAllMcqsAndSelectRandom = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('mcqs')
        .select('*');

      if (error) {
        console.error('Error fetching MCQs:', error);
        toast({ title: "Error", description: "Failed to load test questions.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        toast({ title: "No MCQs", description: "No MCQs available to create a test.", variant: "default" });
        setIsLoading(false);
        return;
      }

      // Shuffle and select up to TOTAL_QUESTIONS
      const shuffledMcqs = data.sort(() => 0.5 - Math.random());
      const selectedMcqs = shuffledMcqs.slice(0, TOTAL_QUESTIONS);
      setMcqs(selectedMcqs);
      setIsLoading(false);
    };

    if (!isSessionLoading && user) {
      fetchAllMcqsAndSelectRandom();
    } else if (!isSessionLoading && !user) {
      navigate('/login'); // Redirect if not logged in
    }
  }, [user, isSessionLoading, navigate, toast]);

  // Timer effect
  useEffect(() => {
    if (isLoading || isTestSubmitted || showResults || mcqs.length === 0) return;

    const interval = setInterval(() => {
      setTimer((prevTimer) => {
        if (prevTimer <= 1) {
          clearInterval(interval);
          handleSubmitTest(); // Auto-submit when timer runs out
          return 0;
        }
        return prevTimer - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading, isTestSubmitted, showResults, mcqs.length]); // Added mcqs.length to dependencies to ensure timer starts after questions load

  const currentMcq = mcqs[currentQuestionIndex];

  const handleOptionSelect = useCallback((value: string) => {
    if (currentMcq) {
      setUserAnswers((prev) => new Map(prev).set(currentMcq.id, value));
    }
  }, [currentMcq]);

  const handleNext = useCallback(() => {
    if (currentQuestionIndex < mcqs.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  }, [currentQuestionIndex, mcqs.length]);

  const handlePrevious = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  }, [currentQuestionIndex]);

  const handleSubmitTest = useCallback(async () => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to submit a test.", variant: "destructive" });
      return;
    }

    setIsTestSubmitted(true);
    let correctCount = 0;
    const attemptsToRecord = [];
    const explanationPromises: Promise<MCQExplanation | null>[] = [];
    const mcqExplanationIds = new Set<string>();

    for (const mcq of mcqs) {
      const userAnswer = userAnswers.get(mcq.id);
      const isCorrect = userAnswer === mcq.correct_answer;
      if (isCorrect) {
        correctCount++;
      }
      attemptsToRecord.push({
        user_id: user.id,
        mcq_id: mcq.id,
        category_id: mcq.category_id,
        subcategory_id: mcq.subcategory_id,
        selected_option: userAnswer || 'N/A', // Store 'N/A' if not answered
        is_correct: isCorrect,
      });
      if (mcq.explanation_id && !mcqExplanationIds.has(mcq.explanation_id)) {
        mcqExplanationIds.add(mcq.explanation_id);
        explanationPromises.push(fetchExplanation(mcq.explanation_id));
      }
    }

    setScore(correctCount);

    // Fetch all explanations concurrently
    await Promise.all(explanationPromises); // fetchExplanation updates state internally

    setShowResults(true);

    // Record all attempts in a single batch insert
    if (attemptsToRecord.length > 0) {
      const { error } = await supabase.from('user_quiz_attempts').insert(attemptsToRecord);
      if (error) {
        console.error('Error recording test attempts:', error);
        toast({
          title: "Error",
          description: `Failed to record test attempts: ${error.message}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Test Submitted!",
          description: `You scored ${correctCount} out of ${mcqs.length}.`,
        });
      }
    }
  }, [user, mcqs, userAnswers, toast, fetchExplanation]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading || isSessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading test questions...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Redirect handled by useEffect
  }

  if (mcqs.length === 0 && !isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>No Test Available</CardTitle>
            <CardDescription>
              There are no MCQs available to create a test. Please add more MCQs via the admin panel.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={() => navigate('/user/dashboard')}>Go to Dashboard</Button>
          </CardFooter>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle className="text-3xl">Test Results</CardTitle>
            <CardDescription>Review your performance on the test.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center text-2xl font-bold">
              Your Score: {score} / {mcqs.length}
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto p-2 border rounded-md">
              {mcqs.map((mcq, index) => {
                const userAnswer = userAnswers.get(mcq.id);
                const isCorrect = userAnswer === mcq.correct_answer;
                const explanation = explanations.get(mcq.explanation_id || '');

                return (
                  <div key={mcq.id} className="border-b pb-4 mb-4 last:border-b-0">
                    <p className="font-semibold text-lg">
                      {index + 1}. {mcq.question_text}
                    </p>
                    <ul className="list-disc list-inside ml-4 mt-2">
                      {['A', 'B', 'C', 'D'].map((optionKey) => {
                        const optionText = mcq[`option_${optionKey.toLowerCase()}` as keyof MCQ];
                        const isSelected = userAnswer === optionKey;
                        const isCorrectOption = mcq.correct_answer === optionKey;

                        let className = "";
                        if (isSelected && isCorrect) {
                          className = "text-green-600 font-medium";
                        } else if (isSelected && !isCorrect) {
                          className = "text-red-600 font-medium";
                        } else if (isCorrectOption) {
                          className = "text-green-600 font-medium";
                        }

                        return (
                          <li key={optionKey} className={className}>
                            {optionKey}. {optionText}
                            {isSelected && !isCorrect && <span className="ml-2">(Your Answer)</span>}
                            {isCorrectOption && <span className="ml-2">(Correct Answer)</span>}
                          </li>
                        );
                      })}
                    </ul>
                    {explanation && (
                      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-sm">
                        <h4 className="font-semibold">Explanation:</h4>
                        <p>{explanation.explanation_text}</p>
                        {explanation.image_url && (
                          <img src={explanation.image_url} alt="Explanation" className="mt-2 max-w-full h-auto rounded-md" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => navigate('/user/dashboard')}>Back to Dashboard</Button>
          </CardFooter>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">Question {currentQuestionIndex + 1} / {mcqs.length}</CardTitle>
            <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
              {currentMcq?.difficulty && `Difficulty: ${currentMcq.difficulty}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-lg font-medium">
            <TimerIcon className="h-5 w-5" />
            <span>{formatTime(timer)}</span>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold mb-4">{currentMcq?.question_text}</p>
          <RadioGroup
            onValueChange={handleOptionSelect}
            value={userAnswers.get(currentMcq?.id || '') || ''}
            className="space-y-2"
          >
            {['A', 'B', 'C', 'D'].map((optionKey) => {
              const optionText = currentMcq?.[`option_${optionKey.toLowerCase()}` as keyof MCQ];
              return (
                <div key={optionKey} className="flex items-center space-x-2">
                  <RadioGroupItem value={optionKey} id={`option-${optionKey}`} />
                  <Label htmlFor={`option-${optionKey}`}>{`${optionKey}. ${optionText}`}</Label>
                </div>
              );
            })}
          </RadioGroup>
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button onClick={handlePrevious} disabled={currentQuestionIndex === 0} variant="outline">
            Previous
          </Button>
          {currentQuestionIndex === mcqs.length - 1 ? (
            <Button onClick={handleSubmitTest} disabled={isTestSubmitted}>
              Submit Test
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
            </Button>
          )}
        </CardFooter>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default TakeTestPage;