"use client";

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from './SessionContextProvider';

const UserProtectedRoute = () => {
  const { user, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading user session...</p>
      </div>
    );
  }

  if (!user) {
    // Redirect unauthenticated users to the login page
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default UserProtectedRoute;