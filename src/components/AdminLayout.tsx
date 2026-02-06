"use client";

import { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import { Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const AdminLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen bg-background text-foreground pt-16">
      <AdminSidebar isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} />
      <div className={cn(
        "flex-1 overflow-hidden transition-all duration-300",
        !isMobile && (isCollapsed ? "ml-16" : "ml-64")
      )}>
        <div className="p-4 sm:p-6 lg:p-8">
            <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;