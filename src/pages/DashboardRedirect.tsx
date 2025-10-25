"use client";

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/components/SessionContextProvider";

const DashboardRedirect = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (hasCheckedInitialSession) {
      if (user) {
        if (user.is_admin) {
          navigate("/admin/dashboard", { replace: true });
        } else {
          navigate("/user/dashboard", { replace: true });
        }
      } else {
        // If not logged in, redirect to the landing page
        navigate("/", { replace: true });
      }
    }
  }, [user, hasCheckedInitialSession, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 pt-16">
      <p className="text-gray-700">Redirecting...</p>
    </div>
  );
};

export default DashboardRedirect;