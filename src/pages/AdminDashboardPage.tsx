"use client";

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import OfflineDownloadButton from '@/components/OfflineDownloadButton'; // Import the new component

const AdminDashboardPage = () => {
  const { hasCheckedInitialSession } = useSession(); // Get hasCheckedInitialSession

  if (!hasCheckedInitialSession) { // Show loading only until initial session check is done
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-700">Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Welcome to the Admin Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">
            Use the sidebar to navigate through content management, user management, and other administrative tasks.
          </p>
        </CardContent>
      </Card>
      
      {/* Offline Management Section */}
      <Card>
        <CardHeader>
          <CardTitle>Offline Content Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Use this button on a native mobile device to download MCQs for offline testing.
          </p>
          <OfflineDownloadButton />
        </CardContent>
      </Card>

      {/* Future sections for analytics, quick stats, etc. */}
      <MadeWithDyad />
    </div>
  );
};

export default AdminDashboardPage;