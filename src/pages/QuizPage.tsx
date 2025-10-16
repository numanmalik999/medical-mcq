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
import { AlertCircle, CheckCircle2, RotateCcw, MessageSquareText, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import QuizNavigator from '@/components/QuizNavigator';
import { MCQ } from '@/components/mcq-columns';
import { cn } from '@/lib/utils'; // Import cn utility for conditional class names

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

interface UserAnswerData {
  selectedOption: string | null;
  isCorrect: boolean | null;
  submitted: boolean;
}

// Interface for data stored in the database (used internally for typing fetched data)
interface DbQuizSession {
  id: string;
  user_id: string;
  category_id: string | null;
  subcategory_id: string | null;
  mcq_ids_order: string[]; // Array of MCQ IDs
  current_question_index: number;
  user_answers_json: { [mcqId: string]: UserAnswerData }; // JSONB object
  is_trial_session: boolean;
  created_at: string;
  updated_at: string;
}

// Client-side representation of a loaded session, including full MCQ objects
interface LoadedQuizSession {
  dbSessionId: string; // The ID from the database
  categoryId: string;
  subcategory_id: string | null;
  mcqs: MCQ[]; // Full MCQ objects
  userAnswers: Map<string, UserAnswerData>;
  currentQuestionIndex: number;
  isTrialActiveSession: boolean;
  userId: string;
  categoryName: string; // Added for display
  subcategoryName: string | null; // Added for display
}

const TRIAL_MCQ_LIMIT = 10;
// LOCAL_STORAGE_QUIZ_KEY_PREFIX is no longer used for saving, but kept for potential migration or debugging.

const QuizPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [quizQuestions, setQuizQuestions] = useState<MCQ[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Map<string, UserAnswerData>>(new Map());
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);

  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([]);
  const [currentQuizCategoryId, setCurrentQuizCategoryId] = useState<string | null>(null); // Track the category of the current quiz
  const [currentQuizSubcategoryId, setCurrentQuizSubcategoryId] = useState<string | null>(null); // Track the subcategory of the current quiz
  const [currentDbSessionId, setCurrentDbSessionId] = useState<string | null>(null); // New: Track the DB session ID
  const [showCategorySelection, setShowCategorySelection] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [explanations, setExplanations] = useState<Map<string, MCQExplanation>>(new Map());

  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [isTrialActiveSession, setIsTrialActiveSession] = useState(false);

  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const [activeSavedQuizzes, setActiveSavedQuizzes] = useState<LoadedQuizSession[]>([]); // Changed to array of LoadedQuizSession

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

  // Function to save quiz state to the database
  const saveQuizState = useCallback(async (
    dbSessionId: string | null,
    categoryId: string,
    subcategoryId: string | null,
    mcqs: MCQ[],
    answers: Map<string, UserAnswerData>,
    index: number,
    isTrial: boolean,
    currentUserId: string
  ) => {
    if (!currentUserId) {
      console.warn("Cannot save quiz state: User not logged in.");
      return;
    }

    const mcqIdsOrder = mcqs.map(m => m.id);
    const userAnswersJson = Object.fromEntries(answers);

    const sessionData = {
      user_id: currentUserId,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      mcq_ids_order: mcqIdsOrder,
      current_question_index: index,
      user_answers_json: userAnswersJson,
      is_trial_session: isTrial,
    };

    try {
      if (dbSessionId) {
        // Update existing session
        const { error } = await supabase
          .from('user_quiz_sessions')
          .update({ ...sessionData, updated_at: new Date().toISOString() })
          .eq('id', dbSessionId);

        if (error) throw error;
        console.log(`Quiz session ${dbSessionId} updated in DB.`);
      } else {
        // Insert new session
        const { data, error } = await supabase
          .from('user_quiz_sessions')
          .insert(sessionData)
          .select('id')
          .single();

        if (error) throw error;
        setCurrentDbSessionId(data.id); // Store the new session ID
        console.log(`New quiz session ${data.id} created in DB.`);
      }
    } catch (error: any) {
      console.error("Error saving quiz state to DB:", error);
      toast({
        title: "Error",
        description: `Failed to save quiz progress: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    }
  }, [toast]);

  // Function to clear a specific quiz session from the database
  const clearSpecificQuizState = useCallback(async (dbSessionId: string) => {
    try {
      const { error } = await supabase
        .from('user_quiz_sessions')
        .delete()
        .eq('id', dbSessionId);

      if (error) throw error;
      console.log(`Quiz session ${dbSessionId} deleted from DB.`);
      setActiveSavedQuizzes(prev => prev.filter(session => session.dbSessionId !== dbSessionId));
    } catch (error: any) {
      console.error("Error clearing quiz state from DB:", error);
      toast({
        title: "Error",
        description: `Failed to clear quiz progress: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      if (!user) {
        setIsTrialActiveSession(true);
        fetchQuizOverview();
      } else {
        if (!user.has_active_subscription && !user.trial_taken) {
          setIsTrialActiveSession(true);
        } else {
          setIsTrialActiveSession(false);
        }
        fetchQuizOverview();
      }
    }
  }, [user, hasCheckedInitialSession]);

  const fetchQuizOverview = async () => {
    setIsPageLoading(true);
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

    // --- Load all saved quiz sessions for the current user from DB ---
    let loadedSavedQuizzes: LoadedQuizSession[] = [];
    if (user) {
      const { data: dbSessions, error: dbSessionsError } = await supabase
        .from('user_quiz_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (dbSessionsError) {
        console.error('Error fetching saved quiz sessions from DB:', dbSessionsError);
        toast({ title: "Error", description: "Failed to load saved quiz sessions.", variant: "destructive" });
      } else {
        // For each DB session, create a LoadedQuizSession stub for display
        loadedSavedQuizzes = dbSessions.map((dbSession: DbQuizSession) => {
          const categoryName = categoriesData?.find(c => c.id === dbSession.category_id)?.name || 'Unknown Category';
          const subcategoryName = subcategoriesData?.find(s => s.id === dbSession.subcategory_id)?.name || null;
          return {
            dbSessionId: dbSession.id,
            categoryId: dbSession.category_id || '', // Should always have a category_id
            subcategory_id: dbSession.subcategory_id,
            mcqs: dbSession.mcq_ids_order.map((id: string) => ({
              id,
              question_text: 'Loading...',
              option_a: '', // Placeholder
              option_b: '', // Placeholder
              option_c: '', // Placeholder
              option_d: '', // Placeholder
              correct_answer: 'A', // Placeholder
              explanation_id: null,
              difficulty: null,
              is_trial_mcq: null,
              category_links: [],
            })), // Placeholder MCQs
            userAnswers: new Map(Object.entries(dbSession.user_answers_json)),
            currentQuestionIndex: dbSession.current_question_index,
            isTrialActiveSession: dbSession.is_trial_session,
            userId: dbSession.user_id,
            categoryName: categoryName, // Add for display
            subcategoryName: subcategoryName, // Add for display
          } as LoadedQuizSession;
        });
      }
    }
    setActiveSavedQuizzes(loadedSavedQuizzes);
    // --- End New ---

    const categoriesWithStats: CategoryStat[] = [];

    for (const category of categoriesData || []) {
      // Count total MCQs for the category by querying mcq_category_links table directly
      const { count: mcqCount, error: mcqCountError } = await supabase
        .from('mcq_category_links')
        .select('mcq_id', { count: 'exact', head: true })
        .eq('category_id', category.id);

      if (mcqCountError) {
        console.error(`Error fetching total MCQ count for category ${category.name}:`, mcqCountError);
      }

      // Count trial MCQs for the category by joining mcq_category_links with mcqs
      const { count: trialMcqCount, error: trialMcqCountError } = await supabase
        .from('mcq_category_links')
        .select(`
          mcq_id!inner(is_trial_mcq)
        `, { count: 'exact', head: true })
        .eq('category_id', category.id)
        .eq('mcq_id.is_trial_mcq', true); // Filter on the joined table's column

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
        total_trial_mcqs: trialMcqCount || 0,
        user_attempts: totalAttempts,
        user_correct: correctAttempts,
        user_incorrect: incorrectAttempts,
        user_accuracy: `${accuracy}%`,
      });
    }

    setCategoryStats(categoriesWithStats);
    setIsPageLoading(false);
  };

  const startQuizSession = async (categoryId: string, subcategoryId: string | null, mode: 'random' | 'incorrect') => {
    const isSubscribed = user?.has_active_subscription;
    const hasTakenTrial = user?.trial_taken;

    if (!isSubscribed && hasTakenTrial) {
      setShowSubscriptionPrompt(true);
      return;
    }

    if (!user) {
      toast({ title: "Error", description: "You must be logged in to start a quiz.", variant: "destructive" });
      return;
    }

    if ((!isSubscribed && !hasTakenTrial)) {
      setIsTrialActiveSession(true);
    } else {
      setIsTrialActiveSession(false);
    }

    if ((!user || isTrialActiveSession) && mode === 'incorrect') {
      toast({ title: "Feature Restricted", description: "This feature is only available for subscribed users.", variant: "default" });
      return;
    }

    setIsPageLoading(true);
    setQuizQuestions([]);
    setUserAnswers(new Map());
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setFeedback(null);
    setShowExplanation(false);
    setScore(0);
    setExplanations(new Map());
    setShowResults(false);
    setCurrentDbSessionId(null); // Reset current DB session ID for a new quiz

    let mcqIdsToFetch: string[] = [];

    // Step 1: Get MCQ IDs from mcq_category_links based on category/subcategory
    let linksQuery = supabase
      .from('mcq_category_links')
      .select('mcq_id')
      .eq('category_id', categoryId);

    if (subcategoryId) {
      linksQuery = linksQuery.eq('subcategory_id', subcategoryId);
    }

    const { data: linkedMcqIdsData, error: linksError } = await linksQuery;

    if (linksError) {
      console.error('Error fetching linked MCQ IDs:', linksError);
      toast({ title: "Error", description: "Failed to load quiz questions data.", variant: "destructive" });
      setIsPageLoading(false);
      return;
    }

    mcqIdsToFetch = linkedMcqIdsData?.map(link => link.mcq_id) || [];

    if (mcqIdsToFetch.length === 0) {
      toast({ title: "No MCQs", description: "No MCQs found for the selected criteria.", variant: "default" });
      setIsPageLoading(false);
      return;
    }

    // Step 2: Filter by trial status if not subscribed
    let mcqQuery = supabase
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
      .in('id', mcqIdsToFetch)
      .order('created_at', { ascending: true }); // Ensure sequential order

    if (!isSubscribed) {
      mcqQuery = mcqQuery.eq('is_trial_mcq', true);
    }

    // Step 3: Filter by incorrect attempts if mode is 'incorrect'
    if (mode === 'incorrect' && user) {
      const { data: incorrectAttempts, error: attemptsError } = await supabase
        .from('user_quiz_attempts')
        .select('mcq_id')
        .eq('user_id', user!.id)
        .eq('category_id', categoryId)
        .eq('is_correct', false);

      if (attemptsError) {
        console.error('Error fetching incorrect attempts:', attemptsError);
        toast({ title: "Feature Restricted", description: "Failed to load incorrect questions.", variant: "destructive" });
        setIsPageLoading(false);
        return;
      }

      const incorrectMcqIds = Array.from(new Set(incorrectAttempts?.map(attempt => attempt.mcq_id) || []));
      
      if (incorrectMcqIds.length === 0) {
        toast({ title: "No Incorrect MCQs", description: "You have no incorrect answers in this category to re-attempt.", variant: "default" });
        setIsPageLoading(false);
        return;
      }
      // Intersect mcqIdsToFetch with incorrectMcqIds
      mcqIdsToFetch = mcqIdsToFetch.filter(id => incorrectMcqIds.includes(id));
      if (mcqIdsToFetch.length === 0) {
        toast({ title: "No MCQs", description: "No MCQs found for the selected criteria.", variant: "default" });
        setIsPageLoading(false);
        return;
      }
      mcqQuery = mcqQuery.in('id', mcqIdsToFetch);
    }

    const { data: mcqsData, error: mcqsError } = await mcqQuery;

    if (mcqsError) {
      console.error('Error fetching MCQs data for quiz session:', mcqsError);
      toast({ title: "Error", description: "Failed to load quiz questions data.", variant: "destructive" });
      setIsPageLoading(false);
      return;
    }

    if (!mcqsData || mcqsData.length === 0) {
      toast({ title: "No MCQs", description: "No questions available for this quiz session.", variant: "default" });
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

    let mcqsToLoad: MCQ[] = formattedMcqs.slice(0, Math.min(formattedMcqs.length, (!isSubscribed) ? TRIAL_MCQ_LIMIT : formattedMcqs.length));

    if (mcqsToLoad.length === 0) {
      toast({ title: "No MCQs", description: "No questions available for this quiz session.", variant: "default" });
      setIsPageLoading(false);
      return;
    }

    setQuizQuestions(mcqsToLoad);
    setCurrentQuizCategoryId(categoryId); // Set the category for the current quiz
    setCurrentQuizSubcategoryId(subcategoryId);
    setShowCategorySelection(false);
    setIsPageLoading(false);
    
    // Initialize userAnswers for all questions
    const initialUserAnswers = new Map<string, UserAnswerData>();
    mcqsToLoad.forEach(mcq => {
      initialUserAnswers.set(mcq.id, { selectedOption: null, isCorrect: null, submitted: false });
    });
    setUserAnswers(initialUserAnswers);
    setSelectedAnswer(null); // No answer selected initially for the first question

    // Create a new session in the database
    if (user) {
      await saveQuizState(
        null, // No existing session ID
        categoryId,
        subcategoryId,
        mcqsToLoad,
        initialUserAnswers,
        0, // currentQuestionIndex
        isTrialActiveSession,
        user.id
      );
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
        toast({ title: "Trial Started!", description: `You have started your free trial. Enjoy ${TRIAL_MCQ_LIMIT} trial questions!`, variant: "default" });
      }
    }
  };

  const continueQuizSession = useCallback(async (loadedSession: LoadedQuizSession) => {
    setIsPageLoading(true);
    setCurrentDbSessionId(loadedSession.dbSessionId);
    setCurrentQuizCategoryId(loadedSession.categoryId);
    setCurrentQuizSubcategoryId(loadedSession.subcategory_id);
    setIsTrialActiveSession(loadedSession.isTrialActiveSession);

    // Fetch full MCQ objects based on mcq_ids_order from the loaded session
    const { data: mcqsData, error: mcqsError } = await supabase
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
      .in('id', loadedSession.mcqs.map(m => m.id)) // Use the IDs from the placeholder MCQs
      .order('created_at', { ascending: true }); // Maintain original order if possible

    if (mcqsError) {
      console.error('Error fetching MCQs for resumed session:', mcqsError);
      toast({ title: "Error", description: "Failed to load quiz questions for your saved session.", variant: "destructive" });
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

    // Reorder fetched MCQs to match mcq_ids_order
    const orderedMcqs = loadedSession.mcqs.map(loadedMcq => 
      formattedMcqs.find(fetchedMcq => fetchedMcq.id === loadedMcq.id)
    ).filter((mcq): mcq is MCQ => mcq !== undefined);

    setQuizQuestions(orderedMcqs);
    setUserAnswers(loadedSession.userAnswers);
    setCurrentQuestionIndex(loadedSession.currentQuestionIndex);

    // Set selectedAnswer, feedback, and showExplanation for the current question
    const currentMcqFromSaved = orderedMcqs[loadedSession.currentQuestionIndex];
    const currentAnswerDataFromSaved = loadedSession.userAnswers.get(currentMcqFromSaved.id);
    setSelectedAnswer(currentAnswerDataFromSaved?.selectedOption || null);
    setFeedback(currentAnswerDataFromSaved?.submitted ? (currentAnswerDataFromSaved.isCorrect ? 'Correct!' : `Incorrect. The correct answer was ${currentMcqFromSaved.correct_answer}.`) : null);
    setShowExplanation(currentAnswerDataFromSaved?.submitted || false);
    if (currentAnswerDataFromSaved?.submitted && currentMcqFromSaved.explanation_id) {
      fetchExplanation(currentMcqFromSaved.explanation_id);
    }

    setShowCategorySelection(false);
    setIsPageLoading(false);
    toast({
      title: "Quiz Resumed",
      description: "Continuing from where you left off.",
      duration: 3000,
    });
  }, [fetchExplanation, toast]);

  // Effect to update database whenever quiz state changes
  useEffect(() => {
    if (user && currentDbSessionId && !showCategorySelection && quizQuestions.length > 0 && !showResults && currentQuizCategoryId) {
      saveQuizState(
        currentDbSessionId,
        currentQuizCategoryId,
        currentQuizSubcategoryId,
        quizQuestions,
        userAnswers,
        currentQuestionIndex,
        isTrialActiveSession,
        user.id
      );
    }
  }, [quizQuestions, userAnswers, currentQuestionIndex, isTrialActiveSession, showCategorySelection, showResults, saveQuizState, user, currentQuizCategoryId, currentQuizSubcategoryId, currentDbSessionId]);


  const handleResetProgress = async (categoryId: string) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to reset progress.", variant: "destructive" });
      return;
    }
    if (!window.confirm("Are you sure you want to delete your quiz progress for this category? This action cannot be undone.")) {
      return;
    }

    setIsPageLoading(true);
    try {
      // 1. Delete user quiz attempts from the database
      const { error: dbError } = await supabase
        .from('user_quiz_attempts')
        .delete()
        .eq('user_id', user.id)
        .eq('category_id', categoryId);

      if (dbError) {
        throw dbError;
      }

      // 2. Clear all associated saved quiz sessions from the database
      const { error: deleteSessionsError } = await supabase
        .from('user_quiz_sessions')
        .delete()
        .eq('user_id', user.id)
        .eq('category_id', categoryId);

      if (deleteSessionsError) {
        throw deleteSessionsError;
      }

      toast({ title: "Success", description: "Quiz progress reset successfully." });
      fetchQuizOverview(); // Refresh overview data including category stats and saved sessions
    } catch (error: any) {
      console.error('Error resetting progress:', error);
      toast({ title: "Error", description: `Failed to reset progress: ${error.message}`, variant: "destructive" });
    } finally {
      setIsPageLoading(false);
    }
  };

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
  }, [currentMcq, setUserAnswers]);

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

    // Update userAnswers with submission status and correctness
    setUserAnswers((prev: Map<string, UserAnswerData>) => {
      const newMap = new Map(prev);
      newMap.set(currentMcq.id, { selectedOption: selectedAnswer, isCorrect: isCorrect, submitted: true });
      return newMap;
    });

    if (user) {
      try {
        // For recording attempts, we need a single category_id and subcategory_id.
        // We'll use the first one from category_links if available.
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

  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < quizQuestions.length) {
      setCurrentQuestionIndex(index);
      const targetMcq = quizQuestions[index];
      const targetAnswerData = userAnswers.get(targetMcq.id);
      setSelectedAnswer(targetAnswerData?.selectedOption || null);
      setFeedback(targetAnswerData?.submitted ? (targetAnswerData.isCorrect ? 'Correct!' : `Incorrect. The correct answer was ${targetMcq.correct_answer}.`) : null);
      setShowExplanation(targetAnswerData?.submitted || false);
      if (targetAnswerData?.submitted && targetMcq.explanation_id) {
        fetchExplanation(targetMcq.explanation_id);
      }
    }
  }, [quizQuestions, userAnswers, fetchExplanation]);

  const submitFullQuiz = async () => {
    let correctCount = 0;
    const explanationPromises: Promise<MCQExplanation | null>[] = [];
    const mcqExplanationIds = new Set<string>();

    for (const mcq of quizQuestions) {
      const userAnswerData = userAnswers.get(mcq.id);
      const isCorrect = userAnswerData?.isCorrect; // Use stored correctness
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
    setIsPageLoading(false);
    if (currentDbSessionId) {
      clearSpecificQuizState(currentDbSessionId); // Clear saved state after quiz submission
    }
  };

  const handleSaveProgress = () => {
    if (!user) {
      toast({
        title: "Cannot Save",
        description: "You must be logged in to save quiz progress.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    if (currentQuizCategoryId && quizQuestions.length > 0) {
      saveQuizState(
        currentDbSessionId,
        currentQuizCategoryId,
        currentQuizSubcategoryId,
        quizQuestions,
        userAnswers,
        currentQuestionIndex,
        isTrialActiveSession,
        user.id
      );
      toast({
        title: "Progress Saved!",
        description: "Your quiz progress has been saved.",
        duration: 3000,
      });
    } else {
      toast({
        title: "Cannot Save",
        description: "No active quiz session to save.",
        variant: "destructive",
        duration: 3000,
      });
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

  const handleBackToSelection = () => {
    // Check if the current quiz session is saved in the database
    const isCurrentQuizSaved = currentDbSessionId && activeSavedQuizzes.some(session => session.dbSessionId === currentDbSessionId);

    if (!isCurrentQuizSaved) { // Only show warning if not explicitly saved
      if (!window.confirm("Are you sure you want to end this quiz session and go back to category selection? Your current progress will be lost.")) {
        return; // User cancelled
      }
    }

    // If we reach here, either it was saved, or the user confirmed to lose unsaved progress
    setQuizQuestions([]);
    setUserAnswers(new Map());
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setFeedback(null);
    setShowExplanation(false);
    setScore(0);
    setExplanations(new Map());
    setShowResults(false);
    setShowCategorySelection(true);
    setCurrentQuizCategoryId(null); // Reset current quiz category
    setCurrentQuizSubcategoryId(null); // Reset subcategory selection
    setCurrentDbSessionId(null); // Reset DB session ID
    fetchQuizOverview(); // Refresh overview data
  };

  const filteredCategories = categoryStats.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!hasCheckedInitialSession || isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 pt-16">
        <p className="text-gray-700 dark:text-gray-300">Loading quiz overview...</p>
      </div>
    );
  }

  if (showSubscriptionPrompt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Select a Quiz Category</CardTitle>
            <CardDescription>Choose a category and optionally a subcategory to start your quiz and view your performance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeSavedQuizzes.length > 0 && (
              <Card className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950">
                <CardHeader>
                  <CardTitle className="text-blue-700 dark:text-blue-300">Continue Your Quizzes</CardTitle>
                  <CardDescription className="text-blue-600 dark:text-blue-400">
                    Pick up where you left off in any of your saved quiz sessions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeSavedQuizzes.map((savedState) => {
                    const progress = savedState.currentQuestionIndex + 1;
                    const total = savedState.mcqs.length;

                    return (
                      <div key={savedState.dbSessionId} className="flex flex-col sm:flex-row items-center justify-between p-3 border rounded-md bg-white dark:bg-gray-800">
                        <div>
                          <p className="font-semibold">{savedState.categoryName} {savedState.subcategoryName ? `(${savedState.subcategoryName})` : ''}</p>
                          <p className="text-sm text-muted-foreground">Question {progress} of {total}</p>
                        </div>
                        <div className="flex gap-2 mt-2 sm:mt-0">
                          <Button onClick={() => continueQuizSession(savedState)} size="sm">Continue</Button>
                          <Button onClick={() => clearSpecificQuizState(savedState.dbSessionId)} variant="outline" size="sm">Clear</Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
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
                {filteredCategories.map((cat) => {
                  // Check if there's a saved session for this category and the currently selected subcategory
                  const savedSessionForCurrentSelection = activeSavedQuizzes.find(
                    (session) =>
                      session.categoryId === cat.id &&
                      session.subcategory_id === currentQuizSubcategoryId
                  );

                  return (
                    <Card key={cat.id} className="flex flex-col">
                      <CardHeader>
                        <CardTitle className="text-lg">{cat.name}</CardTitle>
                        <CardDescription>
                          {user?.has_active_subscription ? `${cat.total_mcqs} MCQs available` : `${cat.total_trial_mcqs} Trial MCQs available`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow space-y-2 text-sm">
                        {user && (
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
                        {savedSessionForCurrentSelection ? (
                          <Button
                            onClick={() => continueQuizSession(savedSessionForCurrentSelection)}
                            className="w-full"
                          >
                            Continue Quiz
                          </Button>
                        ) : (
                          <Button
                            onClick={() => startQuizSession(cat.id, currentQuizSubcategoryId, 'random')}
                            className="w-full"
                            disabled={
                              !user || // Disable if not logged in
                              (user?.has_active_subscription && cat.total_mcqs === 0) ||
                              (!user?.has_active_subscription && cat.total_trial_mcqs === 0) ||
                              (!user?.has_active_subscription && user?.trial_taken)
                            }
                          >
                            {user?.has_active_subscription ? "Start Quiz" : (user?.trial_taken ? "Subscribe to Start" : "Start Trial Quiz")}
                          </Button>
                        )}
                        <Button
                          onClick={() => startQuizSession(cat.id, currentQuizSubcategoryId, 'incorrect')}
                          className="w-full"
                          variant="secondary"
                          disabled={cat.user_incorrect === 0 || !user?.has_active_subscription}
                        >
                          Attempt Incorrect ({cat.user_incorrect})
                        </Button>
                        {user && (
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
                  );
                })}
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
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
            <Button onClick={handleBackToSelection}>Go Back to Selection</Button>
          </CardFooter>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
        <div className="flex w-full max-w-6xl">
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
                  const userAnswerData = userAnswers.get(mcq.id);
                  const userAnswer = userAnswerData?.selectedOption;
                  const isCorrect = userAnswerData?.isCorrect;
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
                              {optionKey}. {optionText as string}
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
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 pt-16">
        <p className="text-gray-700 dark:text-gray-300">Loading current question...</p>
      </div>
    );
  }

  const currentAnswerData = userAnswers.get(currentMcq.id);
  const isAnswered = currentAnswerData?.selectedOption !== null;
  const isSubmitted = currentAnswerData?.submitted;
  const isLastQuestion = currentQuestionIndex === quizQuestions.length - 1;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
      <div className="flex w-full max-w-6xl">
        <QuizNavigator
          mcqs={quizQuestions}
          userAnswers={userAnswers}
          currentQuestionIndex={currentQuestionIndex}
          goToQuestion={goToQuestion}
          showResults={false}
          score={0}
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
              <Button onClick={handleSaveProgress} variant="secondary" disabled={isSubmittingAnswer || !currentQuizCategoryId || !user}>
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
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default QuizPage;