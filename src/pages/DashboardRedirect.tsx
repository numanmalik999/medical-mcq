"use client";

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/components/SessionContextProvider";
import { Loader2 } from "lucide-react";

const DashboardRedirect = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (hasCheckedInitialSession) {
      if (user) {
        if (user.is_admin) {
          console.log("[Redirect] Admin detected, routing to /admin/dashboard");
          navigate("/admin/dashboard", { replace: true });
        } else {
          console.log("[Redirect] Standard user detected, routing to /user/dashboard");
          navigate("/user/dashboard", { replace: true });
        }
      } else {
        // If the redirect page is reached without a user, something is wrong, go home.
        console.warn("[Redirect] No user session found, routing to landing page");
        navigate("/", { replace: true });
      }
    }
  }, [user, hasCheckedInitialSession, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 pt-16">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-sm font-black uppercase tracking-widest text-muted-foreground animate-pulse">
            Configuring Your Session...
        </p>
      </div>
    </div>
  );
};

export default DashboardRedirect;