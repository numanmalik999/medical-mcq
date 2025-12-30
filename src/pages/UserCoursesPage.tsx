"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { Link } from 'react-router-dom';
import { BookOpenText, Lock, Loader2 } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

const UserCoursesPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    if (user?.has_active_subscription) {
      fetchCourses();
    } else if (hasCheckedInitialSession) {
      setIsPageLoading(false);
    }
  }, [user, hasCheckedInitialSession]);

  const fetchCourses = async () => {
    setIsPageLoading(true);
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('title', { ascending: true });

    if (error) {
      console.error('Error fetching courses:', error);
      toast({ title: "Error", description: "Failed to load courses.", variant: "destructive" });
      setCourses([]);
    } else {
      setCourses(data || []);
    }
    setIsPageLoading(false);
  };

  if (!hasCheckedInitialSession || isPageLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
  }

  if (!user?.has_active_subscription) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <Card className="border-primary/20 shadow-xl py-8">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
              <Lock className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-3xl">Premium Content</CardTitle>
            <CardDescription className="text-lg">
              Our structured medical courses are available exclusively to subscribed members.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Unlock comprehensive learning paths, detailed topic breakdowns, and expert-curated medical content.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link to="/user/subscriptions">
                <Button size="lg" className="w-full">View Subscription Plans</Button>
              </Link>
              <Link to="/user/dashboard">
                <Button variant="outline" size="lg" className="w-full">Back to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Our Courses</h1>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            No courses available at the moment. Please check back later.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
              {course.image_url && (
                <div className="relative h-48 w-full">
                  <img
                    src={course.image_url}
                    alt={course.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <CardTitle className="absolute bottom-4 left-4 text-white text-2xl z-10">{course.title}</CardTitle>
                </div>
              )}
              {!course.image_url && (
                <CardHeader>
                  <CardTitle className="text-xl">{course.title}</CardTitle>
                </CardHeader>
              )}
              <CardContent className="flex-grow p-4">
                <CardDescription className="text-sm text-muted-foreground line-clamp-3">
                  {course.description || 'No description provided.'}
                </CardDescription>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Link to={`/user/courses/${course.id}`} className="w-full">
                  <Button className="w-full">
                    <BookOpenText className="mr-2 h-4 w-4" /> View Course
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <MadeWithDyad />
    </div>
  );
};

export default UserCoursesPage;