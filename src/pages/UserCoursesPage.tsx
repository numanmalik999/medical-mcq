"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { Link } from 'react-router-dom';
import { BookOpenText } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

const UserCoursesPage = () => {
  const { hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      fetchCourses();
    }
  }, [hasCheckedInitialSession]);

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading courses...</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-xl">{course.title}</CardTitle>
                <CardDescription className="flex-grow">{course.description || 'No description provided.'}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                {/* Additional course details can go here */}
              </CardContent>
              <CardFooter>
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