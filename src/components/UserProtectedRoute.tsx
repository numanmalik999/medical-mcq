"use client";

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from './SessionContextProvider';

// Define user routes that are accessible to unauthenticated users (guests)
const guestAllowedUserRoutes = ['/user/dashboard', '/user/profile', '/user/subscriptions'];

const UserProtectedRoute = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const location = useLocation();

  if (!hasCheckedInitialSession) { // Show loading only until initial session check is done
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading user session...</p>
      </div>
    );
  }

  // If no user, check if the current route is guest-allowed
  if (!user) {
    if (guestAllowedUserRoutes.includes(location.pathname)) {
      // Allow access for guests on specified routes
      return <Outlet />;
    }
    // Otherwise, redirect to login
    return <Navigate to="/login" replace />;
  }

  // If user is logged in, allow access
  return <Outlet />;
};

export default UserProtectedRoute;