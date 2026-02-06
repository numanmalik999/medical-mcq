"use client";

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from './SessionContextProvider';

// Define user routes that are accessible to unauthenticated users (guests)
const guestAllowedUserRoutes = [
  '/user/dashboard', 
  '/user/profile', 
  '/user/subscriptions',
  '/user/take-test',
  '/user/videos',
  '/user/case-studies',
  '/user/courses',
  '/quiz', // Moved here for unified layout
  '/quiz-of-the-day', // Moved here for unified layout
  '/subscription', // Moved here for unified layout
  '/reviews' // Moved here for unified layout
];

const UserProtectedRoute = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const location = useLocation();

  if (!hasCheckedInitialSession) { // Show loading only until initial session check is done
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-700">Loading user session...</p>
      </div>
    );
  }

  // If no user, check if the current route is guest-allowed
  if (!user) {
    const isAllowed = guestAllowedUserRoutes.some(route => location.pathname.startsWith(route));
    if (isAllowed) {
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