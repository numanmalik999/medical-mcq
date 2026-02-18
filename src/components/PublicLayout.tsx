"use client";

import { Outlet } from 'react-router-dom';
import Footer from './Footer';

const PublicLayout = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Content wrapper handles top offset for the fixed header */}
      {/* Reduced pt-16 to pt-14 to slightly overlap or sit tighter with the 64px header */}
      <div className="flex-grow pt-16">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
};

export default PublicLayout;