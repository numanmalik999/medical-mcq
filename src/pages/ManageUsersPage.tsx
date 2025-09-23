"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad }
 from '@/components/made-with-dyad';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User as UserIcon } from 'lucide-react';
import { User } from '@supabase/supabase-js'; // Import User type

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email: string | null; // Will be fetched from auth.users
  created_at: string;
}

const ManageUsersPage = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*');

    if (profilesError) {
      console.error('Error fetching user profiles:', profilesError);
      toast({ title: "Error", description: "Failed to load user profiles.", variant: "destructive" });
      setUsers([]);
      setIsLoading(false);
      return;
    }

    // Fetch auth.users data via Edge Function
    const { data: authUsersResponse, error: edgeFunctionError } = await supabase.functions.invoke('list-users');

    let authUsersData: User[] = [];
    if (edgeFunctionError) {
      console.error('Error fetching auth users from Edge Function:', edgeFunctionError);
      toast({ title: "Error", description: "Failed to load user authentication data from server.", variant: "destructive" });
      // Proceed with profiles data only if auth data fails
    } else if (authUsersResponse) {
      authUsersData = authUsersResponse as User[];
    }

    const authUsersMap = new Map(authUsersData.map((user: User): [string, User] => [user.id, user]));

    const combinedUsers: UserProfile[] = profilesData.map(profile => {
      const authUser: User | undefined = authUsersMap.get(profile.id);
      return {
        ...profile,
        email: authUser?.email || null,
      };
    });

    setUsers(combinedUsers);
    setIsLoading(false);
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
    // Future: Add actions like "Edit User", "Reset Password", "Delete User"
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
    </div>
  );
};

export default ManageUsersPage;