"use client";

import { useState, useEffect } from 'react';
import UserSidebar from './UserSidebar';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const UserLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  const isStudyMode = location.pathname === '/quiz' || location.pathname === '/user/take-test';

  useEffect(() => {
    if (isStudyMode) {
      setIsCollapsed(true);
    }
  }, [location.pathname, isStudyMode]);

  return (
    <div className="flex min-h-screen bg-background text-foreground pt-16">
      <UserSidebar 
        isCollapsed={isCollapsed} 
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)} 
      />
      <div className="flex-1 min-w-0">
        <div className={cn(
          "transition-all duration-300",
          isStudyMode ? "p-1 sm:p-3 lg:p-4" : "p-4 sm:p-6 lg:p-8"
        )}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default UserLayout;