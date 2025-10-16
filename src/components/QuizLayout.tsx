"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import QuizSidebar from './QuizSidebar';
import QuizPageContent from '@/pages/QuizPage'; // Renamed original QuizPage to QuizPageContent
import QuizNavigator from './QuizNavigator';
import { MCQ } from './mcq-columns'; // Assuming MCQ interface is here
import { MenuIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

// Interfaces copied from QuizPage.tsx for type consistency
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

interface DbQuizSession {
  id: string;
  user_id: string;
  category_id: string | null;
  subcategory_id: string | null;
  mcq_ids_order: string[];
  current_question_index: number;
  user_answers_json: { [mcqId: string]: UserAnswerData };
  is_trial_session: boolean;
  created_at: string;
  updated_at: string;
}

interface LoadedQuizSession {
  dbSessionId: string;
  categoryId: string;
  subcategory_id: string | null;
  mcqs: MCQ[];
  userAnswers: Map<string, UserAnswerData>;
  currentQuestionIndex: number;
  isTrialActiveSession: boolean;
  userId: string;
  categoryName: string;
  subcategoryName: string | null;
}

const TRIAL_MCQ_LIMIT = 10;

const QuizLayout = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Quiz State
  const [quizQuestions, setQuizQuestions] = useState<MCQ[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Map<string, UserAnswerData>>(new Map());
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [explanations, setExplanations] = useState<Map<string, MCQExplanation>>(new Map());

  // Category Selection State
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([]);
  const [currentQuizCategoryId, setCurrentQuizCategoryId] = useState<string | null>(null);
  const [currentQuizSubcategoryId, setCurrentQuizSubcategoryId] = useState<string | null>(null);
  const [currentDbSessionId, setCurrentDbSessionId] = useState<string | null>(null);
  const [showCategorySelection, setShowCategorySelection] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSavedQuizzes, setActiveSavedQuizzes] = useState<LoadedQuizSession[]>([]);

  // UI State
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [isTrialActiveSession, setIsTrialActiveSession] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // State for sidebar visibility
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false); // State for navigator visibility

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

  // Fetch quiz overview (categories, stats, saved sessions)
  const fetchQuizOverview = useCallback(async () => {
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
        loadedSavedQuizzes = dbSessions.map((dbSession: DbQuizSession) => {
          const categoryName = categoriesData?.find(c => c.id === dbSession.category_id)?.name || 'Unknown Category';
          const subcategoryName = subcategoriesData?.find(s => s.id === dbSession.subcategory_id)?.name || null;
          return {
            dbSessionId: dbSession.id,
            categoryId: dbSession.category_id || '',
            subcategory_id: dbSession.subcategory_id,
            mcqs: dbSession.mcq_ids_order.map((id: string) => ({
              id, question_text: 'Loading...', option_a: '', option_b: '', option_c: '', option_d: '',
              correct_answer: 'A', explanation_id: null, difficulty: null, is_trial_mcq: null, category_links: [],
            })),
            userAnswers: new Map(Object.entries(dbSession.user_answers_json)),
            currentQuestionIndex: dbSession.current_question_index,
            isTrialActiveSession: dbSession.is_trial_session,
            userId: dbSession.user_id,
            categoryName: categoryName,
            subcategoryName: subcategoryName,
          } as LoadedQuizSession;
        });
      }
    }
    setActiveSavedQuizzes(loadedSavedQuizzes);

    const categoriesWithStats: CategoryStat[] = [];
    for (const category of categoriesData || []) {
      const { count: mcqCount, error: mcqCountError } = await supabase
        .from('mcq_category_links')
        .select('mcq_id', { count: 'exact', head: true })
        .eq('category_id', category.id);

      if (mcqCountError) {
        console.error(`Error fetching total MCQ count for category ${category.name}:`, mcqCountError);
      }

      const { count: trialMcqCount, error: trialMcqCountError } = await supabase
        .from('mcq_category_links')
        .select(`mcq_id!inner(is_trial_mcq)`, { count: 'exact', head: true })
        .eq('category_id', category.id)
        .eq('mcq_id.is_trial_mcq', true);

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
  }, [user, toast, explanations]); // Added explanations to dependencies

  // Start a new quiz session
  const startQuizSession = useCallback(async (categoryId: string, subcategoryId: string | null, mode: 'random' | 'incorrect') => {
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
    setCurrentDbSessionId(null);

    let mcqIdsToFetch: string[] = [];
    let linksQuery = supabase.from('mcq_category_links').select('mcq_id').eq('category_id', categoryId);
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

    let mcqQuery = supabase
      .from('mcqs')
      .select(`*, mcq_category_links (category_id, subcategory_id, categories (name), subcategories (name))`)
      .in('id', mcqIdsToFetch)
      .order('created_at', { ascending: true });

    if (!isSubscribed) {
      mcqQuery = mcqQuery.eq('is_trial_mcq', true);
    }

    if (mode === 'incorrect' && user) {
      const { data: incorrectAttempts, error: attemptsError } = await supabase
        .from('user_quiz_attempts')
        .select('mcq_id')
        .eq('user_id', user!.id)
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
        category_id: link.category_id, category_name: link.categories?.name || null,
        subcategory_id: link.subcategory_id, subcategory_name: link.subcategories?.name || null,
      })),
    }));
    let mcqsToLoad: MCQ[] = formattedMcqs.slice(0, Math.min(formattedMcqs.length, (!isSubscribed) ? TRIAL_MCQ_LIMIT : formattedMcqs.length));
    if (mcqsToLoad.length === 0) {
      toast({ title: "No MCQs", description: "No questions available for this quiz session.", variant: "default" });
      setIsPageLoading(false);
      return;
    }

    setQuizQuestions(mcqsToLoad);
    setCurrentQuizCategoryId(categoryId);
    setCurrentQuizSubcategoryId(subcategoryId);
    setShowCategorySelection(false);
    setIsPageLoading(false);
    
    const initialUserAnswers = new Map<string, UserAnswerData>();
    mcqsToLoad.forEach(mcq => {
      initialUserAnswers.set(mcq.id, { selectedOption: null, isCorrect: null, submitted: false });
    });
    setUserAnswers(initialUserAnswers);
    setSelectedAnswer(null);

    if (user) {
      await saveQuizState(null, categoryId, subcategoryId, mcqsToLoad, initialUserAnswers, 0, isTrialActiveSession, user.id);
    }

    if (user && isTrialActiveSession && !hasTakenTrial) {
      const { error: updateError } = await supabase.from('profiles').update({ trial_taken: true }).eq('id', user.id);
      if (updateError) {
        console.error('Error marking trial_taken:', updateError);
        toast({ title: "Error", description: "Failed to update trial status.", variant: "destructive" });
      } else {
        toast({ title: "Trial Started!", description: `You have started your free trial. Enjoy ${TRIAL_MCQ_LIMIT} trial questions!`, variant: "default" });
      }
    }
  }, [user, toast, saveQuizState]);

  // Continue an existing quiz session
  const continueQuizSession = useCallback(async (loadedSession: LoadedQuizSession) => {
    setIsPageLoading(true);
    setCurrentDbSessionId(loadedSession.dbSessionId);
    setCurrentQuizCategoryId(loadedSession.categoryId);
    setCurrentQuizSubcategoryId(loadedSession.subcategory_id);
    setIsTrialActiveSession(loadedSession.isTrialActiveSession);

    const { data: mcqsData, error: mcqsError } = await supabase
      .from('mcqs')
      .select(`*, mcq_category_links (category_id, subcategory_id, categories (name), subcategories (name))`)
      .in('id', loadedSession.mcqs.map(m => m.id))
      .order('created_at', { ascending: true });

    if (mcqsError) {
      console.error('Error fetching MCQs for resumed session:', mcqsError);
      toast({ title: "Error", description: "Failed to load quiz questions for your saved session.", variant: "destructive" });
      setIsPageLoading(false);
      return;
    }

    const formattedMcqs: MCQ[] = mcqsData.map((mcq: any) => ({
      ...mcq,
      category_links: mcq.mcq_category_links.map((link: any) => ({
        category_id: link.category_id, category_name: link.categories?.name || null,
        subcategory_id: link.subcategory_id, subcategory_name: link.subcategories?.name || null,
      })),
    }));

    const orderedMcqs = loadedSession.mcqs.map(loadedMcq =>
      formattedMcqs.find(fetchedMcq => fetchedMcq.id === loadedMcq.id)
    ).filter((mcq): mcq is MCQ => mcq !== undefined);

    setQuizQuestions(orderedMcqs);
    setUserAnswers(loadedSession.userAnswers);
    setCurrentQuestionIndex(loadedSession.currentQuestionIndex);

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
    toast({ title: "Quiz Resumed", description: "Continuing from where you left off.", duration: 3000 });
  }, [toast, fetchExplanation]);

  // Reset quiz progress for a category
  const handleResetProgress = useCallback(async (categoryId: string) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to reset progress.", variant: "destructive" });
      return;
    }
    if (!window.confirm("Are you sure you want to delete your quiz progress for this category? This action cannot be undone.")) {
      return;
    }

    setIsPageLoading(true);
    try {
      const { error: dbError } = await supabase.from('user_quiz_attempts').delete().eq('user_id', user.id).eq('category_id', categoryId);
      if (dbError) { throw dbError; }

      const { error: deleteSessionsError } = await supabase.from('user_quiz_sessions').delete().eq('user_id', user.id).eq('category_id', categoryId);
      if (deleteSessionsError) { throw deleteSessionsError; }

      toast({ title: "Success", description: "Quiz progress reset successfully." });
      fetchQuizOverview();
    } catch (error: any) {
      console.error('Error resetting progress:', error);
      toast({ title: "Error", description: `Failed to reset progress: ${error.message}`, variant: "destructive" });
    } finally {
      setIsPageLoading(false);
    }
  }, [user, toast, fetchQuizOverview]);

  // Effect for initial data fetch and session check
  useEffect(() => {
    if (hasCheckedInitialSession) {
      if (!user) {
        setIsTrialActiveSession(true);
        fetchQuizOverview();
      } else {
        setIsTrialActiveSession(!user.has_active_subscription && !user.trial_taken);
        fetchQuizOverview();
      }
    }
  }, [user, hasCheckedInitialSession, fetchQuizOverview]);

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

  // Handle back to category selection
  const handleBackToSelection = useCallback(() => {
    const isCurrentQuizSaved = currentDbSessionId && activeSavedQuizzes.some(session => session.dbSessionId === currentDbSessionId);
    if (!isCurrentQuizSaved) {
      if (!window.confirm("Are you sure you want to end this quiz session and go back to category selection? Your current progress will be lost.")) {
        return;
      }
    }
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
    setCurrentQuizCategoryId(null);
    setCurrentQuizSubcategoryId(null);
    setCurrentDbSessionId(null);
    fetchQuizOverview();
  }, [currentDbSessionId, activeSavedQuizzes, fetchQuizOverview]);

  // Handle save progress
  const handleSaveProgress = useCallback(() => {
    if (!user) {
      toast({ title: "Cannot Save", description: "You must be logged in to save quiz progress.", variant: "destructive", duration: 3000 });
      return;
    }
    if (currentQuizCategoryId && quizQuestions.length > 0) {
      saveQuizState(currentDbSessionId, currentQuizCategoryId, currentQuizSubcategoryId, quizQuestions, userAnswers, currentQuestionIndex, isTrialActiveSession, user.id);
      toast({ title: "Progress Saved!", description: "Your quiz progress has been saved.", duration: 3000 });
    } else {
      toast({ title: "Cannot Save", description: "No active quiz session to save.", variant: "destructive", duration: 3000 });
    }
  }, [user, currentQuizCategoryId, quizQuestions, userAnswers, currentQuestionIndex, isTrialActiveSession, saveQuizState, currentDbSessionId, currentQuizSubcategoryId, toast]);

  // Handle go to question (for QuizNavigator)
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

  // Submit full quiz (end of quiz or trial limit)
  const submitFullQuiz = useCallback(async () => {
    let correctCount = 0;
    const explanationPromises: Promise<MCQExplanation | null>[] = [];
    const mcqExplanationIds = new Set<string>();

    for (const mcq of quizQuestions) {
      const userAnswerData = userAnswers.get(mcq.id);
      const isCorrect = userAnswerData?.isCorrect;
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
      clearSpecificQuizState(currentDbSessionId);
    }
  }, [quizQuestions, userAnswers, fetchExplanation, currentDbSessionId, clearSpecificQuizState]);

  if (!hasCheckedInitialSession || isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading quiz data...</p>
      </div>
    );
  }

  if (!user && !showCategorySelection) { // If not logged in and not on category selection, redirect
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
      <div className="min-h-screen flex bg-gray-100 dark:bg-gray-900">
        {isMobile ? (
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50">
                <MenuIcon className="h-6 w-6" />
                <span className="sr-only">Toggle quiz categories</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0 bg-background flex flex-col">
              <QuizSidebar
                categoryStats={categoryStats}
                allSubcategories={allSubcategories}
                activeSavedQuizzes={activeSavedQuizzes}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                currentQuizSubcategoryId={currentQuizSubcategoryId}
                setCurrentQuizSubcategoryId={setCurrentQuizSubcategoryId}
                startQuizSession={startQuizSession}
                continueQuizSession={continueQuizSession}
                clearSpecificQuizState={clearSpecificQuizState}
                handleResetProgress={handleResetProgress}
                user={user}
                isTrialActiveSession={isTrialActiveSession}
                showSubscriptionPrompt={showSubscriptionPrompt}
                setShowSubscriptionPrompt={setShowSubscriptionPrompt}
                onCloseSidebar={() => setIsSidebarOpen(false)}
              />
            </SheetContent>
          </Sheet>
        ) : (
          <QuizSidebar
            categoryStats={categoryStats}
            allSubcategories={allSubcategories}
            activeSavedQuizzes={activeSavedQuizzes}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            currentQuizSubcategoryId={currentQuizSubcategoryId}
            setCurrentQuizSubcategoryId={setCurrentQuizSubcategoryId}
            startQuizSession={startQuizSession}
            continueQuizSession={continueQuizSession}
            clearSpecificQuizState={clearSpecificQuizState}
            handleResetProgress={handleResetProgress}
            user={user}
            isTrialActiveSession={isTrialActiveSession}
            showSubscriptionPrompt={showSubscriptionPrompt}
            setShowSubscriptionPrompt={setShowSubscriptionPrompt}
            onCloseSidebar={() => {}} // No-op for desktop
          />
        )}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto flex flex-col items-center justify-center">
          <Card className="w-full max-w-2xl text-center">
            <CardHeader>
              <CardTitle>Select a Quiz Category</CardTitle>
              <CardDescription>
                Use the sidebar to choose a category and optionally a subcategory to start your quiz.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Your quiz options and saved progress will appear in the sidebar.
              </p>
            </CardContent>
            <CardFooter className="flex justify-center">
              {isMobile && (
                <Button onClick={() => setIsSidebarOpen(true)}>Open Categories</Button>
              )}
            </CardFooter>
          </Card>
          <MadeWithDyad />
        </main>
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
            <Button onClick={handleBackToSelection}>Go Back to Selection</Button>
          </CardFooter>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-100 dark:bg-gray-900">
      {/* Quiz Categories Sidebar (Retractable) */}
      {isMobile ? (
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50">
              <MenuIcon className="h-6 w-6" />
              <span className="sr-only">Toggle quiz categories</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0 bg-background flex flex-col">
            <QuizSidebar
              categoryStats={categoryStats}
              allSubcategories={allSubcategories}
              activeSavedQuizzes={activeSavedQuizzes}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              currentQuizSubcategoryId={currentQuizSubcategoryId}
              setCurrentQuizSubcategoryId={setCurrentQuizSubcategoryId}
              startQuizSession={startQuizSession}
              continueQuizSession={continueQuizSession}
              clearSpecificQuizState={clearSpecificQuizState}
              handleResetProgress={handleResetProgress}
              user={user}
              isTrialActiveSession={isTrialActiveSession}
              showSubscriptionPrompt={showSubscriptionPrompt}
              setShowSubscriptionPrompt={setShowSubscriptionPrompt}
              onCloseSidebar={() => setIsSidebarOpen(false)}
            />
          </SheetContent>
        </Sheet>
      ) : (
        <QuizSidebar
          categoryStats={categoryStats}
          allSubcategories={allSubcategories}
          activeSavedQuizzes={activeSavedQuizzes}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          currentQuizSubcategoryId={currentQuizSubcategoryId}
          setCurrentQuizSubcategoryId={setCurrentQuizSubcategoryId}
          startQuizSession={startQuizSession}
          continueQuizSession={continueQuizSession}
          clearSpecificQuizState={clearSpecificQuizState}
          handleResetProgress={handleResetProgress}
          user={user}
          isTrialActiveSession={isTrialActiveSession}
          showSubscriptionPrompt={showSubscriptionPrompt}
          setShowSubscriptionPrompt={setShowSubscriptionPrompt}
          onCloseSidebar={() => {}} // No-op for desktop
        />
      )}

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 overflow-auto">
        {/* Main Quiz Content */}
        {showResults ? (
          <div className="flex w-full max-w-6xl">
            {/* Quiz Navigator (Retractable) */}
            {isMobile ? (
              <Sheet open={isNavigatorOpen} onOpenChange={setIsNavigatorOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="fixed top-4 right-4 z-50">
                    <MenuIcon className="h-6 w-6" />
                    <span className="sr-only">Toggle quiz navigator</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64 p-0 bg-card flex flex-col">
                  <QuizNavigator
                    mcqs={quizQuestions}
                    userAnswers={userAnswers}
                    currentQuestionIndex={currentQuestionIndex}
                    goToQuestion={(index) => { goToQuestion(index); setIsNavigatorOpen(false); }}
                    showResults={true}
                    score={score}
                  />
                </SheetContent>
              </Sheet>
            ) : (
              <QuizNavigator
                mcqs={quizQuestions}
                userAnswers={userAnswers}
                currentQuestionIndex={currentQuestionIndex}
                goToQuestion={goToQuestion}
                showResults={true}
                score={score}
              />
            )}
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
                <Button onClick={handleBackToSelection}>Back to Categories</Button>
              </CardFooter>
            </Card>
          </div>
        ) : (
          <div className="flex w-full max-w-6xl">
            {/* Quiz Navigator (Retractable) */}
            {isMobile ? (
              <Sheet open={isNavigatorOpen} onOpenChange={setIsNavigatorOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="fixed top-4 right-4 z-50">
                    <MenuIcon className="h-6 w-6" />
                    <span className="sr-only">Toggle quiz navigator</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64 p-0 bg-card flex flex-col">
                  <QuizNavigator
                    mcqs={quizQuestions}
                    userAnswers={userAnswers}
                    currentQuestionIndex={currentQuestionIndex}
                    goToQuestion={(index) => { goToQuestion(index); setIsNavigatorOpen(false); }}
                    showResults={false}
                    score={0}
                  />
                </SheetContent>
              </Sheet>
            ) : (
              <QuizNavigator
                mcqs={quizQuestions}
                userAnswers={userAnswers}
                currentQuestionIndex={currentQuestionIndex}
                goToQuestion={goToQuestion}
                showResults={false}
                score={0}
              />
            )}
            <QuizPageContent
              quizQuestions={quizQuestions}
              currentQuestionIndex={currentQuestionIndex}
              setCurrentQuestionIndex={setCurrentQuestionIndex}
              userAnswers={userAnswers}
              setUserAnswers={setUserAnswers}
              selectedAnswer={selectedAnswer}
              setSelectedAnswer={setSelectedAnswer}
              feedback={feedback}
              setFeedback={setFeedback}
              showExplanation={showExplanation}
              setShowExplanation={setShowExplanation}
              isSubmittingAnswer={isSubmittingAnswer}
              setIsSubmittingAnswer={setIsSubmittingAnswer}
              isTrialActiveSession={isTrialActiveSession}
              fetchExplanation={fetchExplanation}
              submitFullQuiz={submitFullQuiz}
              handleBackToSelection={handleBackToSelection}
              handleSaveProgress={handleSaveProgress}
              isFeedbackDialogOpen={isFeedbackDialogOpen}
              setIsFeedbackDialogOpen={setIsFeedbackDialogOpen}
              feedbackText={feedbackText}
              setFeedbackText={setFeedbackText}
              isSubmittingFeedback={isSubmittingFeedback}
              setIsSubmittingFeedback={setIsSubmittingFeedback}
              explanations={explanations}
              user={user}
            />
          </div>
        )}
        <MadeWithDyad />
      </main>
    </div>
  );
};

export default QuizLayout;