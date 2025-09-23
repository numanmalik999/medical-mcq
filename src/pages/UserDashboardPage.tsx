"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';

const UserDashboardPage = () => {
  const { user } = useSession();
  const userEmail = user?.email || 'Guest';

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Welcome, {userEmail}!</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300">
            This is your personal space. Here you can find your quiz progress, profile settings, and more.
          </p>
          <p className="mt-4 text-gray-700 dark:text-gray-300">
            Use the sidebar to navigate.
          </p>
        </CardContent>
      </Card>
      {/* Future sections for quiz history, progress, etc. */}
      <MadeWithDyad />
    </div>
  );
};

export default UserDashboardPage;