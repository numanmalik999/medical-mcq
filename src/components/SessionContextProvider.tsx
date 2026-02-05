"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { isPast, parseISO } from 'date-fns';

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

  const fetchUserProfile = useCallback(async (supabaseUser: User): Promise<AuthUser> => {
    if (!isMounted.current) {
      return { ...supabaseUser } as AuthUser;
    }

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
            }).catch(err => console.error("[Session] Background maintenance failed:", err));
          }
        }
      }
    
      return {
        ...supabaseUser,
        is_admin: profileData?.is_admin || false,
        first_name: profileData?.first_name || null,
        last_name: profileData?.last_name || null,
        phone_number: profileData?.phone_number || null,
        whatsapp_number: profileData?.whatsapp_number || null,
        has_active_subscription: currentHasActiveSubscription,
        trial_taken: profileData?.trial_taken || false,
        subscription_end_date: latestSubEndDate,
      };
    } catch (e: any) {
      console.error("[Session] Hydration error:", e);
      return { ...supabaseUser } as AuthUser;
    }
  }, []);

  const updateSessionAndUser = useCallback(async (currentSession: Session | null, event: string) => {
    if (!isMounted.current) return;

    if (!currentSession) {
      setSession(null);
      setUser(null);
    } else {
      const needsDbProfileFetch = !user || user.id !== currentSession.user.id || event === 'USER_UPDATED' || event === 'SIGNED_IN';
      
      if (needsDbProfileFetch) {
        const hydratedUser = await fetchUserProfile(currentSession.user);
        if (isMounted.current) {
          setSession(currentSession);
          setUser(hydratedUser);
        }
      } else {
        setSession(currentSession);
      }
    }
  }, [fetchUserProfile, user]);

  useEffect(() => {
    isMounted.current = true;
    
    const initialize = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (initialSession) {
          await updateSessionAndUser(initialSession, 'INITIAL_LOAD');
        }
      } catch (e) {
        console.error("[Session] Initial check failed:", e);
      } finally {
        if (isMounted.current) setHasCheckedInitialSession(true);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted.current) return;
      await updateSessionAndUser(currentSession, event);
    });

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, [updateSessionAndUser]);

  useEffect(() => {
    if (hasCheckedInitialSession && user && (location.pathname === '/login' || location.pathname === '/signup')) {
      navigate(user.is_admin ? '/admin/dashboard' : '/user/dashboard', { replace: true });
    }
  }, [user, hasCheckedInitialSession, navigate, location.pathname]);

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