"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Loader2, Calendar as CalendarIcon, CheckCircle2, Circle, Sparkles, Trash2, ArrowRight } from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

interface StudyPlan {
  id: string;
  exam_date: string;
  exam_name: string;
}

interface PlanItem {
  id: string;
  planned_date: string;
  task_title: string;
  is_completed: boolean;
  category_id: string | null;
}

const StudyPlannerPage = () => {
  const { user } = useSession();
  const { toast } = useToast();
  
  const [activePlan, setActivePlan] = useState<StudyPlan | null>(null);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const [examDate, setExamDate] = useState('');
  const [examName, setExamName] = useState('DHA Exam');

  const fetchPlan = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: plan } = await supabase
        .from('study_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (plan) {
        setActivePlan(plan);
        const { data: planItems } = await supabase
          .from('study_plan_items')
          .select('*')
          .eq('study_plan_id', plan.id)
          .order('planned_date', { ascending: true });
        
        setItems(planItems || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [user]);

  const handleGeneratePlan = async () => {
    if (!examDate) {
      toast({ title: "Date Required", description: "Please select your exam date.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const { error } = await supabase.functions.invoke('generate-study-plan', {
        body: { user_id: user?.id, exam_date: examDate, exam_name: examName },
      });
      if (error) throw error;
      toast({ title: "Plan Ready!", description: "Your AI study schedule has been created." });
      fetchPlan();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleTask = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase
        .from('study_plan_items')
        .update({ is_completed: !current })
        .eq('id', id);
      if (error) throw error;
      setItems(items.map(item => item.id === id ? { ...item, is_completed: !current } : item));
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const deletePlan = async () => {
    if (!window.confirm("Are you sure? This will delete your entire study schedule.")) return;
    try {
      await supabase.from('study_plans').delete().eq('id', activePlan?.id);
      setActivePlan(null);
      setItems([]);
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  const completedCount = items.filter(i => i.is_completed).length;
  const progressPercent = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">AI Study Planner</h1>
          <p className="text-muted-foreground font-medium">Your personalized roadmap to passing the Prometric exam.</p>
        </div>
        {activePlan && (
          <Button variant="ghost" className="text-destructive font-bold uppercase text-xs" onClick={deletePlan}>
            <Trash2 className="h-4 w-4 mr-2" /> Reset Roadmap
          </Button>
        )}
      </div>

      {!activePlan ? (
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground py-10 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-yellow-400" />
            <CardTitle className="text-2xl font-black uppercase">Create Your Schedule</CardTitle>
            <CardDescription className="text-primary-foreground/70">Enter your exam details and let AI handle the planning.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Exam Name</Label>
                <Input value={examName} onChange={e => setExamName(e.target.value)} placeholder="e.g. DHA Nurse Exam" className="h-12 rounded-xl border-2" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Exam Date</Label>
                <Input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="h-12 rounded-xl border-2" />
              </div>
            </div>
            <Button className="w-full h-14 text-lg font-black uppercase tracking-widest shadow-lg" onClick={handleGeneratePlan} disabled={isGenerating}>
              {isGenerating ? <><Loader2 className="h-6 w-6 animate-spin mr-2" /> Analyzing Blueprints...</> : "Generate AI Roadmap"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-lg rounded-2xl bg-primary text-primary-foreground overflow-hidden">
              <CardHeader>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Your Target</p>
                <CardTitle className="text-xl font-black">{activePlan.exam_name}</CardTitle>
                <CardDescription className="text-primary-foreground/70 flex items-center gap-2 mt-1 text-white">
                  <CalendarIcon className="h-4 w-4" /> {format(parseISO(activePlan.exam_date), 'PPP')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="flex justify-between items-end">
                    <span className="text-sm font-bold">Preparation Progress</span>
                    <span className="text-2xl font-black">{Math.round(progressPercent)}%</span>
                 </div>
                 <Progress value={progressPercent} className="h-3 bg-white/20" />
                 <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-60">
                    <span>{completedCount} Completed</span>
                    <span>{items.length - completedCount} Remaining</span>
                 </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-2xl bg-muted/30">
               <CardContent className="p-6">
                  <h4 className="font-black text-xs uppercase tracking-widest text-primary mb-3">AI Study Tip</h4>
                  <p className="text-sm text-slate-600 leading-relaxed italic">
                    "Consistent daily practice is 3x more effective than weekend cramming. Focus on your weak categories tonight."
                  </p>
               </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center gap-2 px-1">
               <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Today & Upcoming</h2>
            </div>
            <div className="space-y-3">
              {items.map((item) => {
                const isItemToday = isToday(parseISO(item.planned_date));
                
                return (
                  <div 
                    key={item.id}
                    className={cn(
                        "flex items-center gap-4 p-5 rounded-2xl border-2 transition-all group",
                        item.is_completed ? "bg-green-50/50 border-green-200" : isItemToday ? "bg-white border-primary shadow-md scale-[1.02]" : "bg-white border-slate-100 hover:border-slate-300"
                    )}
                  >
                    <div className={cn(
                        "h-12 w-12 rounded-full flex flex-col items-center justify-center shrink-0 border-2",
                        isItemToday ? "bg-primary text-white border-primary" : "bg-muted/50 text-muted-foreground"
                    )}>
                        <span className="text-[10px] font-black uppercase">{format(parseISO(item.planned_date), 'MMM')}</span>
                        <span className="text-sm font-black leading-none">{format(parseISO(item.planned_date), 'dd')}</span>
                    </div>

                    <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            {isItemToday && <Badge className="text-[9px] font-black h-4 px-1.5">ACTIVE</Badge>}
                            <h3 className={cn("font-bold text-sm truncate", item.is_completed && "text-muted-foreground line-through")}>
                                {item.task_title}
                            </h3>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">Study Module • Expert Content</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn(
                                "rounded-full transition-all",
                                item.is_completed ? "text-green-600 bg-green-100" : "text-slate-300 hover:text-primary hover:bg-primary/5"
                            )}
                            onClick={() => toggleTask(item.id, item.is_completed)}
                        >
                            {item.is_completed ? <CheckCircle2 className="h-6 w-6" /> : <Circle className="h-6 w-6" />}
                        </Button>
                        {!item.is_completed && (
                           <Link to="/quiz">
                               <Button variant="ghost" size="icon" className="rounded-full"><ArrowRight className="h-4 w-4" /></Button>
                           </Link>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <MadeWithDyad />
    </div>
  );
};

export default StudyPlannerPage;