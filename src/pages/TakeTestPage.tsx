"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/components/SessionContextProvider';
import { useNavigate, Link } from 'react-router-dom';
import { TimerIcon, Pause, Play, SkipForward } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { McqCategoryLink } from '@/components/mcq-columns'; // Import McqCategoryLink
import { Input } from '@/components/ui/input'; // Import Input for number of MCQs and duration
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'; // Added DialogDescription

interface MCQ {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation_id: string | null;
  difficulty: string | null; // Ensure difficulty is here
  is_trial_mcq: boolean | null;
  category_links: McqCategoryLink[]; // Add category_links to MCQ interface
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

const UNCATEGORIZED_ID = 'uncategorized-mcqs-virtual-id'; // Unique ID for the virtual uncategorized category

const TakeTestPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [numMcqsToSelect, setNumMcqsToSelect] = useState<number>(10); // New state for number of MCQs
  const [testDurationMinutes, setTestDurationMinutes] = useState<number>(60); // New state for test duration in minutes
  const [showConfiguration, setShowConfiguration] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);

  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Map<string, string | null>>(new Map());
  const [isTestSubmitted, setIsTestSubmitted] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true); // New combined loading state for initial data
  const [timer, setTimer] = useState(testDurationMinutes * 60); // Initialize timer with selected duration
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [explanations, setExplanations] = useState<Map<string, MCQExplanation>>(new Map());

  const [isPaused, setIsPaused] = useState(false); // New state for pause functionality
  const [skippedMcqIds, setSkippedMcqIds] = useState<Set<string>>(new Set()); // Track skipped MCQs
  const [showReviewSkippedDialog, setShowReviewSkippedDialog] = useState(false);
  const [reviewSkippedQuestions, setReviewSkippedQuestions] = useState<MCQ[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  const timerIntervalRef = useRef<number | null>(null);

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

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsTestSubmitted(true);
    setIsPaused(true); // Ensure timer is paused on submission

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
      // For recording attempts, we need a single category_id and subcategory_id.
      // We'll use the first one from category_links if available.
      const firstCategoryLink = mcq.category_links?.[0];
      attemptsToRecord.push({
        user_id: user.id,
        mcq_id: mcq.id,
        category_id: firstCategoryLink?.category_id || null,
        subcategory_id: firstCategoryLink?.subcategory_id || null,
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
    if (hasCheckedInitialSession) {
      if (user && user.has_active_subscription) {
        const fetchCategories = async () => {
          setIsPageLoading(true); // Set loading for this specific fetch
          const { data, error } = await supabase
            .from('categories')
            .select('*');

          if (error) {
            console.error('Error fetching categories:', error);
            toast({ title: "Error", description: "Failed to load categories for test configuration.", variant: "destructive" });
          } else {
            // Add the virtual "Uncategorized" category
            setAllCategories([...(data || []), { id: UNCATEGORIZED_ID, name: 'Uncategorized' }]);
          }
          setIsPageLoading(false); // Clear loading for this specific fetch
        };
        fetchCategories();
      } else if (user && !user.has_active_subscription) {
        setIsPageLoading(false); // User is logged in but not subscribed, stop loading
      } else {
        navigate('/login'); // Redirect if not logged in
      }
    }
  }, [user, hasCheckedInitialSession, navigate, toast]);

  // Timer effect
  useEffect(() => {
    if (isPageLoading || isTestSubmitted || showResults || showConfiguration || showInstructions || mcqs.length === 0 || isPaused) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    if (!timerIntervalRef.current) {
      timerIntervalRef.current = setInterval(() => {
        setTimer((prevTimer) => {
          if (prevTimer <= 1) {
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            handleSubmitTest(); // Auto-submit when timer runs out
            return 0;
          }
          return prevTimer - 1;
        });
      }, 1000) as unknown as number; // Cast to number for clearInterval
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isPageLoading, isTestSubmitted, showResults, showConfiguration, showInstructions, mcqs.length, isPaused, handleSubmitTest]);

  // Update timer when testDurationMinutes changes
  useEffect(() => {
    setTimer(testDurationMinutes * 60);
  }, [testDurationMinutes]);

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategoryIds((prev) => {
      // If 'Uncategorized' is selected, it's exclusive
      if (categoryId === UNCATEGORIZED_ID) {
        return prev.includes(UNCATEGORIZED_ID) ? [] : [UNCATEGORIZED_ID];
      }
      // If another category is selected, remove 'Uncategorized' if present
      const newSelection = prev.filter(id => id !== UNCATEGORIZED_ID);
      return newSelection.includes(categoryId)
        ? newSelection.filter((id) => id !== categoryId)
        : [...newSelection, categoryId];
    });
  };

  const startTestPreparation = async () => {
    if (!user || !user.has_active_subscription) {
      toast({ title: "Error", description: "You must have an active subscription to start a test.", variant: "destructive" });
      return;
    }
    if (numMcqsToSelect <= 0) {
      toast({ title: "Error", description: "Number of MCQs must be greater than 0.", variant: "destructive" });
      return;
    }
    if (testDurationMinutes <= 0) {
      toast({ title: "Error", description: "Test duration must be greater than 0 minutes.", variant: "destructive" });
      return;
    }

    setIsPageLoading(true);

    let mcqsData: any[] | null = null;
    let mcqsError: any = null;

    const isUncategorizedSelected = selectedCategoryIds.includes(UNCATEGORIZED_ID);
    const regularCategoryIds = selectedCategoryIds.filter(id => id !== UNCATEGORIZED_ID);

    if (isUncategorizedSelected && regularCategoryIds.length === 0) {
      // Fetch MCQs that are NOT in mcq_category_links
      const { data: categorizedMcqLinks, error: linksError } = await supabase
        .from('mcq_category_links')
        .select('mcq_id');

      if (linksError) {
        console.error('Error fetching categorized MCQ links:', linksError);
        toast({ title: "Error", description: "Failed to identify uncategorized questions.", variant: "destructive" });
        setIsPageLoading(false);
        return;
      }

      const categorizedMcqIds = Array.from(new Set(categorizedMcqLinks?.map(link => link.mcq_id) || []));

      const { data, error } = await supabase
        .from('mcqs')
        .select(`
          *,
          mcq_category_links (
            category_id,
            subcategory_id,
            categories (name),
            subcategories (name)
          )
        `)
        .not('id', 'in', `(${categorizedMcqIds.join(',')})`); // Filter for MCQs not in any category

      mcqsData = data;
      mcqsError = error;

    } else if (regularCategoryIds.length > 0) {
      // Fetch MCQs from selected categories
      const { data, error } = await supabase
        .from('mcqs')
        .select(`
          *,
          mcq_category_links (
            category_id,
            subcategory_id,
            categories (name),
            subcategories (name)
          )
        `)
        .in('mcq_category_links.category_id', regularCategoryIds);

      mcqsData = data;
      mcqsError = error;
    } else {
      // No categories selected, fetch all MCQs
      const { data, error } = await supabase
        .from('mcqs')
        .select(`
          *,
          mcq_category_links (
            category_id,
            subcategory_id,
            categories (name),
            subcategories (name)
          )
        `);
      mcqsData = data;
      mcqsError = error;
    }

    if (mcqsError) {
      console.error('Error fetching MCQs:', mcqsError);
      toast({ title: "Error", description: "Failed to load test questions.", variant: "destructive" });
      setIsPageLoading(false);
      return;
    }

    if (!mcqsData || mcqsData.length === 0) {
      toast({ title: "No MCQs", description: "No MCQs available for the selected criteria.", variant: "default" });
      setIsPageLoading(false);
      return;
    }

    const formattedMcqs: MCQ[] = mcqsData.map((mcq: any) => ({
      ...mcq,
      category_links: mcq.mcq_category_links.map((link: any) => ({
        category_id: link.category_id,
        category_name: link.categories?.name || null,
        subcategory_id: link.subcategory_id,
        subcategory_name: link.subcategories?.name || null,
      })),
    }));

    const shuffledMcqs = formattedMcqs.sort(() => 0.5 - Math.random());
    const selectedMcqs = shuffledMcqs.slice(0, Math.min(numMcqsToSelect, shuffledMcqs.length));

    if (selectedMcqs.length === 0) {
      toast({ title: "No MCQs", description: "No MCQs could be selected based on your criteria. Please adjust.", variant: "default" });
      setIsPageLoading(false);
      return;
    }

    setMcqs(selectedMcqs);
    setTimer(testDurationMinutes * 60); // Reset timer for new test
    setCurrentQuestionIndex(0);
    setUserAnswers(new Map());
    setSkippedMcqIds(new Set()); // Reset skipped MCQs
    setIsTestSubmitted(false);
    setScore(0);
    setShowResults(false);
    setExplanations(new Map());
    setIsPaused(false); // Ensure not paused when starting new test

    setShowConfiguration(false);
    setShowInstructions(true);
    setIsPageLoading(false);
  };

  const beginTest = () => {
    setShowInstructions(false);
  };

  const currentMcq = mcqs[currentQuestionIndex];

  const handleOptionSelect = useCallback((value: string) => {
    if (currentMcq) {
      setUserAnswers((prev) => new Map(prev).set(currentMcq.id, value));
      setSkippedMcqIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(currentMcq.id);
        return newSet;
      });
    }
  }, [currentMcq]);

  const handleNext = useCallback(() => {
    if (currentQuestionIndex < mcqs.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      if (skippedMcqIds.size > 0) {
        prepareReviewSkipped();
      } else {
        handleSubmitTest();
      }
    }
  }, [currentQuestionIndex, mcqs.length, skippedMcqIds, handleSubmitTest]);

  const handlePrevious = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  }, [currentQuestionIndex]);

  const handleSkip = useCallback(() => {
    if (currentMcq) {
      setSkippedMcqIds((prev) => new Set(prev).add(currentMcq.id));
      setUserAnswers((prev) => new Map(prev).set(currentMcq.id, null)); // Mark as unanswered
    }
    handleNext();
  }, [currentMcq, handleNext]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const prepareReviewSkipped = useCallback(() => {
    const skippedQuestions = mcqs.filter(mcq => skippedMcqIds.has(mcq.id));
    if (skippedQuestions.length > 0) {
      setReviewSkippedQuestions(skippedQuestions);
      setCurrentReviewIndex(0);
      setShowReviewSkippedDialog(true);
      setIsPaused(true); // Pause main timer during review
    } else {
      handleSubmitTest(); // No skipped questions, submit test
    }
  }, [mcqs, skippedMcqIds, handleSubmitTest]);

  const handleReviewNext = useCallback(() => {
    if (currentReviewIndex < reviewSkippedQuestions.length - 1) {
      setCurrentReviewIndex((prev) => prev + 1);
    } else {
      setShowReviewSkippedDialog(false);
      setIsPaused(false); // Resume main timer
      const nextUnansweredIndex = mcqs.findIndex(mcq => !userAnswers.has(mcq.id) || userAnswers.get(mcq.id) === null);
      if (nextUnansweredIndex !== -1) {
        setCurrentQuestionIndex(nextUnansweredIndex);
      } else {
        handleSubmitTest();
      }
    }
  }, [currentReviewIndex, reviewSkippedQuestions.length, skippedMcqIds, userAnswers, mcqs, handleSubmitTest]);

  const handleReviewPrevious = useCallback(() => {
    if (currentReviewIndex > 0) {
      setCurrentReviewIndex((prev) => prev - 1);
    }
  }, [currentReviewIndex]);

  const currentReviewMcq = reviewSkippedQuestions[currentReviewIndex];

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!hasCheckedInitialSession || isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Redirection handled by useEffect
  }

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
            <CardDescription>Select categories, difficulty, number of questions, and test duration.</CardDescription>
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
              <Label htmlFor="num-mcqs-input" className="text-lg font-semibold">Number of Questions</Label>
              <Input
                id="num-mcqs-input"
                type="number"
                min="1"
                value={numMcqsToSelect}
                onChange={(e) => setNumMcqsToSelect(Math.max(1, parseInt(e.target.value) || 1))}
                placeholder="e.g., 10, 50, 100"
              />
              <p className="text-sm text-muted-foreground">
                Specify the exact number of MCQs you want in your test.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration-input" className="text-lg font-semibold">Test Duration (minutes)</Label>
              <Input
                id="duration-input"
                type="number"
                min="1"
                value={testDurationMinutes}
                onChange={(e) => setTestDurationMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                placeholder="e.g., 30, 60, 180"
              />
              <p className="text-sm text-muted-foreground">
                Set the time limit for your test in minutes.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={startTestPreparation} disabled={isPageLoading}>
              {isPageLoading ? "Preparing Test..." : "Start Test"}
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
            <p><strong>Time Limit:</strong> {formatTime(testDurationMinutes * 60)}</p>
            <ul className="list-disc list-inside space-y-1">
              <li>You will be presented with {mcqs.length} multiple-choice questions.</li>
              <li>You have {formatTime(testDurationMinutes * 60)} to complete the test.</li>
              <li>Select one option for each question.</li>
              <li>You can navigate between questions using the "Previous" and "Next" buttons.</li>
              <li>Your answers will be saved automatically as you select them.</li>
              <li>The test will automatically submit when the time runs out.</li>
              <li>You can submit the test manually at any time by clicking "Submit Test" on the last question.</li>
              <li>You can also "Skip" questions and "Pause" the test.</li>
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

  if (mcqs.length === 0 && !isPageLoading && !showConfiguration && !showInstructions) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>No Test Available</CardTitle>
            <CardDescription>
              There are no MCQs available to create a test based on your selections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600 dark:text-gray-400">
              Please try a different selection or add more MCQs.
            </p>
          </CardContent>
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
                        const optionText = mcq[`option_${optionKey.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'];
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
            <Button variant="ghost" size="icon" onClick={togglePause} className="h-8 w-8">
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              <span className="sr-only">{isPaused ? "Resume" : "Pause"}</span>
            </Button>
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
            disabled={isPaused}
          >
            {['A', 'B', 'C', 'D'].map((optionKey) => {
              const optionText = currentMcq?.[`option_${optionKey.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'];
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
          <Button onClick={handlePrevious} disabled={currentQuestionIndex === 0 || isPaused} variant="outline">
            Previous
          </Button>
          <div className="flex gap-2">
            <Button onClick={handleSkip} disabled={isPaused} variant="secondary">
              <SkipForward className="h-4 w-4 mr-2" /> Skip
            </Button>
            {currentQuestionIndex === mcqs.length - 1 ? (
              <Button onClick={skippedMcqIds.size > 0 ? prepareReviewSkipped : handleSubmitTest} disabled={isPaused}>
                {skippedMcqIds.size > 0 ? `Review Skipped (${skippedMcqIds.size})` : "Submit Test"}
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={isPaused}>
                Next
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
      <MadeWithDyad />

      {/* Review Skipped Questions Dialog */}
      <Dialog open={showReviewSkippedDialog} onOpenChange={setShowReviewSkippedDialog}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Skipped Questions ({skippedMcqIds.size} remaining)</DialogTitle>
            <DialogDescription>
              You can answer these questions now or skip them again.
            </DialogDescription>
          </DialogHeader>
          {currentReviewMcq && (
            <div className="py-4">
              <p className="text-lg font-semibold mb-4">
                Question {currentReviewIndex + 1} / {reviewSkippedQuestions.length}: {currentReviewMcq.question_text}
              </p>
              <RadioGroup
                onValueChange={(value) => {
                  handleOptionSelect(value); // This will also remove from skippedMcqIds
                  // Update userAnswers for the current review MCQ
                  setUserAnswers((prev) => new Map(prev).set(currentReviewMcq.id, value));
                }}
                value={userAnswers.get(currentReviewMcq.id) || ""}
                className="space-y-2"
              >
                {['A', 'B', 'C', 'D'].map((optionKey) => {
                  const optionText = currentReviewMcq[`option_${optionKey.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'];
                  return (
                    <div key={optionKey} className="flex items-center space-x-2">
                      <RadioGroupItem value={optionKey} id={`review-option-${optionKey}`} />
                      <Label htmlFor={`review-option-${optionKey}`}>{`${optionKey}. ${optionText}`}</Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
          )}
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <Button variant="outline" onClick={() => {
              setShowReviewSkippedDialog(false);
              setIsPaused(false); // Resume timer if user exits review
              // Go back to the main quiz flow, potentially to the next unanswered question or submit
              const nextUnansweredIndex = mcqs.findIndex(mcq => !userAnswers.has(mcq.id) || userAnswers.get(mcq.id) === null);
              if (nextUnansweredIndex !== -1) {
                setCurrentQuestionIndex(nextUnansweredIndex);
              } else {
                handleSubmitTest();
              }
            }}>
              Back to Test
            </Button>
            <div className="flex gap-2">
              <Button onClick={handleReviewPrevious} disabled={currentReviewIndex === 0} variant="outline">
                Previous
              </Button>
              <Button onClick={handleReviewNext}>
                {currentReviewIndex === reviewSkippedQuestions.length - 1 ? "Finish Review" : "Next"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TakeTestPage;