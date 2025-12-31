"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/components/SessionContextProvider';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { CheckCircle2, AlertCircle, Loader2, Trophy } from 'lucide-react'; // Import Trophy icon
import { Link } from 'react-router-dom';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

interface DailyMcq {
  daily_mcq_id: string;
  mcq: {
    id: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_answer: 'A' | 'B' | 'C' | 'D';
    explanation_id: string | null;
    difficulty: string | null;
    is_trial_mcq: boolean | null;
  };
}

interface SubmissionResult {
  message: string;
  is_correct: boolean;
  points_awarded: number;
  total_points: number | null;
  free_month_awarded: boolean;
  error?: string;
  selected_option?: string; // Added this property
}

interface MCQExplanation {
  id: string;
  explanation_text: string;
  image_url: string | null;
}

interface LeaderboardEntry {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  points_awarded: number;
  created_at: string;
  user_display_name: string; // Combined name for display
}

const guestFormSchema = z.object({
  guest_name: z.string().min(1, "Name is required."),
  guest_email: z.string().email("Invalid email address.").min(1, "Email is required."),
});

const QuestionOfTheDayPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();

  const [dailyMcq, setDailyMcq] = useState<DailyMcq | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [explanation, setExplanation] = useState<MCQExplanation | null>(null);
  const [userTotalPoints, setUserTotalPoints] = useState<number | null>(null); // For logged-in users
  const [dailyLeaderboard, setDailyLeaderboard] = useState<LeaderboardEntry[]>([]);

  const isGuest = !user;

  const guestForm = useForm<z.infer<typeof guestFormSchema>>({
    resolver: zodResolver(guestFormSchema),
    defaultValues: {
      guest_name: "",
      guest_email: "",
    },
  });

  const fetchExplanation = useCallback(async (explanationId: string) => {
    const { data, error } = await supabase
      .from('mcq_explanations')
      .select('*')
      .eq('id', explanationId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Supabase Error fetching explanation:', error);
      toast({
        title: "Error",
        description: `Failed to load explanation: ${error.message || 'Unknown error'}.`,
        variant: "destructive",
      });
      setExplanation(null);
    } else if (data) {
      setExplanation(data);
    }
  }, [toast]);

  const fetchDailyLeaderboard = useCallback(async (currentDailyMcqId: string) => {
    const { data: submissions, error: submissionsError } = await supabase
      .from('daily_mcq_submissions')
      .select(`
        id,
        user_id,
        guest_name,
        guest_email,
        points_awarded,
        created_at
      `)
      .eq('daily_mcq_id', currentDailyMcqId)
      .order('points_awarded', { ascending: false })
      .order('created_at', { ascending: true }) // Tie-break by submission time
      .limit(10);

    if (submissionsError) {
      console.error('Error fetching daily leaderboard submissions:', submissionsError);
      toast({ title: "Error", description: "Failed to load daily leaderboard submissions.", variant: "destructive" });
      setDailyLeaderboard([]);
      return;
    }

    const userIds = submissions.map(s => s.user_id).filter(Boolean) as string[];
    // Updated type definition for publicProfilesMap to include email
    let publicProfilesMap = new Map<string, { first_name: string | null; last_name: string | null; email: string | null }>();

    if (userIds.length > 0) {
      // The Edge Function now returns email as well
      const { data: publicProfiles, error: profilesError = null } = await supabase.functions.invoke('get-public-profiles', {
        body: { user_ids: userIds },
      });

      if (profilesError) {
        console.error('Error fetching public profiles from Edge Function:', profilesError);
        toast({ title: "Error", description: "Failed to load user names for leaderboard.", variant: "destructive" });
      } else if (publicProfiles) {
        // Updated mapping to include email
        publicProfiles.forEach((profile: { id: string; first_name: string | null; last_name: string | null; email: string | null }) => {
          publicProfilesMap.set(profile.id, { first_name: profile.first_name, last_name: profile.last_name, email: profile.email });
        });
      }
    }

    const formattedLeaderboard: LeaderboardEntry[] = submissions.map((entry: any) => {
      let displayName = '';
      if (entry.user_id) {
        const profile = publicProfilesMap.get(entry.user_id);
        const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
        
        if (fullName) {
          displayName = fullName;
        } else if (profile?.email) {
          // Fallback to email if name is missing
          displayName = profile.email;
        } else {
          displayName = `User (${entry.user_id.substring(0, 4)})`;
        }
      } else {
        displayName = entry.guest_name || `Guest (${entry.guest_email?.split('@')[0] || 'N/A'})`;
      }
      return {
        id: entry.id,
        user_id: entry.user_id,
        guest_name: entry.guest_name,
        guest_email: entry.guest_email,
        points_awarded: entry.points_awarded,
        created_at: entry.created_at,
        user_display_name: displayName,
      };
    });
    setDailyLeaderboard(formattedLeaderboard);
  }, [toast]);

  const fetchDailyMcq = useCallback(async () => {
    setIsPageLoading(true);
    let fetchedMcq: DailyMcq | null = null;

    try {
      // 1. Fetch the Daily MCQ (Primary operation)
      const { data, error } = await supabase.functions.invoke('get-daily-mcq');

      if (error) {
        throw error;
      }
      fetchedMcq = data as DailyMcq;
      setDailyMcq(fetchedMcq);
      setSelectedOption(null);
      setSubmissionResult(null);
      setExplanation(null);

    } catch (error: any) {
      console.error('Error fetching daily MCQ (Primary):', error);
      toast({
        title: "Error",
        description: `Failed to load Question of the Day: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      setDailyMcq(null);
      setIsPageLoading(false);
      return;
    }

    // 2. Handle subsequent data fetches (Secondary operations)
    if (fetchedMcq?.daily_mcq_id) {
      // Fetch leaderboard (can run in background)
      fetchDailyLeaderboard(fetchedMcq.daily_mcq_id); 

      // Check submission status and fetch points (wrap in try/catch)
      try {
        // Check if user has already submitted for today
        if (user) {
          const { data: existingSubmission, error: subError } = await supabase
            .from('daily_mcq_submissions')
            .select('selected_option, is_correct, points_awarded')
            .eq('daily_mcq_id', fetchedMcq.daily_mcq_id)
            .eq('user_id', user.id)
            .single();

          if (subError && subError.code !== 'PGRST116') {
            console.error('Error checking existing submission:', subError);
            // Do not throw, just log
          } else if (existingSubmission) {
            setSubmissionResult({
              message: 'You have already submitted an answer for today\'s question.',
              is_correct: existingSubmission.is_correct,
              points_awarded: existingSubmission.points_awarded,
              total_points: null, // Will be fetched separately by fetchDailyMcq
              free_month_awarded: false,
              selected_option: existingSubmission.selected_option,
            });
            setSelectedOption(existingSubmission.selected_option);
            if (fetchedMcq.mcq.explanation_id) {
              fetchExplanation(fetchedMcq.mcq.explanation_id);
            }
          }
        } else { // Guest user check for existing submission
          const guestEmail = localStorage.getItem('qod_guest_email');
          if (guestEmail) {
            const { data: existingGuestSubmission, error: guestSubError } = await supabase
              .from('daily_mcq_submissions')
              .select('selected_option, is_correct, points_awarded')
              .eq('daily_mcq_id', fetchedMcq.daily_mcq_id)
              .eq('guest_email', guestEmail)
              .is('user_id', null)
              .single();

            if (guestSubError && guestSubError.code !== 'PGRST116') {
              console.error('Error checking existing guest submission:', guestSubError);
            } else if (existingGuestSubmission) {
              setSubmissionResult({
                message: 'You have already submitted an answer for today\'s question.',
                is_correct: existingGuestSubmission.is_correct,
                points_awarded: existingGuestSubmission.points_awarded,
                total_points: null,
                free_month_awarded: false,
                selected_option: existingGuestSubmission.selected_option,
              });
              setSelectedOption(existingGuestSubmission.selected_option);
              if (fetchedMcq.mcq.explanation_id) {
                fetchExplanation(fetchedMcq.mcq.explanation_id);
              }
            }
          }
        }
        
        // Fetch user's total points if logged in
        if (user) {
          const { data: scoreData, error: scoreError } = await supabase
            .from('user_daily_mcq_scores')
            .select('total_points')
            .eq('user_id', user.id)
            .single();
          
          if (scoreError && scoreError.code !== 'PGRST116') {
            console.error('Error fetching user total points:', scoreError);
          } else if (scoreData) {
            setUserTotalPoints(scoreData.total_points);
          } else {
            setUserTotalPoints(0); // User has no score yet
          }
        } else {
          setUserTotalPoints(null); // Guests don't have cumulative scores
        }
      } catch (e) {
        console.error("Error during secondary QOD data fetch (submission/points):", e);
        // Log error, but do not interrupt rendering the main question
      }
    }
    
    setIsPageLoading(false);
  }, [user, toast, fetchExplanation, fetchDailyLeaderboard]);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      fetchDailyMcq();
    }
  }, [hasCheckedInitialSession, fetchDailyMcq]);

  const handleSubmit = async (guestValues?: z.infer<typeof guestFormSchema>) => {
    if (!dailyMcq || !selectedOption) {
      toast({ title: "Error", description: "Please select an option before submitting.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        daily_mcq_id: dailyMcq.daily_mcq_id,
        mcq_id: dailyMcq.mcq.id,
        selected_option: selectedOption,
        user_id: user?.id || null,
        guest_name: guestValues?.guest_name || null,
        guest_email: guestValues?.guest_email || null,
      };

      const { data: responseData, error: invokeError } = await supabase.functions.invoke('submit-daily-mcq-answer', {
        body: payload,
      });

      if (invokeError) {
        // Handle 409 Conflict specifically from the invokeError object
        if (invokeError.status === 409 && invokeError.message?.includes("already submitted")) {
          // The Edge Function's 409 response body is in invokeError.details
          const errorDetails = invokeError.details as SubmissionResult;
          setSubmissionResult({
            message: errorDetails.error || 'You have already submitted an answer for today\'s question.',
            is_correct: errorDetails.is_correct,
            points_awarded: errorDetails.points_awarded,
            total_points: null, // Will be fetched separately by fetchDailyMcq
            free_month_awarded: false,
            error: errorDetails.error,
            selected_option: errorDetails.selected_option, // Use selected_option from errorDetails
          });
          setSelectedOption(errorDetails.selected_option || null); // Set selected option from previous submission
          if (dailyMcq.mcq.explanation_id) {
            fetchExplanation(dailyMcq.mcq.explanation_id);
          }
          toast({
            title: "Already Submitted",
            description: errorDetails.error || 'You have already submitted an answer for today\'s question.',
            variant: "default",
          });
          // Re-fetch daily MCQ to ensure all states (like total points) are updated
          fetchDailyMcq();
          return; // Exit early as we've handled the 409
        }
        throw invokeError; // Re-throw other errors
      }

      setSubmissionResult(responseData as SubmissionResult);
      if (responseData.total_points !== null) {
        setUserTotalPoints(responseData.total_points);
      }
      if (dailyMcq.mcq.explanation_id) {
        fetchExplanation(dailyMcq.mcq.explanation_id);
      }

      if (responseData.free_month_awarded) {
        toast({
          title: "Congratulations!",
          description: "You've earned a free month subscription!",
          variant: "default",
          duration: 5000,
        });
      } else {
        toast({
          title: "Submission Received",
          description: responseData.is_correct ? "Correct answer!" : "Incorrect answer.",
          variant: responseData.is_correct ? "default" : "destructive",
        });
      }

      // Store guest info in local storage
      if (isGuest && guestValues) {
        localStorage.setItem('qod_guest_name', guestValues.guest_name);
        localStorage.setItem('qod_guest_email', guestValues.guest_email);
      }
      
      // Refresh leaderboard after submission
      if (dailyMcq.daily_mcq_id) {
        fetchDailyLeaderboard(dailyMcq.daily_mcq_id);
      }

    } catch (error: any) {
      console.error('Error submitting answer:', error);
      const errorMessage = error.message || 'Unknown error';
      toast({
        title: "Submission Failed",
        description: `Failed to submit answer: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestSubmit = guestForm.handleSubmit(handleSubmit);

  // Load guest info from local storage on component mount
  useEffect(() => {
    if (isGuest) {
      const savedGuestName = localStorage.getItem('qod_guest_name');
      const savedGuestEmail = localStorage.getItem('qod_guest_email');
      if (savedGuestName) guestForm.setValue('guest_name', savedGuestName);
      if (savedGuestEmail) guestForm.setValue('guest_email', savedGuestEmail);
    }
  }, [isGuest, guestForm]);

  if (isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 pt-16">
        <p className="text-gray-700 dark:text-gray-300">Loading Question of the Day...</p>
      </div>
    );
  }

  if (!dailyMcq) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
        <Card className="w-full max-w-2xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl">No Question Available</CardTitle>
            <CardDescription>
              We couldn't load today's question. Please try again later.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={fetchDailyMcq}>Retry</Button>
          </CardFooter>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  const isSubmitted = !!submissionResult;
  const isCorrect = submissionResult?.is_correct;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
      <div className="flex flex-col lg:flex-row w-full max-w-6xl gap-6">
        {/* Main Content Area */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-3xl text-center">Question of the Day</CardTitle>
            <CardDescription className="text-center mt-2">
              Test your knowledge daily!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold mb-4">{dailyMcq.mcq.question_text}</p>
            <RadioGroup
              onValueChange={setSelectedOption}
              value={selectedOption || ""}
              className="space-y-2"
              disabled={isSubmitted}
            >
              {['A', 'B', 'C', 'D'].map((optionKey) => {
                const optionText = dailyMcq.mcq[`option_${optionKey.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'];
                const isCorrectOption = dailyMcq.mcq.correct_answer === optionKey;
                const isSelected = selectedOption === optionKey;

                let className = "";
                if (isSubmitted) {
                  if (isSelected && isCorrect) {
                    className = "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
                  } else if (isSelected && !isCorrect) {
                    className = "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
                  } else if (isCorrectOption) {
                    className = "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
                  }
                }

                return (
                  <div
                    key={optionKey}
                    className={`flex items-center space-x-2 p-2 rounded-md cursor-pointer transition-colors duration-200 ${className}`}
                    onClick={() => !isSubmitted && setSelectedOption(optionKey)}
                  >
                    <RadioGroupItem value={optionKey} id={`option-${optionKey}`} />
                    <Label htmlFor={`option-${optionKey}`} className="flex-grow cursor-pointer">
                      {`${optionKey}. ${optionText}`}
                      {isSubmitted && isCorrectOption && <span className="ml-2">(Correct Answer)</span>}
                      {isSubmitted && isSelected && !isCorrect && <span className="ml-2">(Your Answer)</span>}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>

            {isSubmitted && (
              <div className="mt-6 space-y-4">
                <div className={`p-4 rounded-md ${isCorrect ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-950 dark:border-green-700 dark:text-green-200' : 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-950 dark:border-red-700 dark:text-red-200'}`}>
                  <h3 className="font-bold text-xl flex items-center gap-2">
                    {isCorrect ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
                    {isCorrect ? "Correct!" : "Incorrect."}
                  </h3>
                  <p className="mt-2">You {isCorrect ? "earned" : "did not earn"} {submissionResult?.points_awarded} points today.</p>
                </div>

                {userTotalPoints !== null && (
                  <Card className="p-4">
                    <CardTitle className="text-xl">Your Total Points: {userTotalPoints}</CardTitle>
                    <CardDescription className="mt-2">
                      Reach 500 points to earn a free month subscription!
                      {userTotalPoints >= 500 && submissionResult?.free_month_awarded && (
                        <span className="text-green-600 font-semibold ml-2"> (Awarded!)</span>
                      )}
                    </CardDescription>
                  </Card>
                )}

                {explanation && (
                  <div className="p-4 bg-white rounded-md border border-gray-200">
                    <h3 className="text-lg font-semibold mb-2 text-gray-900">Explanation by AI:</h3>
                    <div className="prose max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {explanation.explanation_text}
                      </ReactMarkdown>
                    </div>
                    {explanation.image_url && (
                      <img src={explanation.image_url} alt="Explanation" className="mt-4 max-w-full h-auto rounded-md" />
                    )}
                  </div>
                )}
              </div>
            )}

            {!isSubmitted && (
              <div className="mt-6">
                {isGuest && (
                  <Form {...guestForm}>
                    <form onSubmit={handleGuestSubmit} className="space-y-4 mb-6">
                      <p className="text-sm text-muted-foreground">
                        Enter your details to track your score and participate in the free month subscription challenge!
                      </p>
                      <FormField
                        control={guestForm.control}
                        name="guest_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Your Name</FormLabel>
                            <FormControl>
                              <Input placeholder="John Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={guestForm.control}
                        name="guest_email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Your Email</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="john.doe@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={isSubmitting || !selectedOption}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Submit Answer
                      </Button>
                    </form>
                  </Form>
                )}

                {!isGuest && (
                  <Button onClick={() => handleSubmit()} className="w-full" disabled={isSubmitting || !selectedOption}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Submit Answer
                  </Button>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-center">
            {isGuest && (
              <p className="text-sm text-muted-foreground">
                Already have an account? <Link to="/login" className="text-primary hover:underline">Log In</Link>
              </p>
            )}
          </CardFooter>
        </Card>

        {/* Leaderboard Sidebar */}
        <Card className="w-full lg:w-80 flex-shrink-0">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" /> Today's Top Scorers
            </CardTitle>
            <CardDescription>Highest points for today's question.</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyLeaderboard.length === 0 ? (
              <p className="text-muted-foreground text-sm">No submissions yet for today's question. Be the first!</p>
            ) : (
              <ol className="space-y-2">
                {dailyLeaderboard.map((entry, index) => (
                  <li key={entry.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {index + 1}. {entry.user_display_name}
                    </span>
                    <span className="text-primary font-semibold">{entry.points_awarded} pts</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default QuestionOfTheDayPage;