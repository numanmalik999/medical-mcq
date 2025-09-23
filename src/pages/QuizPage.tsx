"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/components/SessionContextProvider'; // Import useSession

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

interface CategoryStat {
  id: string;
  name: string;
  total_mcqs: number;
  user_attempts: number;
  user_correct: number;
  user_incorrect: number;
  user_accuracy: string;
}

const QuizPage = () => {
  const { user } = useSession(); // Get user from session
  const [mcq, setMcq] = useState<MCQ | null>(null);
  const [explanation, setExplanation] = useState<MCQExplanation | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [currentQuizCategoryId, setCurrentQuizCategoryId] = useState<string | null>(null);
  const [showCategorySelection, setShowCategorySelection] = useState(true);

  useEffect(() => {
    fetchQuizOverview();
  }, [user]); // Refetch overview if user changes

  const fetchQuizOverview = async () => {
    setIsLoading(true);
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const categoriesWithStats: CategoryStat[] = [];

    for (const category of categoriesData || []) {
      // Fetch MCQ count for this category
      const { count: mcqCount, error: mcqCountError } = await supabase
        .from('mcqs')
        .select('id', { count: 'exact' })
        .eq('category_id', category.id);

      if (mcqCountError) {
        console.error(`Error fetching MCQ count for category ${category.name}:`, mcqCountError);
        // Continue even if one category fails
      }

      let totalAttempts = 0;
      let correctAttempts = 0;

      if (user) { // Only fetch user-specific stats if logged in
        const { data: userAttemptsData, error: userAttemptsError } = await supabase
          .from('user_quiz_attempts')
          .select('is_correct')
          .eq('user_id', user.id)
          .eq('category_id', category.id);

        if (userAttemptsError) {
          console.error(`Error fetching user attempts for category ${category.name}:`, userAttemptsError);
        } else {
          totalAttempts = userAttemptsData.length;
          correctAttempts = userAttemptsData.filter(attempt => attempt.is_correct).length;
        }
      }

      const incorrectAttempts = totalAttempts - correctAttempts;
      const accuracy = totalAttempts > 0 ? ((correctAttempts / totalAttempts) * 100).toFixed(2) : '0.00';

      categoriesWithStats.push({
        ...category,
        total_mcqs: mcqCount || 0,
        user_attempts: totalAttempts,
        user_correct: correctAttempts,
        user_incorrect: incorrectAttempts,
        user_accuracy: `${accuracy}%`,
      });
    }

    setCategoryStats(categoriesWithStats);
    setIsLoading(false);
  };

  const fetchMcq = async () => {
    setIsLoading(true);
    setMcq(null);
    setExplanation(null);
    setSelectedAnswer(null);
    setFeedback(null);
    setShowExplanation(false);

    if (!currentQuizCategoryId) {
      toast({ title: "Error", description: "No category selected for quiz.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    let countQuery = supabase.from('mcqs').select('id', { count: 'exact' })
      .eq('category_id', currentQuizCategoryId);

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Supabase Error fetching MCQ count:', countError);
      toast({ title: "Error", description: `Failed to load quiz count: ${countError.message}. Please try again.`, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    if (count === 0) {
      toast({ title: "No MCQs", description: "No MCQs found for the selected category.", variant: "default" });
      setIsLoading(false);
      setMcq(null);
      return;
    }

    const randomIndex = Math.floor(Math.random() * count!);

    const { data, error } = await supabase
      .from('mcqs')
      .select('*')
      .eq('category_id', currentQuizCategoryId)
      .limit(1)
      .range(randomIndex, randomIndex)
      .single();

    if (error) {
      console.error('Supabase Error fetching single MCQ:', error);
      toast({
        title: "Error",
        description: `Failed to load MCQ: ${error.message || 'Unknown error'}. Please try again.`,
        variant: "destructive",
      });
    } else if (data) {
      setMcq(data);
      if (data.explanation_id) {
        try {
          await fetchExplanation(data.explanation_id);
        } catch (explanationFetchError: any) {
          console.error('Client-side error during explanation fetch:', explanationFetchError);
          toast({
            title: "Error",
            description: `An unexpected error occurred while fetching explanation: ${explanationFetchError.message || 'Unknown error'}`,
            variant: "destructive",
          });
        }
      } else {
        setExplanation(null);
      }
    } else {
      toast({
        title: "Warning",
        description: "No MCQ data found. Please try again.",
        variant: "default",
      });
      setMcq(null);
    }
    setIsLoading(false);
  };

  const fetchExplanation = async (explanationId: string) => {
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
      setExplanation(null);
    } else if (data) {
      setExplanation(data);
    } else {
      setExplanation(null);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !mcq || !user) return;

    const isCorrect = selectedAnswer === mcq.correct_answer;
    if (isCorrect) {
      setFeedback('Correct!');
    } else {
      setFeedback(`Incorrect. The correct answer was ${mcq.correct_answer}.`);
    }
    setShowExplanation(true);

    // Record the quiz attempt
    try {
      const { error } = await supabase.from('user_quiz_attempts').insert({
        user_id: user.id,
        mcq_id: mcq.id,
        category_id: mcq.category_id,
        subcategory_id: mcq.subcategory_id,
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
  };

  const handleAiExplanation = () => {
    toast({
      title: "AI Explanation",
      description: "This feature is coming soon! The AI will provide a deeper dive into the topic.",
    });
  };

  const handleStartQuizForCategory = (categoryId: string) => {
    setCurrentQuizCategoryId(categoryId);
    setShowCategorySelection(false);
    fetchMcq();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading quiz overview...</p>
      </div>
    );
  }

  if (showCategorySelection) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Select a Quiz Category</CardTitle>
            <CardDescription>Choose a category to start your quiz and view your performance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryStats.length === 0 ? (
              <p className="text-center text-gray-600 dark:text-gray-400">
                No categories available. Please add categories and MCQs via the admin panel.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryStats.map((cat) => (
                  <Card key={cat.id} className="flex flex-col">
                    <CardHeader>
                      <CardTitle className="text-lg">{cat.name}</CardTitle>
                      <CardDescription>{cat.total_mcqs} MCQs available</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-2 text-sm">
                      <p>Attempts: {cat.user_attempts}</p>
                      <p>Correct: {cat.user_correct}</p>
                      <p>Incorrect: {cat.user_incorrect}</p>
                      <p>Accuracy: {cat.user_accuracy}</p>
                    </CardContent>
                    <CardFooter>
                      <Button
                        onClick={() => handleStartQuizForCategory(cat.id)}
                        className="w-full"
                        disabled={cat.total_mcqs === 0}
                      >
                        Start Quiz
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  if (!mcq && !isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>No MCQs Found</CardTitle>
            <CardDescription>
              It looks like there are no MCQs for the selected category.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600 dark:text-gray-400">
              Please try a different category or add more MCQs.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => setShowCategorySelection(true)}>Go Back to Category Selection</Button>
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
          <CardTitle className="text-xl">{mcq?.question_text}</CardTitle>
          {mcq?.difficulty && (
            <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
              Difficulty: {mcq.difficulty}
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
              const optionText = mcq?.[`option_${optionKey.toLowerCase()}` as keyof MCQ];
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