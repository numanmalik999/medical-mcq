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
import { TimerIcon, Pause, Play, SkipForward, Save, Bookmark, BookmarkCheck, ArrowLeft } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MCQ } from '@/components/mcq-columns';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import QuizNavigator from '@/components/QuizNavigator';
import { useBookmark } from '@/hooks/use-bookmark';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

interface MCQExplanation {
  id: string;
  explanation_text: string;
  image_url: string | null;
}

interface Category {
  id: string;
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
  mcq_ids_order: string[];
  current_question_index: number;
  user_answers_json: { [mcqId: string]: UserAnswerData };
  is_trial_session: boolean;
  test_duration_seconds: number | null;
  remaining_time_seconds: number | null;
  skipped_mcq_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

interface LoadedTestSession {
  dbSessionId: string;
  categoryIds: string[];
  categoryNames: string[];
  mcqs: MCQ[];
  userAnswers: Map<string, UserAnswerData>;
  currentQuestionIndex: number;
  testDurationSeconds: number;
  remainingTimeSeconds: number;
  skippedMcqIds: Set<string>;
  userId: string;
}

const UNCATEGORIZED_ID = 'uncategorized-mcqs-virtual-id';

const TakeTestPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [numMcqsToSelect, setNumMcqsToSelect] = useState<number>(10);
  const [testDurationMinutes, setTestDurationMinutes] = useState<number>(60);
  const [showConfiguration, setShowConfiguration] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);

  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Map<string, UserAnswerData>>(new Map());
  const [isTestSubmitted, setIsTestSubmitted] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [timer, setTimer] = useState(testDurationMinutes * 60);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [explanations, setExplanations] = useState<Map<string, MCQExplanation>>(new Map());

  const [isPaused, setIsPaused] = useState(false);
  const [skippedMcqIds, setSkippedMcqIds] = useState<Set<string>>(new Set());
  const [showReviewSkippedDialog, setShowReviewSkippedDialog] = useState(false);
  const [reviewSkippedQuestions, setReviewSkippedQuestions] = useState<MCQ[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  const [currentDbSessionId, setCurrentDbSessionId] = useState<string | null>(null);
  const [activeSavedTests, setActiveSavedTests] = useState<LoadedTestSession[]>([]);

  const timerIntervalRef = useRef<number | null>(null);

  const currentMcq = mcqs[currentQuestionIndex];
  const { isBookmarked, toggleBookmark, isLoading: isBookmarkLoading } = useBookmark(currentMcq?.id || null);

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

  const saveTestState = useCallback(async (
    dbSessionId: string | null,
    categoryIds: string[],
    mcqs: MCQ[],
    answers: Map<string, UserAnswerData>,
    index: number,
    duration: number,
    remaining: number,
    skipped: Set<string>,
    currentUserId: string
  ): Promise<{ id: string; sessionData: DbQuizSession } | null> => {
    if (!currentUserId) {
      console.warn("Cannot save test state: User not logged in.");
      return null;
    }

    const mcqIdsOrder = mcqs.map(m => m.id);
    const userAnswersJson = Object.fromEntries(answers);
    const skippedMcqIdsArray = Array.from(skipped);
    const primaryCategoryId = categoryIds.length > 0 ? categoryIds[0] : null;

    const sessionData = {
      user_id: currentUserId,
      category_id: primaryCategoryId,
      mcq_ids_order: mcqIdsOrder,
      current_question_index: index,
      user_answers_json: userAnswersJson,
      is_trial_session: false,
      test_duration_seconds: duration,
      remaining_time_seconds: remaining,
      skipped_mcq_ids: skippedMcqIdsArray,
    };

    try {
      if (dbSessionId) {
        const { data, error } = await supabase
          .from('user_quiz_sessions')
          .update({ ...sessionData, updated_at: new Date().toISOString() })
          .eq('id', dbSessionId)
          .select('id')
          .single();
        if (error) throw error;
        return { id: data.id, sessionData: { ...sessionData, id: data.id, created_at: '', updated_at: new Date().toISOString() } as DbQuizSession };
      } else {
        const { data, error } = await supabase
          .from('user_quiz_sessions')
          .insert(sessionData)
          .select('id, created_at, updated_at')
          .single();
        if (error) throw error;
        setCurrentDbSessionId(data.id);
        return { id: data.id, sessionData: { ...sessionData, id: data.id, created_at: data.created_at, updated_at: data.updated_at } as DbQuizSession };
      }
    } catch (error: any) {
      console.error("Error saving test state to DB:", error);
      toast({
        title: "Error",
        description: `Failed to save test progress: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const clearSpecificTestState = useCallback(async (dbSessionId: string) => {
    try {
      const { error } = await supabase
        .from('user_quiz_sessions')
        .delete()
        .eq('id', dbSessionId);
      if (error) throw error;
      setActiveSavedTests(prev => prev.filter(session => session.dbSessionId !== dbSessionId));
    } catch (error: any) {
      console.error("Error clearing test state from DB:", error);
      toast({
        title: "Error",
        description: `Failed to clear test progress: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleSubmitTest = useCallback(async () => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to submit a test.", variant: "destructive" });
      return;
    }

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsTestSubmitted(true);
    setIsPaused(true);

    let correctCount = 0;
    const attemptsToRecord = [];
    const explanationPromises: Promise<MCQExplanation | null>[] = [];
    const mcqExplanationIds = new Set<string>();
    const finalUserAnswers = new Map(userAnswers);

    for (const mcq of mcqs) {
      const userAnswerData = finalUserAnswers.get(mcq.id);
      const selectedOption = userAnswerData?.selectedOption || null;
      const isCorrect = selectedOption === mcq.correct_answer;
      if (isCorrect) correctCount++;
      finalUserAnswers.set(mcq.id, { selectedOption, isCorrect, submitted: true });
      attemptsToRecord.push({
        user_id: user.id,
        mcq_id: mcq.id,
        category_id: mcq.category_links?.[0]?.category_id || null,
        selected_option: selectedOption || 'N/A',
        is_correct: isCorrect,
      });
      if (mcq.explanation_id && !mcqExplanationIds.has(mcq.explanation_id)) {
        mcqExplanationIds.add(mcq.explanation_id);
        explanationPromises.push(fetchExplanation(mcq.explanation_id));
      }
    }

    setUserAnswers(finalUserAnswers);
    setScore(correctCount);
    await Promise.all(explanationPromises);
    setShowResults(true);

    if (attemptsToRecord.length > 0) {
      const { error } = await supabase.from('user_quiz_attempts').insert(attemptsToRecord);
      if (error) {
        toast({ title: "Error", description: `Failed to record test attempts: ${error.message}`, variant: "destructive" });
      } else {
        toast({ title: "Test Submitted!", description: `You scored ${correctCount} out of ${mcqs.length}.` });
      }
    }

    if (currentDbSessionId) clearSpecificTestState(currentDbSessionId);
  }, [user, mcqs, userAnswers, toast, fetchExplanation, currentDbSessionId, clearSpecificTestState]);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      if (user && user.has_active_subscription) fetchTestOverview();
      else if (user && !user.has_active_subscription) setIsPageLoading(false);
      else navigate('/login');
    }
  }, [user, hasCheckedInitialSession, navigate, toast]);

  const fetchTestOverview = async () => {
    setIsPageLoading(true);
    const { data: categoriesData, error: categoriesError } = await supabase.from('categories').select('*');
    if (categoriesError) {
      toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
      setIsPageLoading(false);
      return;
    }
    setAllCategories([...(categoriesData || []), { id: UNCATEGORIZED_ID, name: 'Uncategorized' }]);

    if (user) {
      const { data: dbSessions, error: dbSessionsError } = await supabase.from('user_quiz_sessions').select('*').eq('user_id', user.id).eq('is_trial_session', false).order('updated_at', { ascending: false });
      if (dbSessionsError) {
        toast({ title: "Error", description: "Failed to load saved tests.", variant: "destructive" });
      } else {
        const loadedSavedTests = dbSessions.map((dbSession: DbQuizSession) => {
          const categoryName = categoriesData?.find(c => c.id === dbSession.category_id)?.name || 'Mixed Categories';
          return {
            dbSessionId: dbSession.id,
            categoryIds: dbSession.category_id ? [dbSession.category_id] : [],
            categoryNames: [categoryName],
            mcqs: dbSession.mcq_ids_order.map(id => ({ id, question_text: 'Loading...', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', explanation_id: null, difficulty: null, is_trial_mcq: null, category_links: [] })),
            userAnswers: new Map(Object.entries(dbSession.user_answers_json)),
            currentQuestionIndex: dbSession.current_question_index,
            testDurationSeconds: dbSession.test_duration_seconds || 0,
            remainingTimeSeconds: dbSession.remaining_time_seconds || 0,
            skippedMcqIds: new Set(dbSession.skipped_mcq_ids || []),
            userId: user.id,
          } as LoadedTestSession;
        });
        setActiveSavedTests(loadedSavedTests);
      }
    }
    setIsPageLoading(false);
  };

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
        setTimer(prev => {
          if (prev <= 1) {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            handleSubmitTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000) as unknown as number;
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isPageLoading, isTestSubmitted, showResults, showConfiguration, showInstructions, mcqs.length, isPaused, handleSubmitTest]);

  useEffect(() => {
    if (user && currentDbSessionId && !showConfiguration && !showInstructions && !showResults && !isTestSubmitted && mcqs.length > 0) {
      const timeoutId = setTimeout(() => {
        saveTestState(currentDbSessionId, selectedCategoryIds, mcqs, userAnswers, currentQuestionIndex, testDurationMinutes * 60, timer, skippedMcqIds, user.id);
      }, 5000);
      return () => clearTimeout(timeoutId);
    }
  }, [user, currentDbSessionId, showConfiguration, showInstructions, showResults, isTestSubmitted, mcqs, userAnswers, currentQuestionIndex, testDurationMinutes, timer, skippedMcqIds, saveTestState, selectedCategoryIds]);

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategoryIds(prev => {
      if (categoryId === UNCATEGORIZED_ID) return prev.includes(UNCATEGORIZED_ID) ? [] : [UNCATEGORIZED_ID];
      const newSelection = prev.filter(id => id !== UNCATEGORIZED_ID);
      return newSelection.includes(categoryId) ? newSelection.filter(id => id !== categoryId) : [...newSelection, categoryId];
    });
  };

  const startTestPreparation = async () => {
    if (!user || !user.has_active_subscription) {
      toast({ title: "Error", description: "You must have an active subscription to start a test.", variant: "destructive" });
      return;
    }
    if (numMcqsToSelect <= 0 || testDurationMinutes <= 0) {
      toast({ title: "Error", description: "Number of questions and duration must be greater than 0.", variant: "destructive" });
      return;
    }
    setIsPageLoading(true);
    let mcqIdsToFilter: string[] | null = null;
    const isUncategorized = selectedCategoryIds.includes(UNCATEGORIZED_ID);
    const regularIds = selectedCategoryIds.filter(id => id !== UNCATEGORIZED_ID);
    if (isUncategorized && regularIds.length === 0) {
      const { data: links, error } = await supabase.from('mcq_category_links').select('mcq_id');
      if (error) { toast({ title: "Error", description: "Failed to identify uncategorized questions.", variant: "destructive" }); setIsPageLoading(false); return; }
      const categorizedIds = new Set(links?.map(l => l.mcq_id) || []);
      const { data: allIds, error: allError } = await supabase.from('mcqs').select('id');
      if (allError) { toast({ title: "Error", description: "Failed to fetch all MCQs.", variant: "destructive" }); setIsPageLoading(false); return; }
      mcqIdsToFilter = (allIds?.map(m => m.id) || []).filter(id => !categorizedIds.has(id));
    } else if (regularIds.length > 0) {
      const { data: links, error } = await supabase.from('mcq_category_links').select('mcq_id').in('category_id', regularIds);
      if (error) { toast({ title: "Error", description: "Failed to filter by category.", variant: "destructive" }); setIsPageLoading(false); return; }
      mcqIdsToFilter = Array.from(new Set(links?.map(l => l.mcq_id) || []));
    }
    if (mcqIdsToFilter?.length === 0) {
      toast({ title: "No MCQs", description: "No MCQs available for the selected criteria.", variant: "default" });
      setIsPageLoading(false);
      return;
    }
    let query = supabase.from('mcqs').select(`*, mcq_category_links(category_id, categories(name))`);
    if (mcqIdsToFilter) query = query.in('id', mcqIdsToFilter);
    if (selectedDifficulty && selectedDifficulty !== "all") query = query.eq('difficulty', selectedDifficulty);
    const { data, error } = await query.limit(5000);
    if (error || !data || data.length === 0) {
      toast({ title: "Error", description: "Failed to load test questions.", variant: "destructive" });
      setIsPageLoading(false);
      return;
    }
    const formattedMcqs: MCQ[] = data.map((mcq: any) => ({ ...mcq, category_links: mcq.mcq_category_links.map((l: any) => ({ category_id: l.category_id, category_name: l.categories?.name || null })) }));
    const selectedMcqs = formattedMcqs.sort(() => 0.5 - Math.random()).slice(0, numMcqsToSelect);
    if (selectedMcqs.length === 0) {
      toast({ title: "No MCQs", description: "No MCQs could be selected. Please adjust criteria.", variant: "default" });
      setIsPageLoading(false);
      return;
    }
    setMcqs(selectedMcqs);
    setTimer(testDurationMinutes * 60);
    setCurrentQuestionIndex(0);
    const initialAnswers = new Map<string, UserAnswerData>();
    selectedMcqs.forEach(mcq => initialAnswers.set(mcq.id, { selectedOption: null, isCorrect: null, submitted: false }));
    setUserAnswers(initialAnswers);
    setSkippedMcqIds(new Set());
    setIsTestSubmitted(false);
    setScore(0);
    setExplanations(new Map());
    setIsPaused(false);
    setShowConfiguration(false);
    setShowInstructions(true);
    setIsPageLoading(false);
    if (user) {
      const saved = await saveTestState(null, selectedCategoryIds, selectedMcqs, initialAnswers, 0, testDurationMinutes * 60, testDurationMinutes * 60, new Set(), user.id);
      if (saved) {
        const names = selectedCategoryIds.map(id => allCategories.find(c => c.id === id)?.name || 'Unknown').filter(Boolean) as string[];
        setActiveSavedTests(prev => [{ dbSessionId: saved.id, categoryIds: selectedCategoryIds, categoryNames: names.length > 0 ? names : ['All Categories'], mcqs: selectedMcqs, userAnswers: new Map(Object.entries(saved.sessionData.user_answers_json)), currentQuestionIndex: saved.sessionData.current_question_index, testDurationSeconds: saved.sessionData.test_duration_seconds || 0, remainingTimeSeconds: saved.sessionData.remaining_time_seconds || 0, skippedMcqIds: new Set(saved.sessionData.skipped_mcq_ids || []), userId: user.id }, ...prev]);
      }
    }
  };

  const continueTestSession = useCallback(async (loadedSession: LoadedTestSession) => {
    setIsPageLoading(true);
    setCurrentDbSessionId(loadedSession.dbSessionId);
    setSelectedCategoryIds(loadedSession.categoryIds);
    setNumMcqsToSelect(loadedSession.mcqs.length);
    setTestDurationMinutes(loadedSession.testDurationSeconds / 60);
    const { data, error } = await supabase.from('mcqs').select(`*, mcq_category_links(category_id, categories(name))`).in('id', loadedSession.mcqs.map(m => m.id)).order('created_at', { ascending: true });
    if (error) {
      toast({ title: "Error", description: "Failed to load test questions for saved session.", variant: "destructive" });
      setIsPageLoading(false);
      return;
    }
    const formattedMcqs: MCQ[] = data.map((mcq: any) => ({ ...mcq, category_links: mcq.mcq_category_links.map((l: any) => ({ category_id: l.category_id, category_name: l.categories?.name || null })) }));
    const orderedMcqs = loadedSession.mcqs.map(lm => formattedMcqs.find(fm => fm.id === lm.id)).filter((m): m is MCQ => m !== undefined);
    setMcqs(orderedMcqs);
    setUserAnswers(loadedSession.userAnswers);
    setCurrentQuestionIndex(loadedSession.currentQuestionIndex);
    setTimer(loadedSession.remainingTimeSeconds);
    setSkippedMcqIds(loadedSession.skippedMcqIds);
    setShowConfiguration(false);
    setShowInstructions(false);
    setIsPageLoading(false);
    toast({ title: "Test Resumed", description: "Continuing where you left off.", duration: 3000 });
  }, [toast]);

  const handleSaveProgress = async () => {
    if (!user) { toast({ title: "Cannot Save", description: "You must be logged in.", variant: "destructive" }); return; }
    if (currentDbSessionId && mcqs.length > 0) {
      const saved = await saveTestState(currentDbSessionId, selectedCategoryIds, mcqs, userAnswers, currentQuestionIndex, testDurationMinutes * 60, timer, skippedMcqIds, user.id);
      if (saved) {
        const names = selectedCategoryIds.map(id => allCategories.find(c => c.id === id)?.name || 'Unknown').filter(Boolean) as string[];
        setActiveSavedTests(prev => {
          const index = prev.findIndex(s => s.dbSessionId === saved.id);
          if (index > -1) {
            const updated = [...prev];
            updated[index] = { ...updated[index], userAnswers: new Map(Object.entries(saved.sessionData.user_answers_json)), currentQuestionIndex: saved.sessionData.current_question_index, remainingTimeSeconds: saved.sessionData.remaining_time_seconds || 0, skippedMcqIds: new Set(saved.sessionData.skipped_mcq_ids || []) };
            return updated;
          }
          return [{ dbSessionId: saved.id, categoryIds: selectedCategoryIds, categoryNames: names.length > 0 ? names : ['All Categories'], mcqs, userAnswers: new Map(Object.entries(saved.sessionData.user_answers_json)), currentQuestionIndex: saved.sessionData.current_question_index, testDurationSeconds: saved.sessionData.test_duration_seconds || 0, remainingTimeSeconds: saved.sessionData.remaining_time_seconds || 0, skippedMcqIds: new Set(saved.sessionData.skipped_mcq_ids || []), userId: user.id }, ...prev];
        });
        toast({ title: "Progress Saved!", description: "Your test progress has been saved." });
      }
    } else {
      toast({ title: "Cannot Save", description: "No active test session to save.", variant: "destructive" });
    }
  };

  const beginTest = () => setShowInstructions(false);
  const handleOptionSelect = useCallback((value: string) => { if (currentMcq) { setUserAnswers(prev => new Map(prev).set(currentMcq.id, { selectedOption: value, isCorrect: null, submitted: false })); setSkippedMcqIds(prev => { const newSet = new Set(prev); newSet.delete(currentMcq.id); return newSet; }); } }, [currentMcq]);
  const prepareReviewSkipped = useCallback(() => { const skipped = mcqs.filter(mcq => skippedMcqIds.has(mcq.id)); if (skipped.length > 0) { setReviewSkippedQuestions(skipped); setCurrentReviewIndex(0); setShowReviewSkippedDialog(true); setIsPaused(true); } else { handleSubmitTest(); } }, [mcqs, skippedMcqIds, handleSubmitTest]);
  const handleNext = useCallback(() => { if (currentQuestionIndex < mcqs.length - 1) setCurrentQuestionIndex(prev => prev + 1); else { if (skippedMcqIds.size > 0) prepareReviewSkipped(); else handleSubmitTest(); } }, [currentQuestionIndex, mcqs.length, skippedMcqIds, handleSubmitTest, prepareReviewSkipped]);
  const handlePrevious = useCallback(() => { if (currentQuestionIndex > 0) setCurrentQuestionIndex(prev => prev - 1); }, [currentQuestionIndex]);
  const handleSkip = useCallback(() => { if (currentMcq) { setSkippedMcqIds(prev => new Set(prev).add(currentMcq.id)); setUserAnswers(prev => new Map(prev).set(currentMcq.id, { selectedOption: null, isCorrect: null, submitted: false })); } handleNext(); }, [currentMcq, handleNext]);
  const togglePause = useCallback(() => setIsPaused(prev => !prev), []);
  const handleReviewNext = useCallback(() => { if (currentReviewIndex < reviewSkippedQuestions.length - 1) setCurrentReviewIndex(prev => prev + 1); else { setShowReviewSkippedDialog(false); setIsPaused(false); const nextUnanswered = mcqs.findIndex(mcq => !userAnswers.get(mcq.id)?.selectedOption); if (nextUnanswered !== -1) setCurrentQuestionIndex(nextUnanswered); else handleSubmitTest(); } }, [currentReviewIndex, reviewSkippedQuestions.length, userAnswers, mcqs, handleSubmitTest]);
  const handleReviewPrevious = useCallback(() => { if (currentReviewIndex > 0) setCurrentReviewIndex(prev => prev - 1); }, [currentReviewIndex]);
  const currentReviewMcq = reviewSkippedQuestions[currentReviewIndex];
  const formatTime = (s: number) => `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor((s % 3600) / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  const goToQuestion = useCallback((i: number) => { if (i >= 0 && i < mcqs.length) setCurrentQuestionIndex(i); }, [mcqs.length]);
  const handleBackToConfiguration = () => { if (mcqs.length > 0 && !isTestSubmitted && !window.confirm("End test? Unsaved progress will be lost.")) return; setMcqs([]); setUserAnswers(new Map()); setCurrentQuestionIndex(0); setIsTestSubmitted(false); setTimer(testDurationMinutes * 60); setScore(0); setExplanations(new Map()); setIsPaused(false); setSkippedMcqIds(new Set()); setShowResults(false); setShowConfiguration(true); setShowInstructions(false); setCurrentDbSessionId(null); fetchTestOverview(); };
  const handleGoToDashboard = () => { if (mcqs.length > 0 && !isTestSubmitted && !window.confirm("Leave test? Unsaved progress will be lost.")) return; setMcqs([]); setUserAnswers(new Map()); setCurrentQuestionIndex(0); setIsTestSubmitted(false); setTimer(testDurationMinutes * 60); setScore(0); setExplanations(new Map()); setIsPaused(false); setSkippedMcqIds(new Set()); setShowResults(false); setShowConfiguration(true); setShowInstructions(false); setCurrentDbSessionId(null); navigate('/user/dashboard'); };

  if (!hasCheckedInitialSession || isPageLoading) return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;
  if (!user) return null;
  if (!user.has_active_subscription) return <div className="min-h-screen flex flex-col items-center justify-center p-4"><Card className="w-full max-w-2xl text-center"><CardHeader><CardTitle>Subscription Required</CardTitle><CardDescription>You need an active subscription to take full tests.</CardDescription></CardHeader><CardContent><p>Unlock unlimited tests by subscribing today!</p><Link to="/user/subscriptions"><Button>View Plans</Button></Link></CardContent><MadeWithDyad /></Card></div>;
  if (showConfiguration) return <div className="min-h-screen flex flex-col items-center justify-center p-4"><Card className="w-full max-w-2xl"><CardHeader><CardTitle>Configure Your Test</CardTitle><CardDescription>Select categories, difficulty, number of questions, and duration.</CardDescription></CardHeader><CardContent className="space-y-6">{activeSavedTests.length > 0 && <Card className="mb-6"><CardHeader><CardTitle>Continue Saved Tests</CardTitle></CardHeader><CardContent className="space-y-4">{activeSavedTests.map(s => <div key={s.dbSessionId} className="flex items-center justify-between p-3 border rounded-md"><p>{s.categoryNames.join(', ')} ({s.currentQuestionIndex + 1}/{s.mcqs.length})</p><div className="flex gap-2"><Button onClick={() => continueTestSession(s)} size="sm">Continue</Button><Button onClick={() => clearSpecificTestState(s.dbSessionId)} variant="outline" size="sm">Clear</Button></div></div>)}</CardContent></Card>}<div className="space-y-2"><Label>Categories</Label><div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border rounded-md">{allCategories.map(c => <div key={c.id} className="flex items-center space-x-2"><Checkbox id={`cat-${c.id}`} checked={selectedCategoryIds.includes(c.id)} onCheckedChange={() => handleCategoryToggle(c.id)} /><Label htmlFor={`cat-${c.id}`}>{c.name}</Label></div>)}</div></div><div className="space-y-2"><Label>Difficulty</Label><Select onValueChange={v => setSelectedDifficulty(v === "all" ? null : v)} value={selectedDifficulty || "all"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Any</SelectItem><SelectItem value="Easy">Easy</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="Hard">Hard</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Number of Questions</Label><Input type="number" min="1" value={numMcqsToSelect} onChange={e => setNumMcqsToSelect(Math.max(1, parseInt(e.target.value) || 1))} /></div><div className="space-y-2"><Label>Duration (minutes)</Label><Input type="number" min="1" value={testDurationMinutes} onChange={e => setTestDurationMinutes(Math.max(1, parseInt(e.target.value) || 1))} /></div></CardContent><CardFooter><Button onClick={startTestPreparation}>Start Test</Button></CardFooter></Card><MadeWithDyad /></div>;
  if (showInstructions) return <div className="min-h-screen flex items-center justify-center p-4"><Card className="w-full max-w-2xl"><CardHeader><CardTitle>Test Instructions</CardTitle></CardHeader><CardContent><p>Questions: {mcqs.length}</p><p>Time: {formatTime(testDurationMinutes * 60)}</p></CardContent><CardFooter><Button onClick={beginTest}>Begin</Button></CardFooter></Card><MadeWithDyad /></div>;
  if (mcqs.length === 0) return <div className="min-h-screen flex items-center justify-center p-4"><Card className="w-full max-w-2xl"><CardHeader><CardTitle>No MCQs Found</CardTitle></CardHeader><CardContent><p>No questions match your criteria.</p></CardContent><CardFooter><Button onClick={handleBackToConfiguration}>Back</Button></CardFooter></Card><MadeWithDyad /></div>;
  if (!currentMcq) return <div className="min-h-screen flex items-center justify-center"><p>Loading question...</p></div>;
  if (showResults) return <div className="min-h-screen flex items-center justify-center p-4"><div className="flex w-full max-w-6xl"><QuizNavigator mcqs={mcqs} userAnswers={userAnswers} currentQuestionIndex={currentQuestionIndex} goToQuestion={goToQuestion} showResults={true} score={score} /><Card className="flex-1"><CardHeader><CardTitle>Results</CardTitle><CardDescription>Score: {score}/{mcqs.length}</CardDescription></CardHeader><CardContent className="space-y-6 max-h-[60vh] overflow-y-auto p-2">{mcqs.map((mcq, i) => <div key={mcq.id} className="border-b pb-4"><p>{i + 1}. {mcq.question_text}</p><ul>{['A', 'B', 'C', 'D'].map(k => <li key={k} className={userAnswers.get(mcq.id)?.selectedOption === k && userAnswers.get(mcq.id)?.isCorrect ? 'text-green-600' : userAnswers.get(mcq.id)?.selectedOption === k ? 'text-red-600' : mcq.correct_answer === k ? 'text-green-600' : ''}>{k}. {mcq[`option_${k.toLowerCase()}` as 'option_a']}</li>)}</ul>{explanations.get(mcq.explanation_id || '') && <div className="mt-4 p-3 bg-white rounded-md prose max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{explanations.get(mcq.explanation_id || '')!.explanation_text}</ReactMarkdown></div>}</div>)}</CardContent><CardFooter><Button onClick={() => navigate('/user/dashboard')}>Dashboard</Button></CardFooter></Card></div><MadeWithDyad /></div>;
  const currentSelectedOption = userAnswers.get(currentMcq.id)?.selectedOption || "";
  return <div className="min-h-screen flex items-center justify-center p-4 pt-16"><div className="flex w-full max-w-6xl"><Card className="flex-1"><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Q {currentQuestionIndex + 1}/{mcqs.length}</CardTitle><div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={togglePause}><span className="sr-only">{isPaused ? "Resume" : "Pause"}</span>{isPaused ? <Play /> : <Pause />}</Button><TimerIcon /><span>{formatTime(timer)}</span></div>{!user.is_admin && <Button variant="ghost" size="icon" onClick={toggleBookmark} disabled={isBookmarkLoading || isPaused}>{isBookmarked ? <BookmarkCheck /> : <Bookmark />}</Button>}</CardHeader><CardContent><p>{currentMcq.question_text}</p><RadioGroup onValueChange={handleOptionSelect} value={currentSelectedOption} disabled={isPaused}>{['A', 'B', 'C', 'D'].map(k => <div key={k} className="flex items-center space-x-2"><RadioGroupItem value={k} id={`opt-${k}`} /><Label htmlFor={`opt-${k}`}>{k}. {currentMcq[`option_${k.toLowerCase()}` as 'option_a']}</Label></div>)}</RadioGroup></CardContent><CardFooter className="flex justify-between"><div className="flex gap-2"><Button onClick={handleBackToConfiguration} variant="outline" disabled={isPaused}>Back</Button><Button onClick={handleGoToDashboard} variant="outline" disabled={isPaused}><ArrowLeft /> Dashboard</Button><Button onClick={handleSaveProgress} variant="secondary" disabled={isPaused || !currentDbSessionId || !user}><Save /> Save</Button></div><div className="flex gap-2"><Button onClick={handlePrevious} disabled={currentQuestionIndex === 0 || isPaused} variant="outline">Previous</Button><Button onClick={handleSkip} disabled={isPaused} variant="secondary"><SkipForward /> Skip</Button>{currentQuestionIndex === mcqs.length - 1 ? <Button onClick={skippedMcqIds.size > 0 ? prepareReviewSkipped : handleSubmitTest} disabled={isPaused}>{skippedMcqIds.size > 0 ? `Review (${skippedMcqIds.size})` : "Submit"}</Button> : <Button onClick={handleNext} disabled={isPaused}>Next</Button>}</div></CardFooter></Card></div><MadeWithDyad /><Dialog open={showReviewSkippedDialog} onOpenChange={setShowReviewSkippedDialog}><DialogContent className="sm:max-w-[800px]"><DialogHeader><DialogTitle>Review Skipped</DialogTitle><DialogDescription>You can answer these questions now or skip them again.</DialogDescription></DialogHeader>{currentReviewMcq && <div className="py-4"><p>{currentReviewIndex + 1}/{reviewSkippedQuestions.length}: {currentReviewMcq.question_text}</p><RadioGroup onValueChange={v => { handleOptionSelect(v); setUserAnswers(p => new Map(p).set(currentReviewMcq.id, { selectedOption: v, isCorrect: null, submitted: false })); }} value={userAnswers.get(currentReviewMcq.id)?.selectedOption || ""} className="space-y-2">{['A', 'B', 'C', 'D'].map(k => <div key={k} className="flex items-center space-x-2"><RadioGroupItem value={k} id={`rev-opt-${k}`} /><Label htmlFor={`rev-opt-${k}`}>{k}. {currentReviewMcq[`option_${k.toLowerCase()}` as 'option_a']}</Label></div>)}</RadioGroup></div>}<DialogFooter className="justify-between"><Button variant="outline" onClick={() => { setShowReviewSkippedDialog(false); setIsPaused(false); const next = mcqs.findIndex(m => !userAnswers.get(m.id)?.selectedOption); if (next !== -1) setCurrentQuestionIndex(next); else handleSubmitTest(); }}>Back to Test</Button><div className="flex gap-2"><Button onClick={handleReviewPrevious} disabled={currentReviewIndex === 0} variant="outline">Previous</Button><Button onClick={handleReviewNext}>{currentReviewIndex === reviewSkippedQuestions.length - 1 ? "Finish" : "Next"}</Button></div></DialogFooter></DialogContent></Dialog></div>;
};

export default TakeTestPage;