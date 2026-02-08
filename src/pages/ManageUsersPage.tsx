"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { User } from '@supabase/supabase-js';
import EditUserDialog from '@/components/EditUserDialog';
import AddUserDialog from '@/components/AddUserDialog'; 
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/components/SessionContextProvider';
import { parseISO, differenceInHours } from 'date-fns'; 
import { dismissToast } from '@/utils/toast'; 

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
  has_active_subscription: boolean;
  subscription_status: string | null;
  subscription_end_date: string | null;
}

const ManageUsersPage = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false); 
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserProfile | null>(null);

  const { hasCheckedInitialSession } = useSession();

  useEffect(() => {
    if (hasCheckedInitialSession) {
      fetchUsers();
    }
  }, [hasCheckedInitialSession]);

  const fetchUsers = async () => {
    setIsPageLoading(true);
    const { data: authUsersResponse, error: edgeFunctionError } = await supabase.functions.invoke('list-users');

    let authUsersData: User[] = [];
    if (edgeFunctionError) {
      console.error('Error fetching auth users from Edge Function:', edgeFunctionError);
      toast({ title: "Error", description: "Failed to load user authentication data from server.", variant: "destructive" });
      setIsPageLoading(false);
      return;
    } else if (authUsersResponse) {
      authUsersData = authUsersResponse as User[];
    }

    const { data: profilesData, error: profilesError } = await supabase.from('profiles').select('*');
    if (profilesError) console.error('Error fetching user profiles:', profilesError);
    const profilesMap = new Map(profilesData?.map(profile => [profile.id, profile]) || []);

    const { data: activeSubscriptions, error: subsError } = await supabase
        .from('user_subscriptions')
        .select('user_id, end_date, status')
        .eq('status', 'active')
        .order('end_date', { ascending: false });

    const activeSubsMap = new Map<string, { end_date: string, status: string }>();
    if (!subsError && activeSubscriptions) {
        activeSubscriptions.forEach(sub => {
            if (!activeSubsMap.has(sub.user_id)) activeSubsMap.set(sub.user_id, { end_date: sub.end_date, status: sub.status });
        });
    }

    const combinedUsers: UserProfile[] = authUsersData.map(authUser => {
      const profile = profilesMap.get(authUser.id);
      const activeSub = activeSubsMap.get(authUser.id);

      return {
        id: authUser.id,
        email: authUser.email || null,
        created_at: authUser.created_at,
        first_name: profile?.first_name || null,
        last_name: profile?.last_name || null,
        avatar_url: profile?.avatar_url || null,
        is_admin: profile?.is_admin || false,
        phone_number: profile?.phone_number || null,
        whatsapp_number: profile?.whatsapp_number || null,
        has_active_subscription: profile?.has_active_subscription || false,
        subscription_status: activeSub?.status || null,
        subscription_end_date: activeSub?.end_date || null,
      };
    });

    setUsers(combinedUsers);
    setIsPageLoading(false);
  };

  const handleEditClick = (userProfile: UserProfile) => {
    setSelectedUserForEdit(userProfile);
    setIsEditDialogOpen(true);
  };

  const handleDeleteUser = async (userId: string, email: string | null) => {
    if (!window.confirm(`Are you sure you want to permanently delete the user: ${email || userId}? This action cannot be undone.`)) return;
    const loadingToastId = toast({ title: "Deleting User...", description: `Attempting to delete user ${email || userId}...`, duration: 999999 });

    try {
      const { error } = await supabase.functions.invoke('admin-delete-user', { body: { user_id: userId } });
      if (error) throw error;
      toast({ title: "Success", description: `User ${email || userId} deleted successfully.` });
      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({ title: "Error", description: `Failed to delete user: ${error.message || 'Unknown error'}`, variant: "destructive" });
    } finally {
      dismissToast(loadingToastId.id);
    }
  };

  const columns: ColumnDef<UserProfile>[] = [
    {
      accessorKey: 'avatar_url',
      header: 'Avatar',
      cell: ({ row }) => (
        <Avatar>
          <AvatarImage src={row.original.avatar_url || undefined} alt={`${row.original.first_name} ${row.original.last_name}`} />
          <AvatarFallback><UserIcon className="h-5 w-5" /></AvatarFallback>
        </Avatar>
      ),
    },
    { accessorKey: 'first_name', header: 'First Name', cell: ({ row }) => row.original.first_name || 'N/A' },
    { accessorKey: 'last_name', header: 'Last Name', cell: ({ row }) => row.original.last_name || 'N/A' },
    { accessorKey: 'email', header: 'Email', cell: ({ row }) => row.original.email || 'N/A' },
    { accessorKey: 'created_at', header: 'Joined On', cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString() },
    { accessorKey: 'is_admin', header: 'Admin', cell: ({ row }) => (row.original.is_admin ? 'Yes' : 'No') },
    {
      accessorKey: 'subscription_end_date',
      header: 'Subscription',
      cell: ({ row }) => {
        const { subscription_end_date } = row.original;
        if (!subscription_end_date) return <Badge variant="secondary">Inactive</Badge>;

        const hoursLeft = differenceInHours(parseISO(subscription_end_date), new Date());
        if (hoursLeft <= 0) return <Badge variant="secondary">Expired</Badge>;
        
        const daysLeft = Math.ceil(hoursLeft / 24);

        let variant: "default" | "secondary" | "destructive" | "outline" = "default";
        if (daysLeft <= 3) variant = "destructive";
        else if (daysLeft <= 30) variant = "outline";

        return (
          <div className="flex flex-col space-y-1">
            <Badge variant={variant}>Active</Badge>
            <span className="text-[10px] text-muted-foreground font-black uppercase">
              {hoursLeft < 24 ? '< 24h left' : `${daysLeft} days left`}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const userProfile = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleEditClick(userProfile)}>Edit User</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDeleteUser(userProfile.id, userProfile.email)} className="text-red-600">Delete User</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (!hasCheckedInitialSession || isPageLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900"><p className="text-gray-700 dark:text-gray-300">Loading users...</p></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage Users</h1>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl">All Registered Users</CardTitle>
          <Button onClick={() => setIsAddDialogOpen(true)}>Add New User</Button>
        </CardHeader>
        <CardDescription className="px-6">View, edit, and manage user profiles and subscriptions.</CardDescription>
        <CardContent><DataTable columns={columns} data={users} /></CardContent>
      </Card>
      <MadeWithDyad />
      {selectedUserForEdit && (
        <EditUserDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} userProfile={selectedUserForEdit} onSave={fetchUsers} />
      )}
      <AddUserDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onSave={fetchUsers} />
    </div>
  );
};

export default ManageUsersPage;