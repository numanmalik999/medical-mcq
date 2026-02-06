"use client";

import { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import { Outlet } from 'react-router-dom';

const AdminLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground pt-16">
      <AdminSidebar isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} />
      <div className="flex-1 overflow-hidden">
        <div className="p-4 sm:p-6 lg:p-8">
            <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;