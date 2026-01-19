"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpenText, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import TopicContentDialog from '@/components/TopicContentDialog';
import { cn } from '@/lib/utils';

interface Course {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
}

interface CourseTopic {
  id: string;
  course_id: string;
  title: string;
  content: string | null;
  order: number;
}

interface StructuredTopicContent {
  title: string;
  definition: string;
  main_causes: string;
  symptoms: string;
  diagnostic_tests: string;
  diagnostic_criteria: string;
  treatment_management: string;
  youtube_video_id: string;
}

const UserCourseDetailsPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [topics, setTopics] = useState<CourseTopic[]>([]);
  const [completedTopicIds, setCompletedTopicIds] = useState<Set<string>>(new Set());
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isToggling, setIsToggling] = useState<string | null>(null);

  const [isTopicDialogOpen, setIsTopicDialogOpen] = useState(false);
  const [selectedTopicContent, setSelectedTopicContent] = useState<StructuredTopicContent | null>(null);

  const fetchCourseDetailsAndTopics = useCallback(async () => {
    setIsPageLoading(true);
    const { data: courseData } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseData) setCourse(courseData);

    const { data: topicsData } = await supabase
      .from('course_topics')
      .select('*')
      .eq('course_id', courseId)
      .order('order', { ascending: true });

    if (topicsData) setTopics(topicsData);

    if (user) {
      const { data: progress } = await supabase
        .from('user_topic_progress')
        .select('topic_id')
        .eq('user_id', user.id);
      
      setCompletedTopicIds(new Set(progress?.map(p => p.topic_id) || []));
    }
    
    setIsPageLoading(false);
  }, [courseId, user]);

  useEffect(() => {
    if (hasCheckedInitialSession && courseId) {
      fetchCourseDetailsAndTopics();
    }
  }, [hasCheckedInitialSession, courseId, fetchCourseDetailsAndTopics]);

  const toggleTopicCompletion = async (topicId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    setIsToggling(topicId);
    const isCompleted = completedTopicIds.has(topicId);

    try {
      if (isCompleted) {
        const { error } = await supabase
          .from('user_topic_progress')
          .delete()
          .eq('user_id', user.id)
          .eq('topic_id', topicId);
        if (error) throw error;
        setCompletedTopicIds(prev => {
          const next = new Set(prev);
          next.delete(topicId);
          return next;
        });
        toast({ title: "Progress Updated", description: "Topic marked as incomplete." });
      } else {
        const { error } = await supabase
          .from('user_topic_progress')
          .insert({ user_id: user.id, topic_id: topicId });
        if (error) throw error;
        setCompletedTopicIds(prev => new Set(prev).add(topicId));
        toast({ title: "Topic Completed!", description: "Well done on finishing this section." });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsToggling(null);
    }
  };

  const handleTopicClick = (topic: CourseTopic) => {
    let content: StructuredTopicContent | null = null;
    try {
      if (topic.content) {
        const parsed = JSON.parse(topic.content);
        if (typeof parsed === 'object' && parsed !== null) {
          content = { ...parsed, title: parsed.title || topic.title };
        }
      }
    } catch (e) {
      if (topic.content) {
        content = {
          title: topic.title,
          definition: `<p>${topic.content.replace(/\n/g, '<br />')}</p>`,
          main_causes: '', symptoms: '', diagnostic_tests: '', diagnostic_criteria: '', treatment_management: '', youtube_video_id: ''
        };
      }
    }

    if (!content) {
      content = {
        title: topic.title,
        definition: '<p>No content available for this topic yet.</p>',
        main_causes: '', symptoms: '', diagnostic_tests: '', diagnostic_criteria: '', treatment_management: '', youtube_video_id: ''
      };
    }

    setSelectedTopicContent(content);
    setIsTopicDialogOpen(true);
  };

  if (!hasCheckedInitialSession || isPageLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader><CardTitle>Course Not Found</CardTitle></CardHeader>
          <CardFooter className="justify-center"><Link to="/user/courses"><Button>Back to Courses</Button></Link></CardFooter>
        </Card>
      </div>
    );
  }

  const completionPercentage = Math.round((completedTopicIds.size / (topics.length || 1)) * 100);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/user/courses">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
            <p className="text-muted-foreground">Mastering the clinical blueprint for this specialty.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
            <Card className="overflow-hidden border-none shadow-xl bg-primary text-primary-foreground">
                {course.image_url && <img src={course.image_url} alt={course.title} className="w-full h-48 object-cover opacity-80" />}
                <CardHeader>
                    <CardTitle className="text-lg">Study Progress</CardTitle>
                    <CardDescription className="text-primary-foreground/70">Topic completion for this course.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center text-sm font-bold">
                        <span>{completedTopicIds.size}/{topics.length} Done</span>
                        <span>{completionPercentage}%</span>
                    </div>
                    <div className="h-3 w-full bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white transition-all duration-1000" style={{ width: `${completionPercentage}%` }}></div>
                    </div>
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader><CardTitle className="text-md">About Course</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground leading-relaxed">
                    {course.description || "Comprehensive clinical breakdown of essential exam topics."}
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="shadow-xl rounded-2xl border-none">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="flex items-center gap-2"><BookOpenText className="h-5 w-5 text-primary" /> Roadmap & Topics</CardTitle>
              <CardDescription>Click a topic to start learning. Mark as completed when done.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {topics.length === 0 ? (
                <p className="text-center py-20 text-muted-foreground">No topics available yet.</p>
              ) : (
                <div className="divide-y">
                  {topics.map((topic, index) => {
                    const isCompleted = completedTopicIds.has(topic.id);
                    return (
                      <div
                        key={topic.id}
                        className={cn(
                            "flex items-center gap-4 p-6 cursor-pointer transition-all hover:bg-muted/50 group",
                            isCompleted && "bg-green-50/10"
                        )}
                        onClick={() => handleTopicClick(topic)}
                      >
                        <div className="flex-1">
                          <h3 className={cn("font-bold text-lg", isCompleted && "text-muted-foreground line-through")}>
                            {index + 1}. {topic.title}
                          </h3>
                          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">High-Yield Clinical Lesson</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "rounded-full transition-colors",
                            isCompleted ? "text-green-600 hover:text-green-700 hover:bg-green-100" : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                          )}
                          onClick={(e) => toggleTopicCompletion(topic.id, e)}
                          disabled={isToggling === topic.id}
                        >
                          {isToggling === topic.id ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                          ) : isCompleted ? (
                            <CheckCircle2 className="h-8 w-8" />
                          ) : (
                            <Circle className="h-8 w-8" />
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <TopicContentDialog
        open={isTopicDialogOpen}
        onOpenChange={setIsTopicDialogOpen}
        topicContent={selectedTopicContent}
      />
      <MadeWithDyad />
    </div>
  );
};

export default UserCourseDetailsPage;