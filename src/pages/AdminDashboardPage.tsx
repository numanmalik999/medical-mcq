"use client";

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';

const AdminDashboardPage = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Welcome to the Admin Panel</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300">
            Use the sidebar to navigate through content management, user management, and other administrative tasks.
          </p>
        </CardContent>
      </Card>
      {/* Future sections for analytics, quick stats, etc. */}
      <MadeWithDyad />
    </div>
  );
};

export default AdminDashboardPage;