// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import { Resend } from 'https://esm.sh/resend@1.1.0';

declare global {
  namespace Deno {
    namespace env {
      function get(key: string): string | undefined;
    }
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const POINTS_PER_CORRECT_ANSWER = 10;
const POINTS_FOR_FREE_MONTH = 500;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { daily_mcq_id, mcq_id, selected_option, user_id, guest_name, guest_email } = await req.json();

    if (!daily_mcq_id || !mcq_id || !selected_option) {
      return new Response(JSON.stringify({ error: 'Missing required fields: daily_mcq_id, mcq_id, or selected_option.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!user_id && (!guest_name || !guest_email)) {
      return new Response(JSON.stringify({ error: 'Missing guest_name or guest_email for unauthenticated submission.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Get the correct answer for the MCQ
    const { data: mcqData, error: mcqError } = await supabaseAdmin
      .from('mcqs')
      .select('correct_answer, question_text') // Also fetch question_text for email
      .eq('id', mcq_id)
      .single();

    if (mcqError || !mcqData) {
      console.error('Error fetching MCQ for submission:', mcqError);
      throw new Error('MCQ not found for validation.');
    }

    const isCorrect = selected_option === mcqData.correct_answer;
    const pointsAwarded = isCorrect ? POINTS_PER_CORRECT_ANSWER : 0;

    // 2. Record the submission
    const submissionData = {
      daily_mcq_id,
      user_id: user_id || null,
      guest_name: guest_name || null,
      guest_email: guest_email || null,
      selected_option,
      is_correct: isCorrect,
      points_awarded: pointsAwarded,
    };

    const { data: existingSubmission, error: checkSubmissionError } = await supabaseAdmin
      .from('daily_mcq_submissions')
      .select('id, is_correct, points_awarded')
      .eq('daily_mcq_id', daily_mcq_id)
      .or(user_id ? `user_id.eq.${user_id}` : `guest_email.eq.${guest_email}`);

    if (checkSubmissionError) {
      console.error('Error checking for existing submission:', checkSubmissionError);
      throw new Error('Failed to check for existing submission.');
    }

    if (existingSubmission && existingSubmission.length > 0) {
      return new Response(JSON.stringify({
        error: 'You have already submitted an answer for today\'s question.',
        is_correct: existingSubmission[0].is_correct,
        points_awarded: existingSubmission[0].points_awarded, // Return points from previous submission
        total_points: null, // Will be fetched later if user_id exists
        free_month_awarded: false,
      }), {
        status: 409, // Conflict
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: insertSubmissionError } = await supabaseAdmin
      .from('daily_mcq_submissions')
      .insert(submissionData);

    if (insertSubmissionError) {
      console.error('Error inserting daily MCQ submission:', insertSubmissionError);
      throw new Error(`Failed to record submission: ${insertSubmissionError.message}`);
    }

    let totalPoints = null;
    let freeMonthAwarded = false;

    // 3. Update user's cumulative score if logged in
    if (user_id) {
      const { data: userScore, error: fetchScoreError } = await supabaseAdmin
        .from('user_daily_mcq_scores')
        .select('total_points, last_awarded_subscription_at')
        .eq('user_id', user_id)
        .single();

      if (fetchScoreError && fetchScoreError.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Error fetching user score:', fetchScoreError);
        throw new Error('Failed to fetch user score.');
      }

      let newTotalPoints = (userScore?.total_points || 0) + pointsAwarded;
      totalPoints = newTotalPoints;

      const { error: upsertScoreError } = await supabaseAdmin
        .from('user_daily_mcq_scores')
        .upsert({
          user_id: user_id,
          total_points: newTotalPoints,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (upsertScoreError) {
        console.error('Error upserting user score:', upsertScoreError);
        throw new Error(`Failed to update user score: ${upsertScoreError.message}`);
      }

      // 4. Check for free month award
      if (newTotalPoints >= POINTS_FOR_FREE_MONTH) {
        // Check if a free month has already been awarded since the last score update or if it's a new award threshold
        const lastAwarded = userScore?.last_awarded_subscription_at ? new Date(userScore.last_awarded_subscription_at) : null;
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        // Award if points reached threshold and no award in the last month (or never awarded)
        if (!lastAwarded || lastAwarded < oneMonthAgo) { // Simple check to prevent frequent awards
          const { error: awardError } = await supabaseAdmin.functions.invoke('award-free-subscription', {
            body: { user_id },
          });

          if (awardError) {
            console.error('Error awarding free subscription:', awardError);
            // Don't throw, just log and continue
          } else {
            freeMonthAwarded = true;
            // Update last_awarded_subscription_at immediately
            await supabaseAdmin
              .from('user_daily_mcq_scores')
              .update({ last_awarded_subscription_at: new Date().toISOString() })
              .eq('user_id', user_id);
          }
        }
      }
    }

    // 5. Send email notification
    const recipientEmail = user_id ? (await supabaseAdmin.from('profiles').select('email').eq('id', user_id).single()).data?.email : guest_email;
    const recipientName = user_id ? (await supabaseAdmin.from('profiles').select('first_name').eq('id', user_id).single()).data?.first_name || 'User' : guest_name || 'Guest';

    if (recipientEmail) {
      const emailSubject = isCorrect ? '🎉 Correct Answer! Question of the Day' : '💡 Your Answer for Question of the Day';
      const emailBody = `
        <p>Dear ${recipientName},</p>
        <p>Thank you for participating in today's Question of the Day!</p>
        <p><strong>Question:</strong> ${mcqData.question_text}</p>
        <p>Your answer was: <strong>${isCorrect ? 'Correct!' : 'Incorrect.'}</strong></p>
        <p>You earned <strong>${pointsAwarded} points</strong> today.</p>
        ${user_id && totalPoints !== null ? `<p>Your total cumulative points are now: <strong>${totalPoints}</strong>.</p>` : ''}
        ${freeMonthAwarded ? '<p><strong>Congratulations! You\'ve reached 500 points and earned a free month subscription!</strong></p>' : ''}
        <p>Keep learning and come back tomorrow for a new challenge!</p>
        <p>Best regards,<br/>Study Prometric MCQs Team</p>
      `;

      const { error: emailError } = await supabaseAdmin.functions.invoke('send-email', {
        body: {
          to: recipientEmail,
          subject: emailSubject,
          body: emailBody,
        },
      });

      if (emailError) {
        console.error('Error sending QOD submission email:', emailError);
        // Don't throw, just log the warning
      }
    }

    return new Response(JSON.stringify({
      message: 'Submission recorded successfully.',
      is_correct: isCorrect,
      points_awarded: pointsAwarded,
      total_points: totalPoints,
      free_month_awarded: freeMonthAwarded,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in submit-daily-mcq-answer Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});