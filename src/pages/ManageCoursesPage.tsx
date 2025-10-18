"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, BookOpen } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EditCourseDialog, { Course } from '@/components/EditCourseDialog';
import { useSession } from '@/components/SessionContextProvider';
import { Link } from 'react-router-dom';

const ManageCoursesPage = () => {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCourseForEdit, setSelectedCourseForEdit] = useState<Course | null>(null);

  const { hasCheckedInitialSession } = useSession();

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

  const handleDeleteCourse = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this course? All associated topics will also be deleted.")) {
      return;
    }
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Course deleted successfully." });
      fetchCourses();
    } catch (error: any) {
      console.error("Error deleting course:", error);
      toast({ title: "Error", description: `Failed to delete course: ${error.message}`, variant: "destructive" });
    }
  };

  const openEditDialog = (course?: Course) => {
    setSelectedCourseForEdit(course || null);
    setIsEditDialogOpen(true);
  };

  const columns: ColumnDef<Course>[] = [
    { accessorKey: 'title', header: 'Course Title' },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => <div className="w-[250px] truncate">{row.original.description || 'N/A'}</div>,
    },
    {
      accessorKey: 'created_at',
      header: 'Created On',
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
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
            <DropdownMenuItem onClick={() => handleDeleteCourse(row.original.id)} className="text-red-600">Delete</DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to={`/admin/manage-courses/${row.original.id}/topics`} className="flex items-center">
                <BookOpen className="mr-2 h-4 w-4" /> Manage Topics
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (!hasCheckedInitialSession || isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading courses...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage Courses</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl">Courses</CardTitle>
          <Button onClick={() => openEditDialog()}>Add New Course</Button>
        </CardHeader>
        <CardDescription>Create, edit, and delete educational courses.</CardDescription> {/* Added CardDescription */}
        <CardContent>
          <DataTable columns={columns} data={courses} />
        </CardContent>
      </Card>

      <MadeWithDyad />

      <EditCourseDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        course={selectedCourseForEdit}
        onSave={fetchCourses}
      />
    </div>
  );
};

export default ManageCoursesPage;