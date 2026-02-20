"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, ShieldCheck, AlertTriangle, Loader2, Send, Sparkles, UserCheck, Clock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import EditStaticPageDialog, { StaticPage } from '@/components/EditStaticPageDialog';
import { useSession } from '@/components/SessionContextProvider';
import { Badge } from '@/components/ui/badge';
import SocialMediaSettingsCard from '@/components/SocialMediaSettingsCard';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

interface InactiveUser {
  id: string;
  email: string;
  name: string;
  last_sign_in: string;
}

const AdminSettingsPage = () => {
  const { toast } = useToast();
  const [staticPages, setStaticPages] = useState<StaticPage[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isCheckingTrial, setIsCheckingTrial] = useState(true);
  const [isTrialConfigured, setIsTrialConfigured] = useState(false);
  const [isFixingTrial, setIsFixingTrial] = useState(false);
  
  // Inactivity Reminder States
  const [reminderStep, setReminderStep] = useState<'threshold' | 'content' | 'recipients' | 'idle'>('idle');
  const [reminderDays, setReminderDays] = useState<number>(7);
  const [isFetchingInactive, setIsFetchingInactive] = useState(false);
  const [inactiveUsers, setInactiveUsers] = useState<InactiveUser[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [reminderContent, setReminderContent] = useState({ subject: '', body: '' });
  const [isSendingReminders, setIsSendingReminders] = useState(false);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPageForEdit, setSelectedPageForEdit] = useState<StaticPage | null>(null);

  const { hasCheckedInitialSession } = useSession();

  const fetchStaticPages = useCallback(async () => {
    const { data, error } = await supabase
      .from('static_pages')
      .select('*')
      .order('title', { ascending: true });

    if (error) {
      console.error('Error fetching static pages:', error);
      toast({ title: "Error", description: "Failed to load static pages.", variant: "destructive" });
      return [];
    }
    return data || [];
  }, [toast]);

  const checkTrialTier = useCallback(async () => {
    setIsCheckingTrial(true);
    try {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('id')
        .eq('name', '3-Day Trial')
        .maybeSingle();
      
      if (error) throw error;
      setIsTrialConfigured(!!data);
    } catch (e) {
      console.error("Error checking trial tier:", e);
    } finally {
      setIsCheckingTrial(false);
    }
  }, []);

  const handleFixTrial = async () => {
    setIsFixingTrial(true);
    try {
      const { error } = await supabase
        .from('subscription_tiers')
        .insert({
          name: '3-Day Trial',
          price: 0,
          currency: 'USD',
          duration_in_months: 1,
          description: 'Automatic 3-day full access for new signups.',
          features: ['Full Question Bank', 'AI Clinical Cases', 'Timed Exams', 'All Videos']
        });

      if (error) throw error;
      toast({ title: "Success", description: "3-Day Trial tier created." });
      setIsTrialConfigured(true);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFixingTrial(false);
    }
  };

  const handleStartReminderFlow = () => setReminderStep('threshold');

  const handlePrepareReminders = async (days: number) => {
    setReminderDays(days);
    setIsFetchingInactive(true);
    try {
      const [usersRes, contentRes] = await Promise.all([
        supabase.functions.invoke('get-inactive-users', { body: { days } }),
        supabase.functions.invoke('generate-reminder-content', { body: { days } })
      ]);

      if (usersRes.error) throw usersRes.error;
      if (contentRes.error) throw contentRes.error;

      setInactiveUsers(usersRes.data.users);
      setSelectedRecipients(new Set(usersRes.data.users.map((u: any) => u.id)));
      setReminderContent(contentRes.data);
      setReminderStep('content');
    } catch (e: any) {
      toast({ title: "Flow Error", description: e.message, variant: "destructive" });
    } finally {
      setIsFetchingInactive(false);
    }
  };

  const handleSendBulkReminders = async () => {
    setIsSendingReminders(true);
    const targetUsers = inactiveUsers.filter(u => selectedRecipients.has(u.id));
    
    try {
      for (const user of targetUsers) {
        const personalizedBody = reminderContent.body.replace('[Name]', user.name);
        await supabase.functions.invoke('send-email', {
          body: {
            to: user.email,
            subject: reminderContent.subject,
            body: personalizedBody
          }
        });
      }
      toast({ title: "Campaign Sent", description: `Reminders sent to ${targetUsers.length} practitioners.` });
      setReminderStep('idle');
    } catch (e: any) {
      toast({ title: "Send Error", description: e.message, variant: "destructive" });
    } finally {
      setIsSendingReminders(false);
    }
  };

  const toggleRecipient = (id: string) => {
    const next = new Set(selectedRecipients);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRecipients(next);
  };

  useEffect(() => {
    if (hasCheckedInitialSession) {
      const runSetup = async () => {
        setIsPageLoading(true);
        const initialPages = await fetchStaticPages();
        setStaticPages(initialPages);
        await checkTrialTier();
        setIsPageLoading(false);
      };
      runSetup();
    }
  }, [hasCheckedInitialSession, fetchStaticPages, checkTrialTier]);

  const handleDeletePage = async (id: string) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      const { error } = await supabase.from('static_pages').delete().eq('id', id);
      if (error) throw error;
      const updatedPages = await fetchStaticPages();
      setStaticPages(updatedPages);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const columns: ColumnDef<StaticPage>[] = [
    { accessorKey: 'title', header: 'Page Title' },
    { accessorKey: 'slug', header: 'Slug' },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {(row.original.location || []).map((loc, index) => (
            <Badge key={index} variant="secondary">{loc}</Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedPageForEdit(row.original); setIsEditDialogOpen(true); }}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeletePage(row.original.id)} className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (!hasCheckedInitialSession || isPageLoading) return <div className="min-h-screen flex items-center justify-center pt-24"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black uppercase italic tracking-tighter">Admin Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-purple-500" />
                    <CardTitle className="text-lg">Inactivity Reminders</CardTitle>
                </div>
                <CardDescription>Manually trigger 7 or 14 day re-engagement campaigns.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <p className="text-sm text-muted-foreground">Scan for inactive users and send AI-crafted reminders.</p>
                    <Button onClick={handleStartReminderFlow} size="sm" variant="secondary" className="rounded-xl font-bold uppercase text-[10px]">
                        Start Campaign
                    </Button>
                </div>
            </CardContent>
        </Card>

        <Card className={cn("border-l-4", isTrialConfigured ? "border-l-green-500" : "border-l-orange-500")}>
            <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
                {isCheckingTrial ? <Loader2 className="h-5 w-5 animate-spin" /> : isTrialConfigured ? <ShieldCheck className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-orange-500" />}
                <CardTitle className="text-lg">Trial Access Health</CardTitle>
            </div>
            </CardHeader>
            <CardContent>
                {isTrialConfigured ? (
                    <Badge variant="default" className="bg-green-100 text-green-800 border-none">System Ready</Badge>
                ) : (
                    <Button onClick={handleFixTrial} disabled={isFixingTrial} size="sm">Fix Trial Tier</Button>
                )}
            </CardContent>
        </Card>
      </div>

      <SocialMediaSettingsCard />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl">Static Pages</CardTitle>
          <Button onClick={() => { setSelectedPageForEdit(null); setIsEditDialogOpen(true); }} size="sm">Add New Page</Button>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={staticPages} />
        </CardContent>
      </Card>

      {/* Reminder Step 1: Threshold */}
      <Dialog open={reminderStep === 'threshold'} onOpenChange={(o) => !o && setReminderStep('idle')}>
        <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
                <DialogTitle>Select Inactivity Period</DialogTitle>
                <DialogDescription>Choose which group of practitioners to target.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
                <Button variant="outline" className="h-24 flex flex-col gap-2 rounded-2xl" onClick={() => handlePrepareReminders(7)} disabled={isFetchingInactive}>
                    <span className="text-2xl font-black">7</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">Days Idle</span>
                </Button>
                <Button variant="outline" className="h-24 flex flex-col gap-2 rounded-2xl" onClick={() => handlePrepareReminders(14)} disabled={isFetchingInactive}>
                    <span className="text-2xl font-black">14</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">Days Idle</span>
                </Button>
            </div>
            {isFetchingInactive && (
                <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <p className="text-[10px] font-bold uppercase text-muted-foreground animate-pulse">Analyzing User Activity...</p>
                </div>
            )}
        </DialogContent>
      </Dialog>

      {/* Reminder Step 2: Content Review */}
      <Dialog open={reminderStep === 'content'} onOpenChange={(o) => !o && setReminderStep('idle')}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Review AI Reminder</DialogTitle>
                <DialogDescription>Personalize the message for the {reminderDays}-day campaign.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Email Subject</Label>
                    <Input value={reminderContent.subject} onChange={e => setReminderContent({...reminderContent, subject: e.target.value})} className="font-bold" />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Email Body (HTML)</Label>
                    <Textarea value={reminderContent.body} onChange={e => setReminderContent({...reminderContent, body: e.target.value})} rows={12} className="text-xs font-mono" />
                    <p className="text-[9px] text-muted-foreground italic">Use <b>[Name]</b> where you want the student's first name to appear.</p>
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setReminderStep('threshold')}>Back</Button>
                <Button onClick={() => setReminderStep('recipients')}>Review Recipients ({inactiveUsers.length})</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder Step 3: Recipient Review */}
      <Dialog open={reminderStep === 'recipients'} onOpenChange={(o) => !o && setReminderStep('idle')}>
        <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" /> Final Recipient Audit</DialogTitle>
                <DialogDescription>Deselect any users you don't wish to contact.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[300px] pr-4 my-4">
                <div className="space-y-2">
                    {inactiveUsers.map(user => (
                        <div key={user.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                            <div className="flex items-center gap-3">
                                <Checkbox id={`rem-${user.id}`} checked={selectedRecipients.has(user.id)} onCheckedChange={() => toggleRecipient(user.id)} />
                                <div>
                                    <p className="text-xs font-bold leading-none">{user.name}</p>
                                    <p className="text-[10px] text-muted-foreground mt-1">{user.email}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black text-muted-foreground uppercase">Last Seen</p>
                                <p className="text-[10px] font-bold">{new Date(user.last_sign_in).toLocaleDateString()}</p>
                            </div>
                        </div>
                    ))}
                    {inactiveUsers.length === 0 && <p className="text-center py-10 text-muted-foreground italic">No users found for this threshold.</p>}
                </div>
            </ScrollArea>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex items-center gap-2 text-xs font-bold">
                    <Badge variant="secondary">{selectedRecipients.size} Selected</Badge>
                </div>
                <Button variant="ghost" onClick={() => setReminderStep('content')}>Edit Message</Button>
                <Button onClick={handleSendBulkReminders} disabled={isSendingReminders || selectedRecipients.size === 0}>
                    {isSendingReminders ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                    Broadcast Reminders
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditStaticPageDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        page={selectedPageForEdit}
        onSave={async () => {
          const updatedPages = await fetchStaticPages();
          setStaticPages(updatedPages);
        }}
      />
    </div>
  );
};

export default AdminSettingsPage;