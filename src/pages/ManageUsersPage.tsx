"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad }
 from '@/components/made-with-dyad';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { User } from '@supabase/supabase-js'; // Import User type
import EditUserDialog from '@/components/EditUserDialog'; // Import the new dialog
import { Badge } from '@/components/ui/badge'; // Import Badge

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
  is_admin: boolean;
  phone_number: string | null;
  whatsapp_number: string | null;
  has_active_subscription: boolean; // Added subscription status
}

const ManageUsersPage = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);

    // 1. Fetch all users from Supabase Auth via Edge Function
    const { data: authUsersResponse, error: edgeFunctionError } = await supabase.functions.invoke('list-users');

    let authUsersData: User[] = [];
    if (edgeFunctionError) {
      console.error('Error fetching auth users from Edge Function:', edgeFunctionError);
      toast({ title: "Error", description: "Failed to load user authentication data from server.", variant: "destructive" });
      setIsLoading(false);
      return;
    } else if (authUsersResponse) {
      authUsersData = authUsersResponse as User[];
    }

    // 2. Fetch all profiles from the public.profiles table
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*');

    if (profilesError) {
      console.error('Error fetching user profiles:', profilesError);
      toast({ title: "Error", description: "Failed to load user profiles.", variant: "destructive" });
      // We can still proceed with authUsersData even if profiles fail
    }

    const profilesMap = new Map(profilesData?.map(profile => [profile.id, profile]) || []);

    // 3. Combine the data: Iterate through authUsersData and merge with profile data
    const combinedUsers: UserProfile[] = authUsersData.map(authUser => {
      const profile = profilesMap.get(authUser.id);
      return {
        id: authUser.id,
        email: authUser.email || null,
        created_at: authUser.created_at,
        first_name: profile?.first_name || null,
        last_name: profile?.last_name || null,
        avatar_url: profile?.avatar_url || null,
        is_admin: profile?.is_admin || false, // Default to false if no profile or not set
        phone_number: profile?.phone_number || null,
        whatsapp_number: profile?.whatsapp_number || null,
        has_active_subscription: profile?.has_active_subscription || false, // Added
      };
    });

    setUsers(combinedUsers);
    setIsLoading(false);
  };

  const handleEditClick = (userProfile: UserProfile) => {
    setSelectedUserForEdit(userProfile);
    setIsEditDialogOpen(true);
  };

  const columns: ColumnDef<UserProfile>[] = [
    {
      accessorKey: 'avatar_url',
      header: 'Avatar',
      cell: ({ row }) => (
        <Avatar>
          <AvatarImage src={row.original.avatar_url || undefined} alt={`${row.original.first_name} ${row.original.last_name}`} />
          <AvatarFallback>
            <UserIcon className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
      ),
    },
    {
      accessorKey: 'first_name',
      header: 'First Name',
      cell: ({ row }) => row.original.first_name || 'N/A',
    },
    {
      accessorKey: 'last_name',
      header: 'Last Name',
      cell: ({ row }) => row.original.last_name || 'N/A',
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => row.original.email || 'N/A',
    },
    {
      accessorKey: 'created_at',
      header: 'Joined On',
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      accessorKey: 'is_admin',
      header: 'Admin',
      cell: ({ row }) => (row.original.is_admin ? 'Yes' : 'No'),
    },
    {
      accessorKey: 'has_active_subscription', // New column for subscription status
      header: 'Subscription',
      cell: ({ row }) => (
        <Badge variant={row.original.has_active_subscription ? "default" : "secondary"}>
          {row.original.has_active_subscription ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const userProfile = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleEditClick(userProfile)}>
                Edit User
              </DropdownMenuItem>
              {/* Future: Add Delete User, Reset Password, etc. */}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage Users</h1>

      <Card>
        <CardHeader>
          <CardTitle>All Registered Users</CardTitle>
          <CardDescription>View and manage user profiles.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={users} />
        </CardContent>
      </Card>

      <MadeWithDyad />

      {selectedUserForEdit && (
        <EditUserDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          userProfile={selectedUserForEdit}
          onSave={fetchUsers} // Refresh the list after saving
        />
      )}
    </div>
  );
};

export default ManageUsersPage;