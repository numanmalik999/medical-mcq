"use client";

import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from './SessionContextProvider';

const AdminProtectedRoute = () => {
  const { user, hasCheckedInitialSession } = useSession();

  if (!hasCheckedInitialSession) { // Show loading only until initial session check is done
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-700">Loading user session...</p>
      </div>
    );
  }

  // If initial check is done and no user, or user is not admin, redirect
  if (!user || !user.is_admin) {
    return <Navigate to="/user/dashboard" replace />;
  }

  return <Outlet />;
};

export default AdminProtectedRoute;