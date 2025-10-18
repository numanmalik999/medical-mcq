"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, ArrowLeft } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EditCourseTopicDialog, { CourseTopic } from '@/components/EditCourseTopicDialog';
import { useSession } from '@/components/SessionContextProvider';
import { useParams, useNavigate } from 'react-router-dom';

const ManageCourseTopicsPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const [courseTitle, setCourseTitle] = useState('Loading Course...');
  const [topics, setTopics] = useState<CourseTopic[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTopicForEdit, setSelectedTopicForEdit] = useState<CourseTopic | null>(null);

  const { hasCheckedInitialSession } = useSession();

  useEffect(() => {
    if (hasCheckedInitialSession && courseId) {
      fetchCourseDetailsAndTopics();
    }
  }, [hasCheckedInitialSession, courseId]);

  const fetchCourseDetailsAndTopics = async () => {
    setIsPageLoading(true);
    // Fetch course title
    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .select('title')
      .eq('id', courseId)
      .single();

    if (courseError) {
      console.error('Error fetching course details:', courseError);
      toast({ title: "Error", description: "Failed to load course details.", variant: "destructive" });
      setCourseTitle('Course Not Found');
    } else if (courseData) {
      setCourseTitle(courseData.title);
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

  const handleDeleteTopic = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this topic? This action cannot be undone.")) {
      return;
    }
    try {
      const { error } = await supabase
        .from('course_topics')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Course topic deleted successfully." });
      fetchCourseDetailsAndTopics();
    } catch (error: any) {
      console.error("Error deleting course topic:", error);
      toast({ title: "Error", description: `Failed to delete topic: ${error.message}`, variant: "destructive" });
    }
  };

  const openEditDialog = (topic?: CourseTopic) => {
    setSelectedTopicForEdit(topic || null);
    setIsEditDialogOpen(true);
  };

  const columns: ColumnDef<CourseTopic>[] = [
    { accessorKey: 'order', header: 'Order', sortingFn: 'alphanumeric' },
    { accessorKey: 'title', header: 'Topic Title' },
    {
      accessorKey: 'content',
      header: 'Content Snippet',
      cell: ({ row }) => <div className="w-[300px] truncate">{row.original.content || 'No content yet'}</div>,
    },
    {
      accessorKey: 'updated_at',
      header: 'Last Updated',
      cell: ({ row }) => new Date(row.original.updated_at).toLocaleDateString(),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => openEditDialog(row.original)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeleteTopic(row.original.id)} className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (!hasCheckedInitialSession || isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading course topics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin/manage-courses')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Manage Topics for: {courseTitle}</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl">Course Topics</CardTitle>
          <Button onClick={() => openEditDialog()}>Add New Topic</Button>
        </CardHeader>
        <CardDescription>Create, edit, and delete topics for this course.</CardDescription> {/* Added CardDescription */}
        <CardContent>
          <DataTable columns={columns} data={topics} />
        </CardContent>
      </Card>

      <MadeWithDyad />

      {courseId && (
        <EditCourseTopicDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          courseId={courseId}
          topic={selectedTopicForEdit}
          onSave={fetchCourseDetailsAndTopics}
        />
      )}
    </div>
  );
};

export default ManageCourseTopicsPage;