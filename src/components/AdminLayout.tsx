"use client";

import React from 'react';
import AdminSidebar from './AdminSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Outlet } from 'react-router-dom'; // Import Outlet

const AdminLayout = () => { // Removed children prop
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {!isMobile && <AdminSidebar />}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
        {isMobile && <AdminSidebar />} {/* Render mobile sidebar trigger */}
        <Outlet /> {/* Render nested routes here */}
      </main>
    </div>
  );
};

export default AdminLayout;