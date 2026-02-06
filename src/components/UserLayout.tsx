"use client";

import { useState, useEffect } from 'react';
import UserSidebar from './UserSidebar';
import { Outlet, useLocation } from 'react-router-dom';

const UserLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Automatically collapse the sidebar when in "Study Mode" routes
    const isStudyMode = location.pathname === '/quiz' || location.pathname === '/user/take-test';
    
    if (isStudyMode) {
      setIsCollapsed(true);
    }
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-background text-foreground pt-16">
      <UserSidebar 
        isCollapsed={isCollapsed} 
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)} 
      />
      <div className="flex-1">
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default UserLayout;