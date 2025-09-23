"use client";

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from './SessionContextProvider';

const AdminProtectedRoute = () => {
  const { user, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading user session...</p>
      </div>
    );
  }

  if (!user || !user.is_admin) {
    // Redirect non-admin users to the user dashboard or login
    return <Navigate to="/user/dashboard" replace />;
  }

  return <Outlet />;
};

export default AdminProtectedRoute;