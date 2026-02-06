"use client";

import { useState, useEffect } from 'react';
import UserSidebar from './UserSidebar';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import Footer from './Footer';

const UserLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();

  const isStudyMode = location.pathname === '/quiz' || location.pathname === '/user/take-test';

  useEffect(() => {
    if (isStudyMode) {
      setIsCollapsed(true);
    }
  }, [location.pathname, isStudyMode]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar is fixed top-16 */}
      <UserSidebar 
        isCollapsed={isCollapsed} 
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)} 
      />
      
      {/* Content wrapper handles top offset for the fixed header */}
      <div className={cn(
        "flex-1 min-w-0 transition-all duration-300 flex flex-col pt-16",
        !isMobile && (isCollapsed ? "ml-14" : "ml-60")
      )}>
        <main className={cn(
          "flex-grow transition-all duration-300",
          isStudyMode ? "p-2 sm:p-4" : "p-4 sm:p-6 lg:p-8"
        )}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default UserLayout;