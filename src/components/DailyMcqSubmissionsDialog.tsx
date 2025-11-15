"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trophy } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface DailyMcqEntry {
  id: string;
  date: string;
  mcq_question_text: string;
}

interface Submission {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  selected_option: string;
  is_correct: boolean;
  points_awarded: number;
  created_at: string;
  user_display_name?: string; // To be populated
}

interface DailyMcqSubmissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dailyMcqEntry: DailyMcqEntry | null;
}

const DailyMcqSubmissionsDialog = ({ open, onOpenChange, dailyMcqEntry }: DailyMcqSubmissionsDialogProps) => {
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && dailyMcqEntry) {
      fetchSubmissions();
    }
  }, [open, dailyMcqEntry]);

  const fetchSubmissions = async () => {
    if (!dailyMcqEntry) return;
    setIsLoading(true);
    try {
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('daily_mcq_submissions')
        .select('*')
        .eq('daily_mcq_id', dailyMcqEntry.id)
        .order('is_correct', { ascending: false })
        .order('created_at', { ascending: true });

      if (submissionsError) throw submissionsError;

      const userIds = submissionsData.map(s => s.user_id).filter(Boolean) as string[];
      let publicProfilesMap = new Map<string, { first_name: string | null; last_name: string | null }>();

      if (userIds.length > 0) {
        const { data: publicProfiles, error: profilesError } = await supabase.functions.invoke('get-public-profiles', {
          body: { user_ids: userIds },
        });

        if (profilesError) {
          console.error('Error fetching public profiles:', profilesError);
        } else if (publicProfiles) {
          publicProfiles.forEach((profile: { id: string; first_name: string | null; last_name: string | null }) => {
            publicProfilesMap.set(profile.id, { first_name: profile.first_name, last_name: profile.last_name });
          });
        }
      }

      const formattedSubmissions: Submission[] = submissionsData.map((entry: any) => {
        let displayName = '';
        if (entry.user_id) {
          const profile = publicProfilesMap.get(entry.user_id);
          displayName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
          if (!displayName) displayName = `User (${entry.user_id.substring(0, 4)})`;
        } else {
          displayName = entry.guest_name || `Guest (${entry.guest_email?.split('@')[0] || 'N/A'})`;
        }
        return { ...entry, user_display_name: displayName };
      });

      setSubmissions(formattedSubmissions);
    } catch (error: any) {
      console.error("Error fetching submissions:", error);
      toast({
        title: "Error",
        description: `Failed to fetch submissions: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Submissions for Question of the Day</DialogTitle>
          <DialogDescription>
            Date: {dailyMcqEntry ? format(new Date(dailyMcqEntry.date.replace(/-/g, '\/')), 'PPP') : 'N/A'}
            <br />
            Question: {dailyMcqEntry?.mcq_question_text}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : submissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">No submissions found for this day.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Rank</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Answer</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((sub, index) => (
                  <TableRow key={sub.id} className={index === 0 && sub.is_correct ? 'bg-yellow-50 dark:bg-yellow-950' : ''}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {index + 1}
                        {index === 0 && sub.is_correct && <Trophy className="h-4 w-4 text-yellow-500" />}
                      </div>
                    </TableCell>
                    <TableCell>{sub.user_display_name}</TableCell>
                    <TableCell>
                      <Badge variant={sub.is_correct ? 'default' : 'destructive'}>
                        {sub.selected_option}
                      </Badge>
                    </TableCell>
                    <TableCell>{sub.points_awarded}</TableCell>
                    <TableCell>{format(new Date(sub.created_at), 'p')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DailyMcqSubmissionsDialog;