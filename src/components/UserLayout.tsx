"use client";

import UserSidebar from './UserSidebar';
import { Outlet } from 'react-router-dom';

const UserLayout = () => {
  // const isMobile = useIsMobile(); // Removed unused variable

  return (
    <div className="flex min-h-screen bg-background text-foreground pt-16"> {/* Added pt-16 for header */}
      <UserSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
        <Outlet /> {/* Render nested routes here */}
      </main>
    </div>
  );
};

export default UserLayout;