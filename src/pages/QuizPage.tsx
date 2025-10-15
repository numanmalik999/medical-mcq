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
import { AlertCircle, CheckCircle2, RotateCcw, MessageSquareText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import QuizNavigator from '@/components/QuizNavigator'; // Import QuizNavigator

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
  is_trial_mcq: boolean | null;
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
  total_trial_mcqs: number;
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

const TRIAL_MCQ_LIMIT = 10;

const QuizPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [quizQuestions, setQuizQuestions] = useState<MCQ[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Map<string, string | null>>(new Map());
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true); // New combined loading state for initial data
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);

  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([]);
  const [currentQuizSubcategoryId, setCurrentQuizSubcategoryId] = useState<string | null>(null);
  const [showCategorySelection, setShowCategorySelection] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [explanations, setExplanations] = useState<Map<string, MCQExplanation>>(new Map());

  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [isTrialActiveSession, setIsTrialActiveSession] = useState(false); // True if user is in trial mode (either actual trial or guest)

  // State for feedback dialog
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

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
    if (hasCheckedInitialSession) {
      // If user is null (guest), force trial mode
      if (!user) {
        setIsTrialActiveSession(true);
        fetchQuizOverview(); // Fetch overview for guests
      } else {
        // If user is logged in, determine trial status
        if (!user.has_active_subscription && !user.trial_taken) {
          setIsTrialActiveSession(true);
        } else {
          setIsTrialActiveSession(false);
        }
        fetchQuizOverview(); // Fetch overview for logged-in users
      }
    }
  }, [user, hasCheckedInitialSession]); // Dependencies changed

  const fetchQuizOverview = async () => {
    setIsPageLoading(true); // Set loading for this specific fetch
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*');

    const { data: subcategoriesData, error: subcategoriesError } = await supabase
      .from('subcategories')
      .select('*');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
      setIsPageLoading(false);
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
      const { count: mcqCount, error: mcqCountError } = await supabase
        .from('mcqs')
        .select('id', { count: 'exact' })
        .eq('category_id', category.id);

      if (mcqCountError) {
        console.error(`Error fetching MCQ count for category ${category.name}:`, mcqCountError);
      }

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

      if (user) { // Only fetch user attempts if logged in
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
        total_trial_mcqs: trialMcqCount || 0,
        user_attempts: totalAttempts,
        user_correct: correctAttempts,
        user_incorrect: incorrectAttempts,
        user_accuracy: `${accuracy}%`,
      });
    }

    setCategoryStats(categoriesWithStats);
    setIsPageLoading(false); // Clear loading for this specific fetch
  };

  const startQuizSession = async (categoryId: string, subcategoryId: string | null, mode: 'random' | 'incorrect') => {
    const isSubscribed = user?.has_active_subscription;
    const hasTakenTrial = user?.trial_taken;

    // If not subscribed and trial is taken, show prompt
    if (!isSubscribed && hasTakenTrial) {
      setShowSubscriptionPrompt(true);
      return;
    }

    // If user is a guest, or logged in but not subscribed and hasn't taken trial, activate trial session
    if (!user || (!isSubscribed && !hasTakenTrial)) {
      setIsTrialActiveSession(true);
    } else {
      setIsTrialActiveSession(false);
    }

    // If guest or trial user tries to attempt incorrect questions, disallow
    if ((!user || isTrialActiveSession) && mode === 'incorrect') {
      toast({ title: "Feature Restricted", description: "This feature is only available for subscribed users.", variant: "default" });
      return;
    }

    setIsPageLoading(true); // Set loading for this specific fetch
    setQuizQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers(new Map());
    setSelectedAnswer(null);
    setFeedback(null);
    setShowExplanation(false);
    setScore(0);
    setExplanations(new Map());
    setShowResults(false);


    let query = supabase
      .from('mcqs')
      .select('*')
      .eq('category_id', categoryId);

    if (subcategoryId) {
      query = query.eq('subcategory_id', subcategoryId);
    }

    if (!isSubscribed) { // If not subscribed (includes guests and trial users)
      query = query.eq('is_trial_mcq', true);
    }

    let mcqsToLoad: MCQ[] = [];

    if (mode === 'random') {
      const { data, error } = await query;
      if (error) {
        console.error('Error fetching random MCQs:', error);
        toast({ title: "Error", description: "Failed to load quiz questions.", variant: "destructive" });
        setIsPageLoading(false);
        return;
      }
      if (!data || data.length === 0) {
        toast({ title: "No MCQs", description: "No MCQs found for the selected criteria.", variant: "default" });
        setIsPageLoading(false);
        return;
      }
      mcqsToLoad = data.sort(() => 0.5 - Math.random()).slice(0, Math.min(data.length, (!isSubscribed) ? TRIAL_MCQ_LIMIT : data.length));
    } else if (mode === 'incorrect') {
      // This block should only be reachable by subscribed users due to earlier check
      const { data: incorrectAttempts, error: attemptsError } = await supabase
        .from('user_quiz_attempts')
        .select('mcq_id')
        .eq('user_id', user!.id) // user is guaranteed to exist here
        .eq('category_id', categoryId)
        .eq('is_correct', false);

      if (attemptsError) {
        console.error('Error fetching incorrect attempts:', attemptsError);
        toast({ title: "Error", description: "Failed to load incorrect questions.", variant: "destructive" });
        setIsPageLoading(false);
        return;
      }

      const incorrectMcqIds = Array.from(new Set(incorrectAttempts?.map(attempt => attempt.mcq_id) || []));
      
      if (incorrectMcqIds.length === 0) {
        toast({ title: "No Incorrect MCQs", description: "You have no incorrect answers in this category to re-attempt.", variant: "default" });
        setIsPageLoading(false);
        return;
      }

      const { data: mcqsData, error: mcqsError } = await query.in('id', incorrectMcqIds);
      if (mcqsError) {
        console.error('Error fetching incorrect MCQs data:', mcqsError);
        toast({ title: "Error", description: "Failed to load incorrect questions data.", variant: "destructive" });
        setIsPageLoading(false);
        return;
      }
      mcqsToLoad = mcqsData || [];
    }

    if (mcqsToLoad.length === 0) {
      toast({ title: "No MCQs", description: "No questions available for this quiz session.", variant: "default" });
      setIsPageLoading(false);
      return;
    }

    setQuizQuestions(mcqsToLoad);
    setCurrentQuizSubcategoryId(subcategoryId);
    setShowCategorySelection(false);
    setIsPageLoading(false); // Clear loading for this specific fetch
    if (mcqsToLoad.length > 0) {
      setSelectedAnswer(userAnswers.get(mcqsToLoad[0].id) || null);
    }

    // Mark trial_taken only if a logged-in user starts a trial
    if (user && isTrialActiveSession && !hasTakenTrial) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ trial_taken: true })
        .eq('id', user.id);
      if (updateError) {
        console.error('Error marking trial_taken:', updateError);
        toast({ title: "Error", description: "Failed to update trial status.", variant: "destructive" });
      } else {
        // Update the user object in session context if possible, or trigger a re-fetch
        // For now, we'll rely on the next session refresh to pick this up.
        toast({ title: "Trial Started!", description: `You have started your free trial. Enjoy ${TRIAL_MCQ_LIMIT} trial questions!`, variant: "default" });
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

    setIsPageLoading(true); // Set loading for this specific fetch
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
      fetchQuizOverview();
    }
    setIsPageLoading(false); // Clear loading for this specific fetch
  };

  const currentMcq = quizQuestions[currentQuestionIndex];

  const handleOptionSelect = useCallback((value: string) => {
    if (currentMcq) {
      setSelectedAnswer(value);
      setUserAnswers((prev) => new Map(prev).set(currentMcq.id, value));
      setFeedback(null);
      setShowExplanation(false);
    }
  }, [currentMcq]);

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

    if (user) { // Only record attempts if user is logged in
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
      }
    } else {
      console.log("Guest user, not recording quiz attempt.");
    }
    
    // This block was previously a standalone 'finally' and caused the error.
    // Its contents are now correctly placed to execute unconditionally.
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
      setSelectedAnswer(userAnswers.get(nextQuestion?.id || '') || null);
      setFeedback(null);
      setShowExplanation(false);
    } else {
      submitFullQuiz();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      const prevQuestion = quizQuestions[currentQuestionIndex - 1];
      setCurrentQuestionIndex((prev) => prev - 1); // Corrected to go to previous
      setSelectedAnswer(userAnswers.get(prevQuestion?.id || '') || null);
      setFeedback(null);
      setShowExplanation(false);
    }
  };

  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < quizQuestions.length) {
      setCurrentQuestionIndex(index);
      const targetMcq = quizQuestions[index];
      setSelectedAnswer(userAnswers.get(targetMcq.id) || null);
      setFeedback(null);
      setShowExplanation(false);
    }
  }, [quizQuestions, userAnswers]);

  const submitFullQuiz = async () => {
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
    await Promise.all(explanationPromises);
    setShowResults(true);
    setIsPageLoading(false); // Clear loading for this specific fetch
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

      // Send email notification to admin
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          to: 'ADMIN_EMAIL', // This will be replaced by the actual ADMIN_EMAIL from env in the Edge Function
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

  const filteredCategories = categoryStats.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!hasCheckedInitialSession || isPageLoading) { // Use hasCheckedInitialSession for initial loading
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading quiz overview...</p>
      </div>
    );
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
                        {user?.has_active_subscription ? `${cat.total_mcqs} MCQs available` : `${cat.total_trial_mcqs} Trial MCQs available`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-2 text-sm">
                      {user && ( // Only show performance stats if logged in
                        <>
                          <p>Attempts: {cat.user_attempts}</p>
                          <p>Correct: {cat.user_correct}</p>
                          <p>Incorrect: {cat.user_incorrect}</p>
                          <p>Accuracy: {cat.user_accuracy}</p>
                        </>
                      )}
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
                          (user?.has_active_subscription && cat.total_mcqs === 0) ||
                          (!user?.has_active_subscription && cat.total_trial_mcqs === 0) ||
                          (!user?.has_active_subscription && user?.trial_taken)
                        }
                      >
                        {user?.has_active_subscription ? "Start Quiz" : (user?.trial_taken ? "Subscribe to Start" : "Start Trial Quiz")}
                      </Button>
                      <Button
                        onClick={() => startQuizSession(cat.id, currentQuizSubcategoryId, 'incorrect')}
                        className="w-full"
                        variant="secondary"
                        disabled={cat.user_incorrect === 0 || !user?.has_active_subscription}
                      >
                        Attempt Incorrect ({cat.user_incorrect})
                      </Button>
                      {user && ( // Only show reset progress if logged in
                        <Button
                          onClick={() => handleResetProgress(cat.id)}
                          className="w-full"
                          variant="destructive"
                          disabled={cat.user_attempts === 0}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" /> Reset Progress
                        </Button>
                      )}
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

  if (quizQuestions.length === 0 && !isPageLoading && !showCategorySelection && !showResults) {
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
        <div className="flex w-full max-w-6xl"> {/* Added flex container */}
          <QuizNavigator
            mcqs={quizQuestions}
            userAnswers={userAnswers}
            currentQuestionIndex={currentQuestionIndex}
            goToQuestion={goToQuestion}
            showResults={true}
            score={score}
          />
          <Card className="flex-1">
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
        </div>
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
      <div className="flex w-full max-w-6xl"> {/* Added flex container */}
        <QuizNavigator
          mcqs={quizQuestions}
          userAnswers={userAnswers}
          currentQuestionIndex={currentQuestionIndex}
          goToQuestion={goToQuestion}
          showResults={false} // Results not shown during active quiz
          score={0} // Score not relevant during active quiz
        />
        <Card className="flex-1">
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
              disabled={showExplanation}
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
                {user && ( // Only allow feedback if logged in
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
      </div>
      <MadeWithDyad />

      {/* Feedback Dialog */}
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
    </div>
  );
};

export default QuizPage;