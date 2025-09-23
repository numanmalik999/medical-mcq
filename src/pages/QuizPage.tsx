"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useToast } from '@/hooks/use-toast';

interface MCQ {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation_id: string | null;
  category_id: string | null; // Updated to category_id
  subcategory_id: string | null; // Added subcategory_id
  difficulty: string | null;
}

interface MCQExplanation {
  id: string;
  explanation_text: string;
  image_url: string | null;
}

const QuizPage = () => {
  const [mcq, setMcq] = useState<MCQ | null>(null);
  const [explanation, setExplanation] = useState<MCQExplanation | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchMcq();
  }, []);

  const fetchMcq = async () => {
    setIsLoading(true);
    setMcq(null);
    setExplanation(null);
    setSelectedAnswer(null);
    setFeedback(null);
    setShowExplanation(false);

    const { data, error } = await supabase
      .from('mcqs')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching MCQ:', error);
      toast({
        title: "Error",
        description: "Failed to load MCQ. Please try again.",
        variant: "destructive",
      });
    } else {
      setMcq(data);
      if (data.explanation_id) {
        fetchExplanation(data.explanation_id);
      }
    }
    setIsLoading(false);
  };

  const fetchExplanation = async (explanationId: string) => {
    const { data, error } = await supabase
      .from('mcq_explanations')
      .select('*')
      .eq('id', explanationId)
      .single();

    if (error) {
      console.error('Error fetching explanation:', error);
      toast({
        title: "Error",
        description: "Failed to load explanation.",
        variant: "destructive",
      });
    } else {
      setExplanation(data);
    }
  };

  const handleSubmitAnswer = () => {
    if (!selectedAnswer || !mcq) return;

    if (selectedAnswer === mcq.correct_answer) {
      setFeedback('Correct!');
    } else {
      setFeedback(`Incorrect. The correct answer was ${mcq.correct_answer}.`);
    }
    setShowExplanation(true);
  };

  const handleAiExplanation = () => {
    toast({
      title: "AI Explanation",
      description: "This feature is coming soon! The AI will provide a deeper dive into the topic.",
    });
    // Placeholder for AI integration
    console.log("Requesting AI explanation for:", mcq?.question_text);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading MCQ...</p>
      </div>
    );
  }

  if (!mcq) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>No MCQs Found</CardTitle>
            <CardDescription>
              It looks like there are no MCQs in the database yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600 dark:text-gray-400">
              Please add some MCQs to the `mcqs` table in your Supabase project.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={fetchMcq}>Try Again</Button>
          </CardFooter>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-xl">{mcq.question_text}</CardTitle>
          {mcq.category_id && mcq.difficulty && ( // Updated to category_id
            <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
              Category ID: {mcq.category_id} | Difficulty: {mcq.difficulty}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <RadioGroup
            onValueChange={setSelectedAnswer}
            value={selectedAnswer || ""}
            className="space-y-2"
            disabled={showExplanation}
          >
            {['A', 'B', 'C', 'D'].map((optionKey) => {
              const optionText = mcq[`option_${optionKey.toLowerCase()}` as keyof MCQ];
              return (
                <div key={optionKey} className="flex items-center space-x-2">
                  <RadioGroupItem value={optionKey} id={`option-${optionKey}`} />
                  <Label htmlFor={`option-${optionKey}`}>{`${optionKey}. ${optionText}`}</Label>
                </div>
              );
            })}
          </RadioGroup>

          {feedback && (
            <p className={`mt-4 text-lg font-semibold ${feedback.startsWith('Correct') ? 'text-green-600' : 'text-red-600'}`}>
              {feedback}
            </p>
          )}

          {showExplanation && explanation && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold mb-2">Explanation:</h3>
              <p className="text-gray-800 dark:text-gray-200">{explanation.explanation_text}</p>
              {explanation.image_url && (
                <img src={explanation.image_url} alt="Explanation" className="mt-4 max-w-full h-auto rounded-md" />
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-2">
          {!showExplanation ? (
            <Button onClick={handleSubmitAnswer} disabled={!selectedAnswer}>
              Submit Answer
            </Button>
          ) : (
            <>
              <Button onClick={fetchMcq} variant="outline">Next MCQ</Button>
              <Button onClick={handleAiExplanation}>Get more explanation with AI</Button>
            </>
          )}
        </CardFooter>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default QuizPage;