"use client";

import { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import { Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import Footer from './Footer';

const AdminLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AdminSidebar isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} />
      <div className={cn(
        "flex-1 overflow-hidden transition-all duration-300 flex flex-col",
        !isMobile && (isCollapsed ? "ml-16" : "ml-64")
      )}>
        <main className="flex-grow p-4 sm:p-6 lg:p-8 pt-16">
            <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default AdminLayout;