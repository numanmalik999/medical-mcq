"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { isPast, parseISO, differenceInHours } from 'date-fns';
import { toast } from "sonner";

interface AuthUser extends User {
  is_admin?: boolean;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  phone_number?: string | null;
  whatsapp_number?: string | null;
  has_active_subscription?: boolean;
  trial_taken?: boolean;
  subscription_end_date?: string | null;
}

interface SessionContextType {
  session: Session | null;
  user: AuthUser | null;
  hasCheckedInitialSession: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hasCheckedInitialSession, setHasCheckedInitialSession] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isMounted = useRef(true);
  const maintenancePerformed = useRef<string | null>(null);
  const hasNotifiedTrial = useRef<string | null>(null);

  const hydrateProfile = useCallback(async (supabaseUser: User) => {
    if (!isMounted.current) return;

    try {
      const [profileRes, subRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('is_admin, first_name, last_name, phone_number, whatsapp_number, has_active_subscription, trial_taken')
          .eq('id', supabaseUser.id)
          .maybeSingle(),
        supabase
          .from('user_subscriptions')
          .select('end_date, status')
          .eq('user_id', supabaseUser.id)
          .eq('status', 'active')
          .order('end_date', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      if (!isMounted.current) return;

      const profileData = profileRes.data;
      const latestSub = subRes.data;
      
      let currentHasActiveSubscription = profileData?.has_active_subscription || false;
      const latestSubEndDate = latestSub?.end_date || null;

      if (currentHasActiveSubscription && latestSubEndDate) {
        const endDate = parseISO(latestSubEndDate);
        if (isPast(endDate)) {
          currentHasActiveSubscription = false;
          if (maintenancePerformed.current !== supabaseUser.id) {
            maintenancePerformed.current = supabaseUser.id;
            supabase.functions.invoke('update-expired-subscription-status', {
              body: { user_id: supabaseUser.id, is_active: false },
            }).catch(err => console.error("[Session] Maintenance failed:", err));
          }
        } else {
            const hoursLeft = differenceInHours(endDate, new Date());
            const daysLeft = Math.ceil(hoursLeft / 24);

            if (hoursLeft >= 0 && hoursLeft <= 72 && hasNotifiedTrial.current !== supabaseUser.id) {
                hasNotifiedTrial.current = supabaseUser.id;
                const timeStr = hoursLeft < 24 ? 'less than 24 hours' : `approximately ${daysLeft} days`;
                
                toast.success("Active Trial Detected!", {
                    description: `Welcome! You have ${timeStr} of Premium access remaining.`,
                    duration: 8000,
                });
            }
        }
      }
    
      setUser({
        ...supabaseUser,
        is_admin: profileData?.is_admin || false,
        first_name: profileData?.first_name || supabaseUser.user_metadata?.first_name || null,
        last_name: profileData?.last_name || supabaseUser.user_metadata?.last_name || null,
        phone_number: profileData?.phone_number || null,
        whatsapp_number: profileData?.whatsapp_number || null,
        has_active_subscription: currentHasActiveSubscription,
        trial_taken: profileData?.trial_taken || false,
        subscription_end_date: latestSubEndDate,
      } as AuthUser);
    } catch (e: any) {
      console.error("[Session] Profile hydration error:", e);
    } finally {
      setHasCheckedInitialSession(true);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    
    const safetyTimeout = setTimeout(() => {
        if (!hasCheckedInitialSession) {
            setHasCheckedInitialSession(true);
        }
    }, 3000);

    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (!isMounted.current) return;
      
      if (error) {
          if (error.message?.includes("JWN") || error.status === 400) {
              supabase.auth.signOut().finally(() => setHasCheckedInitialSession(true));
              return;
          }
          setHasCheckedInitialSession(true);
          return;
      }

      setSession(initialSession);
      if (initialSession) {
        hydrateProfile(initialSession.user);
      } else {
        setHasCheckedInitialSession(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!isMounted.current) return;
      
      setSession(currentSession);
      
      if (currentSession) {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
          hydrateProfile(currentSession.user);
        } else {
          setUser(currentSession.user as AuthUser);
          setHasCheckedInitialSession(true);
        }
      } else {
        setUser(null);
        hasNotifiedTrial.current = null;
        setHasCheckedInitialSession(true);
      }
    });

    return () => {
      isMounted.current = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [hydrateProfile]);

  useEffect(() => {
    if (hasCheckedInitialSession && session && (location.pathname === '/login' || location.pathname === '/signup')) {
      const isAdmin = user?.is_admin || false;
      const timer = setTimeout(() => {
        navigate(isAdmin ? '/admin/dashboard' : '/user/dashboard', { replace: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [session, user?.is_admin, hasCheckedInitialSession, navigate, location.pathname]);

  return (
    <SessionContext.Provider value={{ session, user, hasCheckedInitialSession }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};