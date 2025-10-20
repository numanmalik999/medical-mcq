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
import { McqCategoryLink } from '@/components/mcq-columns'; // Import McqCategoryLink
import { Input } from '@/components/ui/input'; // Import Input for number of MCQs and duration
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'; // Added DialogDescription
import QuizNavigator from '@/components/QuizNavigator'; // Import QuizNavigator
import { useBookmark } from '@/hooks/use-bookmark'; // Import useBookmark hook

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

interface UserAnswerData {
  selectedOption: string | null;
  isCorrect: boolean | null; // Null during test, true/false after submission
  submitted: boolean; // False during test, true after submission
}

// Interface for data stored in the database (used internally for typing fetched data)
interface DbQuizSession {
  id: string;
  user_id: string;
  category_id: string | null;
  mcq_ids_order: string[]; // Array of MCQ IDs
  current_question_index: number;
  user_answers_json: { [mcqId: string]: UserAnswerData }; // JSONB object
  is_trial_session: boolean;
  test_duration_seconds: number | null; // New
  remaining_time_seconds: number | null; // New
  skipped_mcq_ids: string[] | null; // New
  created_at: string;
  updated_at: string;
}

// Client-side representation of a loaded session, including full MCQ objects
interface LoadedTestSession {
  dbSessionId: string; // The ID from the database
  categoryIds: string[]; // Can be multiple for tests
  categoryNames: string[]; // For display
  mcqs: MCQ[]; // Full MCQ objects
  userAnswers: Map<string, UserAnswerData>;
  currentQuestionIndex: number;
  testDurationSeconds: number; // New
  remainingTimeSeconds: number; // New
  skippedMcqIds: Set<string>; // New
  userId: string;
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
  const [userAnswers, setUserAnswers] = useState<Map<string, UserAnswerData>>(new Map()); // Updated type
  const [isTestSubmitted, setIsTestSubmitted] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true); // New combined loading state for initial data
  const [timer, setTimer] = useState(testDurationMinutes * 60); // Initialize timer with selected duration
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [explanations, setExplanations] = useState<Map<string, MCQExplanation>>(new Map()); // Fixed type

  const [isPaused, setIsPaused] = useState(false); // New state for pause functionality
  const [skippedMcqIds, setSkippedMcqIds] = useState<Set<string>>(new Set()); // Track skipped MCQs
  const [showReviewSkippedDialog, setShowReviewSkippedDialog] = useState(false);
  const [reviewSkippedQuestions, setReviewSkippedQuestions] = useState<MCQ[]>([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  const [currentDbSessionId, setCurrentDbSessionId] = useState<string | null>(null); // New: Track the DB session ID
  const [activeSavedTests, setActiveSavedTests] = useState<LoadedTestSession[]>([]); // New: List of saved tests

  const timerIntervalRef = useRef<number | null>(null);

  const currentMcq = mcqs[currentQuestionIndex];
  const { isBookmarked, toggleBookmark, isLoading: isBookmarkLoading } = useBookmark(currentMcq?.id || null);

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

  // Function to save test state to the database
  const saveTestState = useCallback(async (
    dbSessionId: string | null,
    categoryIds: string[],
    mcqs: MCQ[],
    answers: Map<string, UserAnswerData>,
    index: number,
    duration: number, // original test duration in seconds
    remaining: number, // remaining time in seconds
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

    // For simplicity, we'll store the first category ID as category_id in user_quiz_sessions
    // and rely on mcq_ids_order to reconstruct the test.
    const primaryCategoryId = categoryIds.length > 0 ? categoryIds[0] : null;

    const sessionData = {
      user_id: currentUserId,
      category_id: primaryCategoryId, // Store primary category for display/grouping
      mcq_ids_order: mcqIdsOrder,
      current_question_index: index,
      user_answers_json: userAnswersJson,
      is_trial_session: false, // Tests are not trial sessions
      test_duration_seconds: duration,
      remaining_time_seconds: remaining,
      skipped_mcq_ids: skippedMcqIdsArray,
    };

    try {
      if (dbSessionId) {
        // Update existing session
        const { data, error } = await supabase
          .from('user_quiz_sessions')
          .update({ ...sessionData, updated_at: new Date().toISOString() })
          .eq('id', dbSessionId)
          .select('id')
          .single();

        if (error) throw error;
        console.log(`Test session ${dbSessionId} updated in DB.`);
        return { id: data.id, sessionData: { ...sessionData, id: data.id, created_at: '', updated_at: new Date().toISOString() } as DbQuizSession };
      } else {
        // Insert new session
        const { data, error } = await supabase
          .from('user_quiz_sessions')
          .insert(sessionData)
          .select('id, created_at, updated_at')
          .single();

        if (error) throw error;
        setCurrentDbSessionId(data.id); // Store the new session ID
        console.log(`New test session ${data.id} created in DB.`);
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

  // Function to clear a specific test session from the database
  const clearSpecificTestState = useCallback(async (dbSessionId: string) => {
    try {
      const { error } = await supabase
        .from('user_quiz_sessions')
        .delete()
        .eq('id', dbSessionId);

      if (error) throw error;
      console.log(`Test session ${dbSessionId} deleted from DB.`);
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

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setIsTestSubmitted(true);
    setIsPaused(true); // Ensure timer is paused on submission

    let correctCount = 0;
    const attemptsToRecord = [];
    const explanationPromises: Promise<MCQExplanation | null>[] = [];
    const mcqExplanationIds = new Set<string>();

    const finalUserAnswers = new Map(userAnswers); // Create a mutable copy for final processing

    for (const mcq of mcqs) {
      const userAnswerData = finalUserAnswers.get(mcq.id);
      const selectedOption = userAnswerData?.selectedOption || null;
      const isCorrect = selectedOption === mcq.correct_answer;
      
      if (isCorrect) {
        correctCount++;
      }

      // Update the userAnswers map with final correctness and submitted status
      finalUserAnswers.set(mcq.id, {
        selectedOption: selectedOption,
        isCorrect: isCorrect,
        submitted: true,
      });

      // For recording attempts, we need a single category_id.
      // We'll use the first one from category_links if available.
      const firstCategoryLink = mcq.category_links?.[0];
      attemptsToRecord.push({
        user_id: user.id,
        mcq_id: mcq.id,
        category_id: firstCategoryLink?.category_id || null,
        selected_option: selectedOption || 'N/A', // Store 'N/A' if not answered
        is_correct: isCorrect,
      });
      if (mcq.explanation_id && !mcqExplanationIds.has(mcq.explanation_id)) {
        mcqExplanationIds.add(mcq.explanation_id);
        explanationPromises.push(fetchExplanation(mcq.explanation_id));
      }
    }

    setUserAnswers(finalUserAnswers); // Update state with final answers
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

    if (currentDbSessionId) {
      clearSpecificTestState(currentDbSessionId); // Clear saved state after test submission
    }
  }, [user, mcqs, userAnswers, toast, fetchExplanation, currentDbSessionId, clearSpecificTestState]);

  // Initial load: Fetch all categories and saved tests
  useEffect(() => {
    if (hasCheckedInitialSession) {
      if (user && user.has_active_subscription) {
        fetchTestOverview();
      } else if (user && !user.has_active_subscription) {
        setIsPageLoading(false); // User is logged in but not subscribed, stop loading
      } else {
        navigate('/login'); // Redirect if not logged in
      }
    }
  }, [user, hasCheckedInitialSession, navigate, toast]);

  const fetchTestOverview = async () => {
    setIsPageLoading(true); // Set loading for this specific fetch

    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      toast({ title: "Error", description: "Failed to load categories for test configuration.", variant: "destructive" });
      setIsPageLoading(false);
      return;
    } else {
      // Add the virtual "Uncategorized" category
      setAllCategories([...(categoriesData || []), { id: UNCATEGORIZED_ID, name: 'Uncategorized' }]);
    }

    // Fetch saved test sessions
    let loadedSavedTests: LoadedTestSession[] = [];
    if (user) {
      const { data: dbSessions, error: dbSessionsError } = await supabase
        .from('user_quiz_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_trial_session', false) // Only fetch non-trial sessions (tests)
        .order('updated_at', { ascending: false });

      if (dbSessionsError) {
        console.error('Error fetching saved test sessions from DB:', dbSessionsError);
        toast({ title: "Error", description: "Failed to load saved test sessions.", variant: "destructive" });
      } else {
        loadedSavedTests = dbSessions.map((dbSession: DbQuizSession) => {
          // Reconstruct categoryIds from mcq_ids_order if needed, or use the stored category_id
          // For simplicity, we'll use the stored category_id for display, but a full reconstruction
          // would involve fetching mcq_category_links for each MCQ in mcq_ids_order.
          const categoryName = categoriesData?.find(c => c.id === dbSession.category_id)?.name || 'Mixed Categories';
          return {
            dbSessionId: dbSession.id,
            categoryIds: dbSession.category_id ? [dbSession.category_id] : [], // Simplified for display
            categoryNames: [categoryName],
            mcqs: dbSession.mcq_ids_order.map((id: string) => ({
              id,
              question_text: 'Loading...', // Placeholder
              option_a: '', option_b: '', option_c: '', option_d: '',
              correct_answer: 'A', explanation_id: null, difficulty: null, is_trial_mcq: null, category_links: [],
            })),
            userAnswers: new Map(Object.entries(dbSession.user_answers_json)),
            currentQuestionIndex: dbSession.current_question_index,
            testDurationSeconds: dbSession.test_duration_seconds || 0,
            remainingTimeSeconds: dbSession.remaining_time_seconds || 0,
            skippedMcqIds: new Set(dbSession.skipped_mcq_ids || []),
            userId: user.id,
          } as LoadedTestSession;
        });
      }
    }
    setActiveSavedTests(loadedSavedTests);
    setIsPageLoading(false); // Clear loading for this specific fetch
  };

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

  // Auto-save effect
  useEffect(() => {
    if (user && currentDbSessionId && !showConfiguration && !showInstructions && !showResults && !isTestSubmitted && mcqs.length > 0) {
      const timeoutId = setTimeout(() => {
        console.log("Auto-saving test progress...");
        saveTestState(
          currentDbSessionId,
          selectedCategoryIds, // Use current selected categories for saving
          mcqs,
          userAnswers,
          currentQuestionIndex,
          testDurationMinutes * 60, // Original duration
          timer, // Remaining time
          skippedMcqIds,
          user.id
        );
      }, 5000); // Save every 5 seconds of activity

      return () => clearTimeout(timeoutId);
    }
  }, [
    user,
    currentDbSessionId,
    showConfiguration,
    showInstructions,
    showResults,
    isTestSubmitted,
    mcqs,
    userAnswers,
    currentQuestionIndex,
    testDurationMinutes,
    timer,
    skippedMcqIds,
    saveTestState,
    selectedCategoryIds
  ]);


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

    let mcqIdsToFilter: string[] | null = null; // This will hold the final list of MCQ IDs after category filtering

    const isUncategorizedSelected = selectedCategoryIds.includes(UNCATEGORIZED_ID);
    const regularCategoryIds = selectedCategoryIds.filter(id => id !== UNCATEGORIZED_ID);

    if (isUncategorizedSelected && regularCategoryIds.length === 0) {
      // Logic for Uncategorized MCQs
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

      const { data: allMcqIds, error: allMcqIdsError } = await supabase
        .from('mcqs')
        .select('id');

      if (allMcqIdsError) {
        console.error('Error fetching all MCQ IDs for uncategorized filter:', allMcqIdsError);
        toast({ title: "Error", description: "Failed to fetch all MCQs for uncategorized filter.", variant: "destructive" });
        setIsPageLoading(false);
        return;
      }
      const allMcqIdsSet = new Set(allMcqIds?.map(mcq => mcq.id) || []);
      mcqIdsToFilter = Array.from(allMcqIdsSet).filter(id => !categorizedMcqIds.includes(id));

    } else if (regularCategoryIds.length > 0) {
      // Refactored: First get MCQ IDs from mcq_category_links
      const { data: filteredLinks, error: linksError } = await supabase
        .from('mcq_category_links')
        .select('mcq_id')
        .in('category_id', regularCategoryIds);

      if (linksError) {
        console.error('Error fetching filtered MCQ links:', linksError);
        toast({ title: "Error", description: "Failed to filter MCQs by category.", variant: "destructive" });
        setIsPageLoading(false);
        return;
      }
      mcqIdsToFilter = Array.from(new Set(filteredLinks?.map(link => link.mcq_id) || []));

    } else {
      // No categories selected, fetch all MCQ IDs
      const { data: allMcqIds, error: allMcqIdsError } = await supabase
        .from('mcqs')
        .select('id');
      if (allMcqIdsError) {
        console.error('Error fetching all MCQ IDs:', allMcqIdsError);
        toast({ title: "Error", description: "Failed to fetch all MCQs.", variant: "destructive" });
        setIsPageLoading(false);
        return;
      }
      mcqIdsToFilter = allMcqIds?.map(mcq => mcq.id) || [];
    }

    // If no MCQs found after category filtering, return early
    if (mcqIdsToFilter !== null && mcqIdsToFilter.length === 0) {
      toast({ title: "No MCQs", description: "No MCQs available for the selected criteria.", variant: "default" });
      setIsPageLoading(false);
      return;
    }

    // Now, fetch the actual MCQ data using the filtered IDs and apply other filters
    let mcqsQuery = supabase
      .from('mcqs')
      .select(`
        *,
        mcq_category_links (
          category_id,
          categories (name)
        )
      `);

    if (mcqIdsToFilter !== null) {
      mcqsQuery = mcqsQuery.in('id', mcqIdsToFilter);
    }

    if (selectedDifficulty && selectedDifficulty !== "all") {
      mcqsQuery = mcqsQuery.eq('difficulty', selectedDifficulty);
    }

    const { data: mcqsData, error: mcqsError } = await mcqsQuery;

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
    
    // Initialize userAnswers for all questions with default values for a test
    const initialUserAnswers = new Map<string, UserAnswerData>();
    selectedMcqs.forEach(mcq => {
      initialUserAnswers.set(mcq.id, { selectedOption: null, isCorrect: null, submitted: false });
    });
    setUserAnswers(initialUserAnswers);

    setSkippedMcqIds(new Set()); // Reset skipped MCQs
    setIsTestSubmitted(false);
    setScore(0);
    setExplanations(new Map());
    setIsPaused(false); // Ensure not paused when starting new test

    setShowConfiguration(false);
    setShowInstructions(true);
    setIsPageLoading(false);

    // Create a new session in the database
    if (user) {
      const savedSessionResult = await saveTestState(
        null, // No existing session ID
        selectedCategoryIds,
        selectedMcqs,
        initialUserAnswers,
        0, // currentQuestionIndex
        testDurationMinutes * 60, // original duration
        testDurationMinutes * 60, // remaining time
        new Set(), // skipped MCQs
        user.id
      );
      if (savedSessionResult) {
        const categoryNames = selectedCategoryIds.map(id => allCategories.find(c => c.id === id)?.name || 'Unknown').filter(Boolean) as string[];
        setActiveSavedTests(prev => [
          {
            dbSessionId: savedSessionResult.id,
            categoryIds: selectedCategoryIds,
            categoryNames: categoryNames.length > 0 ? categoryNames : ['All Categories'],
            mcqs: selectedMcqs,
            userAnswers: new Map(Object.entries(savedSessionResult.sessionData.user_answers_json)),
            currentQuestionIndex: savedSessionResult.sessionData.current_question_index,
            testDurationSeconds: savedSessionResult.sessionData.test_duration_seconds || 0,
            remainingTimeSeconds: savedSessionResult.sessionData.remaining_time_seconds || 0,
            skippedMcqIds: new Set(savedSessionResult.sessionData.skipped_mcq_ids || []),
            userId: user.id,
          },
          ...prev,
        ]);
      }
    }
  };

  const continueTestSession = useCallback(async (loadedSession: LoadedTestSession) => {
    setIsPageLoading(true);
    setCurrentDbSessionId(loadedSession.dbSessionId);
    setSelectedCategoryIds(loadedSession.categoryIds); // Restore selected categories for auto-save
    setNumMcqsToSelect(loadedSession.mcqs.length); // Restore number of MCQs
    setTestDurationMinutes(loadedSession.testDurationSeconds / 60); // Restore original duration

    // Fetch full MCQ objects based on mcq_ids_order from the loaded session
    const { data: mcqsData, error: mcqsError } = await supabase
      .from('mcqs')
      .select(`
        *,
        mcq_category_links (
          category_id,
          categories (name)
        )
      `)
      .in('id', loadedSession.mcqs.map(m => m.id)) // Use the IDs from the placeholder MCQs
      .order('created_at', { ascending: true }); // Maintain original order if possible

    if (mcqsError) {
      console.error('Error fetching MCQs for resumed session:', mcqsError);
      toast({ title: "Error", description: "Failed to load test questions for your saved session.", variant: "destructive" });
      setIsPageLoading(false);
      return;
    }

    const formattedMcqs: MCQ[] = mcqsData.map((mcq: any) => ({
      ...mcq,
      category_links: mcq.mcq_category_links.map((link: any) => ({
        category_id: link.category_id,
        category_name: link.categories?.name || null,
      })),
    }));

    // Reorder fetched MCQs to match mcq_ids_order
    const orderedMcqs = loadedSession.mcqs.map(loadedMcq => 
      formattedMcqs.find(fetchedMcq => fetchedMcq.id === loadedMcq.id)
    ).filter((mcq): mcq is MCQ => mcq !== undefined);

    setMcqs(orderedMcqs);
    setUserAnswers(loadedSession.userAnswers);
    setCurrentQuestionIndex(loadedSession.currentQuestionIndex);
    setTimer(loadedSession.remainingTimeSeconds);
    setSkippedMcqIds(loadedSession.skippedMcqIds);

    setShowConfiguration(false);
    setShowInstructions(false); // Directly jump into test
    setIsPageLoading(false);
    toast({
      title: "Test Resumed",
      description: "Continuing from where you left off.",
      duration: 3000,
    });
  }, [toast]);

  const handleSaveProgress = async () => {
    if (!user) {
      toast({
        title: "Cannot Save",
        description: "You must be logged in to save test progress.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    if (currentDbSessionId && mcqs.length > 0) {
      const savedSessionResult = await saveTestState(
        currentDbSessionId,
        selectedCategoryIds,
        mcqs,
        userAnswers,
        currentQuestionIndex,
        testDurationMinutes * 60,
        timer,
        skippedMcqIds,
        user.id
      );

      if (savedSessionResult) {
        const categoryNames = selectedCategoryIds.map(id => allCategories.find(c => c.id === id)?.name || 'Unknown').filter(Boolean) as string[];
        setActiveSavedTests(prev => {
          const existingIndex = prev.findIndex(session => session.dbSessionId === savedSessionResult.id);
          if (existingIndex > -1) {
            // Update existing session in the list
            const updatedPrev = [...prev];
            updatedPrev[existingIndex] = {
              dbSessionId: savedSessionResult.id,
              categoryIds: selectedCategoryIds,
              categoryNames: categoryNames.length > 0 ? categoryNames : ['All Categories'],
              mcqs: mcqs,
              userAnswers: new Map(Object.entries(savedSessionResult.sessionData.user_answers_json)),
              currentQuestionIndex: savedSessionResult.sessionData.current_question_index,
              testDurationSeconds: savedSessionResult.sessionData.test_duration_seconds || 0,
              remainingTimeSeconds: savedSessionResult.sessionData.remaining_time_seconds || 0,
              skippedMcqIds: new Set(savedSessionResult.sessionData.skipped_mcq_ids || []),
              userId: user.id,
            };
            return updatedPrev;
          } else {
            // Add new session to the list (should ideally not happen if currentDbSessionId is set)
            return [
              {
                dbSessionId: savedSessionResult.id,
                categoryIds: selectedCategoryIds,
                categoryNames: categoryNames.length > 0 ? categoryNames : ['All Categories'],
                mcqs: mcqs,
                userAnswers: new Map(Object.entries(savedSessionResult.sessionData.user_answers_json)),
                currentQuestionIndex: savedSessionResult.sessionData.current_question_index,
                testDurationSeconds: savedSessionResult.sessionData.test_duration_seconds || 0,
                remainingTimeSeconds: savedSessionResult.sessionData.remaining_time_seconds || 0,
                skippedMcqIds: new Set(savedSessionResult.sessionData.skipped_mcq_ids || []),
                userId: user.id,
              },
              ...prev,
            ];
          }
        });

        toast({
          title: "Progress Saved!",
          description: "Your test progress has been saved.",
          duration: 3000,
        });
      }
    } else {
      toast({
        title: "Cannot Save",
        description: "No active test session to save.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const beginTest = () => {
    setShowInstructions(false);
  };

  const handleOptionSelect = useCallback((value: string) => {
    if (currentMcq) {
      setUserAnswers((prev) => {
        const newMap = new Map(prev);
        newMap.set(currentMcq.id, { selectedOption: value, isCorrect: null, submitted: false });
        return newMap;
      });
      // If an option is selected, it's no longer skipped
      setSkippedMcqIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(currentMcq.id);
        return newSet;
      });
    }
  }, [currentMcq]);

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
  }, [currentQuestionIndex, mcqs.length, skippedMcqIds, handleSubmitTest, prepareReviewSkipped]);

  const handlePrevious = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  }, [currentQuestionIndex]);

  const handleSkip = useCallback(() => {
    if (currentMcq) {
      setSkippedMcqIds((prev) => new Set(prev).add(currentMcq.id));
      setUserAnswers((prev) => {
        const newMap = new Map(prev);
        newMap.set(currentMcq.id, { selectedOption: null, isCorrect: null, submitted: false }); // Mark as unanswered
        return newMap;
      });
    }
    handleNext();
  }, [currentMcq, handleNext]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const handleReviewNext = useCallback(() => {
    if (currentReviewIndex < reviewSkippedQuestions.length - 1) {
      setCurrentReviewIndex((prev) => prev + 1);
    } else {
      setShowReviewSkippedDialog(false);
      setIsPaused(false); // Resume main timer
      // After review, find the next unanswered question in the original sequence
      const nextUnansweredIndex = mcqs.findIndex(mcq => {
        const answerData = userAnswers.get(mcq.id);
        return !answerData || answerData.selectedOption === null;
      });
      if (nextUnansweredIndex !== -1) {
        setCurrentQuestionIndex(nextUnansweredIndex);
      } else {
        handleSubmitTest();
      }
    }
  }, [currentReviewIndex, reviewSkippedQuestions.length, userAnswers, mcqs, handleSubmitTest]);

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

  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < mcqs.length) {
      setCurrentQuestionIndex(index);
    }
  }, [mcqs.length]);

  const handleBackToConfiguration = () => {
    const isCurrentTestSaved = currentDbSessionId && activeSavedTests.some(session => session.dbSessionId === currentDbSessionId);

    if (!isCurrentTestSaved && mcqs.length > 0 && !isTestSubmitted) {
      if (!window.confirm("Are you sure you want to end this test session and go back to configuration? Your current unsaved progress will be lost.")) {
        return; // User cancelled
      }
    }

    // Reset all test-related states
    setMcqs([]);
    setUserAnswers(new Map());
    setCurrentQuestionIndex(0);
    setIsTestSubmitted(false);
    setTimer(testDurationMinutes * 60); // Reset timer to default config value
    setScore(0);
    setExplanations(new Map());
    setIsPaused(false);
    setSkippedMcqIds(new Set());
    setShowResults(false);
    setShowConfiguration(true);
    setShowInstructions(false);
    setCurrentDbSessionId(null);
    fetchTestOverview(); // Refresh saved tests list
  };

  const handleGoToDashboard = () => {
    const isCurrentTestSaved = currentDbSessionId && activeSavedTests.some(session => session.dbSessionId === currentDbSessionId);

    if (!isCurrentTestSaved && mcqs.length > 0 && !isTestSubmitted) {
      if (!window.confirm("Are you sure you want to leave this test session? Your current unsaved progress will be lost.")) {
        return; // User cancelled
      }
    }

    // If we reach here, either it was saved, or the user confirmed to lose unsaved progress
    setMcqs([]);
    setUserAnswers(new Map());
    setCurrentQuestionIndex(0);
    setIsTestSubmitted(false);
    setTimer(testDurationMinutes * 60);
    setScore(0);
    setExplanations(new Map());
    setIsPaused(false);
    setSkippedMcqIds(new Set());
    setShowResults(false);
    setShowConfiguration(true);
    setShowInstructions(false);
    setCurrentDbSessionId(null);
    navigate('/user/dashboard');
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
            {activeSavedTests.length > 0 && (
              <Card className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950">
                <CardHeader>
                  <CardTitle className="text-blue-700 dark:text-blue-300">Continue Your Saved Tests</CardTitle>
                  <CardDescription className="text-blue-600 dark:text-blue-400">
                    Pick up where you left off in any of your saved test sessions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeSavedTests.map((savedState) => {
                    const progress = savedState.currentQuestionIndex + 1;
                    const total = savedState.mcqs.length;
                    const remainingTime = formatTime(savedState.remainingTimeSeconds);

                    return (
                      <div key={savedState.dbSessionId} className="flex flex-col sm:flex-row items-center justify-between p-3 border rounded-md bg-white dark:bg-gray-800">
                        <div>
                          <p className="font-semibold">{savedState.categoryNames.join(', ')}</p>
                          <p className="text-sm text-muted-foreground">
                            Question {progress} of {total} | Time Left: {remainingTime}
                          </p>
                        </div>
                        <div className="flex gap-2 mt-2 sm:mt-0">
                          <Button onClick={() => continueTestSession(savedState)} size="sm">Continue</Button>
                          <Button onClick={() => clearSpecificTestState(savedState.dbSessionId)} variant="outline" size="sm">Clear</Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

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
              <li>Select one option for each question. You can change your answer at any time before submission.</li>
              <li>You can navigate between questions using the "Previous" and "Next" buttons, or by clicking on the question numbers in the sidebar.</li>
              <li>Use the "Skip" button to mark a question for later review.</li>
              <li>The test will automatically submit when the time runs out.</li>
              <li>You can submit the test manually at any time by clicking "Submit Test" on the last question, or "Review Skipped" if you have skipped questions.</li>
              <li>You can "Pause" the test at any time.</li>
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
            <Button onClick={handleBackToConfiguration}>Go Back to Configuration</Button>
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
        <div className="flex flex-col md:flex-row w-full max-w-6xl">
          <QuizNavigator
            mcqs={mcqs}
            userAnswers={userAnswers}
            currentQuestionIndex={currentQuestionIndex}
            goToQuestion={goToQuestion}
            showResults={true}
            score={score}
          />
          <Card className="flex-1">
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
                  const userAnswer = userAnswers.get(mcq.id)?.selectedOption;
                  const isCorrect = userAnswers.get(mcq.id)?.isCorrect;
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
            <CardFooter className="flex justify-center gap-4">
              <Button onClick={() => navigate('/user/dashboard')}>Go to Dashboard</Button>
            </CardFooter>
          </Card>
        </div>
        <MadeWithDyad />
      </div>
    );
  }

  const currentSelectedOption = userAnswers.get(currentMcq.id)?.selectedOption || "";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
      <div className="flex flex-col md:flex-row w-full max-w-6xl">
        <Card className="flex-1">
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
            {!user.is_admin && ( // Only show bookmark for non-admin users
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleBookmark}
                disabled={isBookmarkLoading || isPaused}
                className="text-primary hover:text-primary-foreground/90"
              >
                {isBookmarked ? <BookmarkCheck className="h-6 w-6 fill-current" /> : <Bookmark className="h-6 w-6" />}
                <span className="sr-only">{isBookmarked ? "Remove bookmark" : "Add bookmark"}</span>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold mb-4">{currentMcq?.question_text}</p>
            <RadioGroup
              onValueChange={handleOptionSelect}
              value={currentSelectedOption}
              className="space-y-2"
              disabled={isPaused}
            >
              {['A', 'B', 'C', 'D'].map((optionKey) => {
                const optionText = currentMcq[`option_${optionKey.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'];
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
            <div className="flex gap-2">
              <Button onClick={handleBackToConfiguration} variant="outline" disabled={isPaused}>
                Back to Configuration
              </Button>
              <Button onClick={handleGoToDashboard} variant="outline" disabled={isPaused}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Go to Dashboard
              </Button>
              <Button onClick={handleSaveProgress} variant="secondary" disabled={isPaused || !currentDbSessionId || !user}>
                <Save className="h-4 w-4 mr-2" /> Save Progress
              </Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePrevious} disabled={currentQuestionIndex === 0 || isPaused} variant="outline">
                Previous
              </Button>
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
      </div>
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
                  setUserAnswers((prev) => new Map(prev).set(currentReviewMcq.id, { selectedOption: value, isCorrect: null, submitted: false }));
                }}
                value={userAnswers.get(currentReviewMcq.id)?.selectedOption || ""}
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
              const nextUnansweredIndex = mcqs.findIndex(mcq => {
                const answerData = userAnswers.get(mcq.id);
                return !answerData || answerData.selectedOption === null;
              });
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