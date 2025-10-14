"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/components/SessionContextProvider';
import { useNavigate, Link } from 'react-router-dom';
import { TimerIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  difficulty: string | null; // Ensure difficulty is here
}

interface MCQExplanation {
  id: string;
  explanation_text: string;
  image_url: string | null;
}

interface Category {
  id: string;
  name: string;
}

const DEFAULT_TEST_DURATION_SECONDS = 3 * 60 * 60; // 3 hours

const TakeTestPage = () => {
  const { user, hasCheckedInitialSession } = useSession(); // Use hasCheckedInitialSession
  const { toast } = useToast();
  const navigate = useNavigate();

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedPercentage, setSelectedPercentage] = useState<string>('100'); // '10', '25', '50', '100', 'all'
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null); // New state for difficulty filter
  const [showConfiguration, setShowConfiguration] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);

  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Map<string, string | null>>(new Map());
  const [isTestSubmitted, setIsTestSubmitted] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(true); // Renamed to avoid conflict
  const [timer, setTimer] = useState(DEFAULT_TEST_DURATION_SECONDS);
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

  // Initial load: Fetch all categories
  useEffect(() => {
    if (!hasCheckedInitialSession) {
      // Still waiting for initial session check, keep loading state true
      return;
    }

    if (user && user.has_active_subscription) {
      const fetchCategories = async () => {
        setIsLoadingPage(true);
        const { data, error } = await supabase
          .from('categories')
          .select('*');

        if (error) {
          console.error('Error fetching categories:', error);
          toast({ title: "Error", description: "Failed to load categories for test configuration.", variant: "destructive" });
        } else {
          setAllCategories(data || []);
        }
        setIsLoadingPage(false);
      };
      fetchCategories();
    } else if (user && !user.has_active_subscription) {
      setIsLoadingPage(false); // User is logged in but not subscribed
    } else {
      navigate('/login'); // Redirect if not logged in
    }
  }, [user, hasCheckedInitialSession, navigate, toast]);

  // Timer effect
  useEffect(() => {
    if (isLoadingPage || isTestSubmitted || showResults || showConfiguration || showInstructions || mcqs.length === 0) return;

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
  }, [isLoadingPage, isTestSubmitted, showResults, showConfiguration, showInstructions, mcqs.length, handleSubmitTest]);

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const startTestPreparation = async () => {
    if (!user || !user.has_active_subscription) {
      toast({ title: "Error", description: "You must have an active subscription to start a test.", variant: "destructive" });
      return;
    }

    setIsLoadingPage(true);
    let query = supabase.from('mcqs').select('*');

    if (selectedCategoryIds.length > 0) {
      query = query.in('category_id', selectedCategoryIds);
    }
    if (selectedDifficulty) { // Apply difficulty filter
      query = query.eq('difficulty', selectedDifficulty);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching MCQs:', error);
      toast({ title: "Error", description: "Failed to load test questions.", variant: "destructive" });
      setIsLoadingPage(false);
      return;
    }

    if (!data || data.length === 0) {
      toast({ title: "No MCQs", description: "No MCQs available for the selected criteria.", variant: "default" });
      setIsLoadingPage(false);
      return;
    }

    let selectedMcqs: MCQ[] = [];
    if (selectedPercentage === 'all') {
      selectedMcqs = data;
    } else {
      const percentageValue = parseInt(selectedPercentage, 10) / 100;
      const numToSelect = Math.max(1, Math.floor(data.length * percentageValue)); // Ensure at least 1 MCQ if available
      const shuffledMcqs = data.sort(() => 0.5 - Math.random());
      selectedMcqs = shuffledMcqs.slice(0, numToSelect);
    }

    if (selectedMcqs.length === 0) {
      toast({ title: "No MCQs", description: "No MCQs could be selected based on your criteria. Please adjust.", variant: "default" });
      setIsLoadingPage(false);
      return;
    }

    setMcqs(selectedMcqs);
    setTimer(DEFAULT_TEST_DURATION_SECONDS); // Reset timer for new test
    setCurrentQuestionIndex(0);
    setUserAnswers(new Map());
    setIsTestSubmitted(false);
    setScore(0);
    setShowResults(false);
    setExplanations(new Map());

    setShowConfiguration(false);
    setShowInstructions(true); // Show instructions before starting
    setIsLoadingPage(false);
  };

  const beginTest = () => {
    setShowInstructions(false);
    // The timer useEffect will now start since showInstructions is false and mcqs.length > 0
  };

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

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!hasCheckedInitialSession || isLoadingPage) { // Use hasCheckedInitialSession for initial loading
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Redirect handled by useEffect
  }

  // New check for active subscription
  if (!user.has_active_subscription) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-2xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Subscription Required</CardTitle>
            <CardDescription>
              You need an active subscription to take full tests.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg">Unlock unlimited tests and all premium features by subscribing today!</p>
            <Link to="/user/subscriptions">
              <Button className="w-full sm:w-auto">
                View Subscription Plans
              </Button>
            </Link>
          </CardContent>
          <MadeWithDyad />
        </Card>
      </div>
    );
  }

  if (showConfiguration) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Configure Your Test</CardTitle>
            <CardDescription>Select categories, difficulty, and the percentage of questions you'd like to include.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-lg font-semibold">Select Categories (Optional)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border rounded-md">
                {allCategories.length === 0 ? (
                  <p className="col-span-full text-center text-muted-foreground">No categories available. Please add some via the admin panel.</p>
                ) : (
                  allCategories.map((category) => (
                    <div key={category.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`category-${category.id}`}
                        checked={selectedCategoryIds.includes(category.id)}
                        onCheckedChange={() => handleCategoryToggle(category.id)}
                      />
                      <Label htmlFor={`category-${category.id}`}>{category.name}</Label>
                    </div>
                  ))
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                If no categories are selected, questions will be pulled from all available categories.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty-select" className="text-lg font-semibold">Difficulty (Optional)</Label>
              <Select onValueChange={(value) => setSelectedDifficulty(value === "all" ? null : value)} value={selectedDifficulty || "all"}>
                <SelectTrigger id="difficulty-select" className="w-full">
                  <SelectValue placeholder="Any Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Difficulty</SelectItem>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Filter questions by their AI-assigned difficulty level.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="percentage-select" className="text-lg font-semibold">Percentage of MCQs</Label>
              <Select onValueChange={setSelectedPercentage} value={selectedPercentage}>
                <SelectTrigger id="percentage-select" className="w-full">
                  <SelectValue placeholder="Select percentage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="25">25%</SelectItem>
                  <SelectItem value="50">50%</SelectItem>
                  <SelectItem value="100">100%</SelectItem>
                  <SelectItem value="all">All Available</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Select how many questions (by percentage) you want from the chosen categories.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={startTestPreparation} disabled={isLoadingPage}>
              {isLoadingPage ? "Preparing Test..." : "Start Test"}
            </Button>
          </CardFooter>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  if (showInstructions) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Test Instructions</CardTitle>
            <CardDescription>Please read the following instructions carefully before starting your test.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p><strong>Number of Questions:</strong> {mcqs.length}</p>
            <p><strong>Time Limit:</strong> {formatTime(DEFAULT_TEST_DURATION_SECONDS)}</p>
            <ul className="list-disc list-inside space-y-1">
              <li>You will be presented with {mcqs.length} multiple-choice questions.</li>
              <li>You have {formatTime(DEFAULT_TEST_DURATION_SECONDS)} to complete the test.</li>
              <li>Select one option for each question.</li>
              <li>You can navigate between questions using the "Previous" and "Next" buttons.</li>
              <li>Your answers will be saved automatically as you select them.</li>
              <li>The test will automatically submit when the time runs out.</li>
              <li>You can submit the test manually at any time by clicking "Submit Test" on the last question.</li>
              <li>Once submitted, you will see your score and can review your answers with explanations.</li>
            </ul>
            <p className="font-semibold text-red-600">Good luck!</p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={beginTest}>Begin Test</Button>
          </CardFooter>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  if (mcqs.length === 0 && !isLoadingPage && !showConfiguration && !showInstructions) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>No Test Available</CardTitle>
            <CardDescription>
              There are no MCQs available to create a test based on your selections.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={() => setShowConfiguration(true)}>Go Back to Configuration</Button>
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