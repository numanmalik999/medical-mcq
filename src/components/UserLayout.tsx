"use client";

import React from 'react';
import UserSidebar from './UserSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Outlet } from 'react-router-dom';

const UserLayout = () => {
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {!isMobile && <UserSidebar />}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
        {isMobile && <UserSidebar />} {/* Render mobile sidebar trigger */}
        <Outlet /> {/* Render nested routes here */}
      </main>
    </div>
  );
};

export default UserLayout;