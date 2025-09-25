"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useSession } from '@/components/SessionContextProvider';
import { AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react'; // Import icons
import { useNavigate } from 'react-router-dom'; // Removed Link import

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
  is_trial_mcq: boolean | null; // Ensure this is included
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
  total_trial_mcqs: number; // New field for trial MCQs count
  user_attempts: number;
  user_correct: number;
  user_incorrect: number;
  user_accuracy: string;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

const TRIAL_MCQ_LIMIT = 10; // Define a limit for trial questions

const QuizPage = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [quizQuestions, setQuizQuestions] = useState<MCQ[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Map<string, string | null>>(new Map());
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);

  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([]);
  const [currentQuizSubcategoryId, setCurrentQuizSubcategoryId] = useState<string | null>(null);
  const [showCategorySelection, setShowCategorySelection] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [explanations, setExplanations] = useState<Map<string, MCQExplanation>>(new Map());

  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false); // New state for subscription prompt
  const [isTrialActiveSession, setIsTrialActiveSession] = useState(false); // New state to track if current session is a trial

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

  useEffect(() => {
    if (!isSessionLoading) {
      if (user) {
        fetchQuizOverview();
        // Determine initial trial status
        if (!user.has_active_subscription && !user.trial_taken) {
          setIsTrialActiveSession(true);
        } else {
          setIsTrialActiveSession(false);
        }
      } else {
        // Not logged in, maybe redirect or show login prompt
        setIsLoading(false);
      }
    }
  }, [user, isSessionLoading]);

  const fetchQuizOverview = async () => {
    setIsLoading(true);
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*');

    const { data: subcategoriesData, error: subcategoriesError } = await supabase
      .from('subcategories')
      .select('*');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    if (subcategoriesError) {
      console.error('Error fetching subcategories:', subcategoriesError);
      toast({ title: "Error", description: "Failed to load subcategories.", variant: "destructive" });
    } else {
      setAllSubcategories(subcategoriesData || []);
    }

    const categoriesWithStats: CategoryStat[] = [];

    for (const category of categoriesData || []) {
      // Fetch total MCQ count for this category
      const { count: mcqCount, error: mcqCountError } = await supabase
        .from('mcqs')
        .select('id', { count: 'exact' })
        .eq('category_id', category.id);

      if (mcqCountError) {
        console.error(`Error fetching MCQ count for category ${category.name}:`, mcqCountError);
      }

      // Fetch trial MCQ count for this category
      const { count: trialMcqCount, error: trialMcqCountError } = await supabase
        .from('mcqs')
        .select('id', { count: 'exact' })
        .eq('category_id', category.id)
        .eq('is_trial_mcq', true);

      if (trialMcqCountError) {
        console.error(`Error fetching trial MCQ count for category ${category.name}:`, trialMcqCountError);
      }

      let totalAttempts = 0;
      let correctAttempts = 0;

      if (user) {
        const { data: userAttemptsData, error: userAttemptsError } = await supabase
          .from('user_quiz_attempts')
          .select('is_correct, mcq_id')
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
        total_trial_mcqs: trialMcqCount || 0, // Store trial MCQ count
        user_attempts: totalAttempts,
        user_correct: correctAttempts,
        user_incorrect: incorrectAttempts,
        user_accuracy: `${accuracy}%`,
      });
    }

    setCategoryStats(categoriesWithStats);
    setIsLoading(false);
  };

  const startQuizSession = async (categoryId: string, subcategoryId: string | null, mode: 'random' | 'incorrect') => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to start a quiz.", variant: "destructive" });
      navigate('/login');
      return;
    }

    // Check subscription/trial status
    const isSubscribed = user.has_active_subscription;
    const hasTakenTrial = user.trial_taken;

    if (!isSubscribed) {
      if (hasTakenTrial) {
        setShowSubscriptionPrompt(true); // User has taken trial, needs to subscribe
        return;
      }
      // User has not taken trial, this will be their trial session
      setIsTrialActiveSession(true);
    } else {
      // User has active subscription, full access
      setIsTrialActiveSession(false);
    }

    setIsLoading(true);
    setQuizQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers(new Map());
    setSelectedAnswer(null);
    setFeedback(null);
    setShowExplanation(false);
    setScore(0);
    setShowResults(false);
    setExplanations(new Map());

    let query = supabase
      .from('mcqs')
      .select('*')
      .eq('category_id', categoryId);

    if (subcategoryId) {
      query = query.eq('subcategory_id', subcategoryId);
    }

    // Apply trial filter if user is not subscribed and is in trial mode
    if (isTrialActiveSession) {
      query = query.eq('is_trial_mcq', true);
    }

    let mcqsToLoad: MCQ[] = [];

    if (mode === 'random') {
      const { data, error } = await query;
      if (error) {
        console.error('Error fetching random MCQs:', error);
        toast({ title: "Error", description: "Failed to load quiz questions.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (!data || data.length === 0) {
        toast({ title: "No MCQs", description: "No MCQs found for the selected criteria.", variant: "default" });
        setIsLoading(false);
        return;
      }
      // Shuffle and take a reasonable number, e.g., 10 for a quick quiz
      mcqsToLoad = data.sort(() => 0.5 - Math.random()).slice(0, Math.min(data.length, isTrialActiveSession ? TRIAL_MCQ_LIMIT : data.length));
    } else if (mode === 'incorrect') {
      // Incorrect mode is only for subscribed users
      if (isTrialActiveSession) {
        toast({ title: "Trial Mode", description: "You can only attempt random trial questions during your free trial.", variant: "default" }); // Changed variant to "default"
        setIsLoading(false);
        return;
      }

      const { data: incorrectAttempts, error: attemptsError } = await supabase
        .from('user_quiz_attempts')
        .select('mcq_id')
        .eq('user_id', user.id)
        .eq('category_id', categoryId)
        .eq('is_correct', false);

      if (attemptsError) {
        console.error('Error fetching incorrect attempts:', attemptsError);
        toast({ title: "Error", description: "Failed to load incorrect questions.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const incorrectMcqIds = Array.from(new Set(incorrectAttempts?.map(attempt => attempt.mcq_id) || []));
      
      if (incorrectMcqIds.length === 0) {
        toast({ title: "No Incorrect MCQs", description: "You have no incorrect answers in this category to re-attempt.", variant: "default" });
        setIsLoading(false);
        return;
      }

      const { data: mcqsData, error: mcqsError } = await query.in('id', incorrectMcqIds);
      if (mcqsError) {
        console.error('Error fetching incorrect MCQs data:', mcqsError);
        toast({ title: "Error", description: "Failed to load incorrect questions data.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      mcqsToLoad = mcqsData || [];
    }

    if (mcqsToLoad.length === 0) {
      toast({ title: "No MCQs", description: "No questions available for this quiz session.", variant: "default" });
      setIsLoading(false);
      return;
    }

    setQuizQuestions(mcqsToLoad);
    setCurrentQuizSubcategoryId(subcategoryId);
    setShowCategorySelection(false);
    setIsLoading(false);
    if (mcqsToLoad.length > 0) {
      setSelectedAnswer(userAnswers.get(mcqsToLoad[0].id) || null);
    }

    // If this is a trial session and user hasn't taken trial yet, mark trial_taken
    if (isTrialActiveSession && !hasTakenTrial) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ trial_taken: true })
        .eq('id', user.id);
      if (updateError) {
        console.error('Error marking trial_taken:', updateError);
        toast({ title: "Error", description: "Failed to update trial status.", variant: "destructive" });
      } else {
        // Optimistically update user object in session context
        if (user) user.trial_taken = true;
        toast({ title: "Trial Started!", description: `You have started your free trial. Enjoy ${TRIAL_MCQ_LIMIT} trial questions!`, variant: "default" }); // Changed variant to "default"
      }
    }
  };

  const handleResetProgress = async (categoryId: string) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to reset progress.", variant: "destructive" });
      return;
    }
    if (!window.confirm("Are you sure you want to delete your quiz progress for this category? This action cannot be undone.")) {
      return;
    }

    setIsLoading(true);
    const { error } = await supabase
      .from('user_quiz_attempts')
      .delete()
      .eq('user_id', user.id)
      .eq('category_id', categoryId);

    if (error) {
      console.error('Error resetting progress:', error);
      toast({ title: "Error", description: `Failed to reset progress: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Quiz progress reset successfully." });
      fetchQuizOverview(); // Refresh stats
    }
    setIsLoading(false);
  };

  const currentMcq = quizQuestions[currentQuestionIndex];

  const handleOptionSelect = useCallback((value: string) => {
    if (currentMcq) {
      setSelectedAnswer(value); // Update selected answer for current question
      setUserAnswers((prev) => new Map(prev).set(currentMcq.id, value));
      setFeedback(null); // Clear feedback when a new option is selected
      setShowExplanation(false); // Hide explanation
    }
  }, [currentMcq]);

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !currentMcq || !user) return;

    setIsSubmittingAnswer(true);
    const isCorrect = selectedAnswer === currentMcq.correct_answer;
    if (isCorrect) {
      setFeedback('Correct!');
    } else {
      setFeedback(`Incorrect. The correct answer was ${currentMcq.correct_answer}.`);
    }
    setShowExplanation(true);

    try {
      const { error } = await supabase.from('user_quiz_attempts').insert({
        user_id: user.id,
        mcq_id: currentMcq.id,
        category_id: currentMcq.category_id,
        subcategory_id: currentMcq.subcategory_id,
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
    } finally {
      setIsSubmittingAnswer(false);
      if (currentMcq.explanation_id) {
        fetchExplanation(currentMcq.explanation_id); // Pre-fetch explanation for review
      }
    }
  };

  const handleNextQuestion = () => {
    // If in trial mode and about to exceed limit, force submit
    if (isTrialActiveSession && currentQuestionIndex + 1 >= TRIAL_MCQ_LIMIT) {
      toast({ title: "Trial Limit Reached", description: "You have reached the limit for trial questions. Please subscribe to continue.", variant: "default" }); // Changed variant to "default"
      submitFullQuiz();
      return;
    }

    if (currentQuestionIndex < quizQuestions.length - 1) {
      const nextQuestion = quizQuestions[currentQuestionIndex + 1];
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(userAnswers.get(nextQuestion?.id || '') || null); // Load saved answer for next question
      setFeedback(null);
      setShowExplanation(false);
    } else {
      // This is the last question, submit the test
      submitFullQuiz();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      const prevQuestion = quizQuestions[currentQuestionIndex - 1];
      setCurrentQuestionIndex((prev) => prev - 1);
      setSelectedAnswer(userAnswers.get(prevQuestion?.id || '') || null); // Load saved answer for previous question
      setFeedback(null);
      setShowExplanation(false);
    }
  };

  const submitFullQuiz = async () => {
    if (!user) return;

    setIsLoading(true);
    let correctCount = 0;
    const explanationPromises: Promise<MCQExplanation | null>[] = [];
    const mcqExplanationIds = new Set<string>();

    for (const mcq of quizQuestions) {
      const userAnswer = userAnswers.get(mcq.id);
      const isCorrect = userAnswer === mcq.correct_answer;
      if (isCorrect) {
        correctCount++;
      }
      if (mcq.explanation_id && !mcqExplanationIds.has(mcq.explanation_id)) {
        mcqExplanationIds.add(mcq.explanation_id);
        explanationPromises.push(fetchExplanation(mcq.explanation_id));
      }
    }

    setScore(correctCount);
    await Promise.all(explanationPromises); // Ensure all explanations are fetched
    setShowResults(true);
    setIsLoading(false);
  };

  const filteredCategories = categoryStats.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading || isSessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading quiz overview...</p>
      </div>
    );
  }

  if (!user) {
    // If not logged in, redirect to login page
    navigate('/login');
    return null;
  }

  if (showSubscriptionPrompt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-2xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Trial Completed!</CardTitle>
            <CardDescription>
              You have completed your free trial or already used it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg">To unlock all questions and features, please subscribe.</p>
            <Button onClick={() => navigate('/user/subscriptions')} className="w-full sm:w-auto">
              View Subscription Plans
            </Button>
            <Button onClick={() => setShowCategorySelection(true)} variant="outline" className="w-full sm:w-auto">
              Back to Quiz Selection
            </Button>
          </CardContent>
          <MadeWithDyad />
        </Card>
      </div>
    );
  }

  if (showCategorySelection) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Select a Quiz Category</CardTitle>
            <CardDescription>Choose a category and optionally a subcategory to start your quiz and view your performance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-4"
            />
            {filteredCategories.length === 0 ? (
              <p className="text-center text-gray-600 dark:text-gray-400">
                No categories found matching your search.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCategories.map((cat) => (
                  <Card key={cat.id} className="flex flex-col">
                    <CardHeader>
                      <CardTitle className="text-lg">{cat.name}</CardTitle>
                      <CardDescription>
                        {user.has_active_subscription ? `${cat.total_mcqs} MCQs available` : `${cat.total_trial_mcqs} Trial MCQs available`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-2 text-sm">
                      <p>Attempts: {cat.user_attempts}</p>
                      <p>Correct: {cat.user_correct}</p>
                      <p>Incorrect: {cat.user_incorrect}</p>
                      <p>Accuracy: {cat.user_accuracy}</p>
                      <div className="space-y-2 mt-4">
                        <Label htmlFor={`subcategory-select-${cat.id}`}>Subcategory (Optional)</Label>
                        <Select
                          onValueChange={(value) => setCurrentQuizSubcategoryId(value === "all" ? null : value)}
                          value={currentQuizSubcategoryId || "all"}
                          disabled={!cat.id || allSubcategories.filter(sub => sub.category_id === cat.id).length === 0}
                        >
                          <SelectTrigger id={`subcategory-select-${cat.id}`}>
                            <SelectValue placeholder="Any Subcategory" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any Subcategory</SelectItem>
                            {allSubcategories
                              .filter(sub => sub.category_id === cat.id)
                              .map((subcat) => (
                                <SelectItem key={subcat.id} value={subcat.id}>{subcat.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2">
                      <Button
                        onClick={() => startQuizSession(cat.id, currentQuizSubcategoryId, 'random')}
                        className="w-full"
                        disabled={
                          (user.has_active_subscription && cat.total_mcqs === 0) ||
                          (!user.has_active_subscription && cat.total_trial_mcqs === 0) ||
                          (!user.has_active_subscription && user.trial_taken)
                        }
                      >
                        {user.has_active_subscription ? "Start Quiz" : (user.trial_taken ? "Subscribe to Start" : "Start Trial Quiz")}
                      </Button>
                      <Button
                        onClick={() => startQuizSession(cat.id, currentQuizSubcategoryId, 'incorrect')}
                        className="w-full"
                        variant="secondary"
                        disabled={cat.user_incorrect === 0 || !user.has_active_subscription} // Incorrect mode only for subscribed users
                      >
                        Attempt Incorrect ({cat.user_incorrect})
                      </Button>
                      <Button
                        onClick={() => handleResetProgress(cat.id)}
                        className="w-full"
                        variant="destructive"
                        disabled={cat.user_attempts === 0}
                      >
                        <RotateCcw className="h-4 w-4 mr-2" /> Reset Progress
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

  if (quizQuestions.length === 0 && !isLoading && !showCategorySelection && !showResults) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>No MCQs Found</CardTitle>
            <CardDescription>
              It looks like there are no MCQs for the selected category and subcategory.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600 dark:text-gray-400">
              Please try a different selection or add more MCQs.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => setShowCategorySelection(true)}>Go Back to Selection</Button>
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
            <CardTitle className="text-3xl">Quiz Results</CardTitle>
            <CardDescription>Review your performance on this quiz session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center text-2xl font-bold">
              Your Score: {score} / {quizQuestions.length}
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto p-2 border rounded-md">
              {quizQuestions.map((mcq, index) => {
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
            <Button onClick={() => { setShowCategorySelection(true); fetchQuizOverview(); }}>Back to Categories</Button>
          </CardFooter>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  if (!currentMcq) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading current question...</p>
      </div>
    );
  }

  const isAnswered = selectedAnswer !== null;
  const isLastQuestion = currentQuestionIndex === quizQuestions.length - 1;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
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
            disabled={showExplanation} // Disable radio group after submission
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
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-2">
          <Button onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0 || isSubmittingAnswer} variant="outline">
            Previous
          </Button>
          {!showExplanation ? (
            <Button onClick={handleSubmitAnswer} disabled={!isAnswered || isSubmittingAnswer}>
              {isSubmittingAnswer ? "Submitting..." : "Submit Answer"}
            </Button>
          ) : (
            <Button onClick={handleNextQuestion} disabled={isSubmittingAnswer}>
              {isLastQuestion ? "Submit Quiz" : "Next Question"}
            </Button>
          )}
        </CardFooter>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default QuizPage;