"use client";

import AdminSidebar from './AdminSidebar';
import { Outlet } from 'react-router-dom'; // Import Outlet

const AdminLayout = () => { // Removed children prop
  // const isMobile = useIsMobile(); // Removed unused variable

  return (
    <div className="flex min-h-screen bg-background text-foreground pt-16"> {/* Added pt-16 for header */}
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
        <Outlet /> {/* Render nested routes here */}
      </main>
    </div>
  );
};

export default AdminLayout;