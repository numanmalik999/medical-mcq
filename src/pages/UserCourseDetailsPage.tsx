"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { useParams, Link } from 'react-router-dom';
import { Accordion, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, BookOpenText } from 'lucide-react'; // Added BookOpenText icon
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

interface Course {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null; // Added image_url
}

interface CourseTopic {
  id: string;
  course_id: string;
  title: string;
  content: string | null;
  order: number;
}

const UserCourseDetailsPage = () => {
  const { hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [topics, setTopics] = useState<CourseTopic[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);

  // State for the topic dialog
  const [isTopicDialogOpen, setIsTopicDialogOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<CourseTopic | null>(null);

  useEffect(() => {
    if (hasCheckedInitialSession && courseId) {
      fetchCourseDetailsAndTopics();
    }
  }, [hasCheckedInitialSession, courseId]);

  const fetchCourseDetailsAndTopics = async () => {
    setIsPageLoading(true);
    // Fetch course details
    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError) {
      console.error('Error fetching course details:', courseError);
      toast({ title: "Error", description: "Failed to load course details.", variant: "destructive" });
      setCourse(null);
    } else if (courseData) {
      setCourse(courseData);
    }

    // Fetch topics for the course
    const { data: topicsData, error: topicsError } = await supabase
      .from('course_topics')
      .select('*')
      .eq('course_id', courseId)
      .order('order', { ascending: true });

    if (topicsError) {
      console.error('Error fetching course topics:', topicsError);
      toast({ title: "Error", description: "Failed to load course topics.", variant: "destructive" });
      setTopics([]);
    } else {
      setTopics(topicsData || []);
    }
    setIsPageLoading(false);
  };

  const handleTopicClick = (topic: CourseTopic) => {
    setSelectedTopic(topic);
    setIsTopicDialogOpen(true);
  };

  if (!hasCheckedInitialSession || isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading course details...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-2xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Course Not Found</CardTitle>
            <CardDescription>
              The course you are looking for does not exist or is not accessible.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Link to="/user/courses">
              <Button>Back to Courses</Button>
            </Link>
          </CardFooter>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/user/courses">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{course.title}</h1>
      </div>

      {course.image_url && (
        <Card className="relative w-full h-64 overflow-hidden rounded-lg shadow-lg mb-6">
          <img
            src={course.image_url}
            alt={course.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
          <div className="absolute bottom-4 left-4 text-white z-10">
            <CardTitle className="text-4xl font-extrabold">{course.title}</CardTitle>
            <CardDescription className="text-lg text-gray-200">{course.description}</CardDescription>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Course Overview</CardTitle>
          <CardDescription>{course.description || 'No description provided.'}</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Topics</CardTitle>
        </CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <p className="text-center text-muted-foreground">No topics available for this course yet.</p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {topics.map((topic) => (
                <AccordionItem key={topic.id} value={topic.id} className="border-b border-border last:border-b-0">
                  <AccordionTrigger
                    className="flex items-center justify-between w-full p-4 text-left font-medium text-lg hover:bg-accent hover:text-accent-foreground transition-colors duration-200"
                    onClick={() => handleTopicClick(topic)}
                  >
                    <span className="flex items-center gap-3">
                      <BookOpenText className="h-5 w-5 text-primary" />
                      {topic.order}. {topic.title}
                    </span>
                  </AccordionTrigger>
                  {/* AccordionContent is intentionally empty as content is shown in dialog */}
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <MadeWithDyad />

      {/* Topic Details Dialog */}
      <Dialog open={isTopicDialogOpen} onOpenChange={setIsTopicDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTopic?.title}</DialogTitle>
            <DialogDescription>
              Topic {selectedTopic?.order} of {course?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 prose dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:underline">
            {selectedTopic?.content ? (
              <ReactMarkdown rehypePlugins={[rehypeRaw]}>{selectedTopic.content}</ReactMarkdown>
            ) : (
              <p className="text-muted-foreground">No content available for this topic.</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsTopicDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserCourseDetailsPage;