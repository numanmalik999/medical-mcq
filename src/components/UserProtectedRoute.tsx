"use client";

import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from './SessionContextProvider';

const UserProtectedRoute = () => {
  const { user, hasCheckedInitialSession } = useSession(); // Use hasCheckedInitialSession

  if (!hasCheckedInitialSession) { // Show loading only until initial session check is done
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading user session...</p>
      </div>
    );
  }

  // If initial check is done and no user, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default UserProtectedRoute;