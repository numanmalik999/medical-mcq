"use client";

import UserSidebar from './UserSidebar';
import { Outlet } from 'react-router-dom';

const UserLayout = () => {
  return (
    <div className="flex min-h-screen bg-background text-foreground pt-16">
      <UserSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default UserLayout;