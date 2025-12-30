"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { isPast, parseISO } from 'date-fns';

// Extend the User type to include profile fields
interface AuthUser extends User {
  is_admin?: boolean;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  phone_number?: string | null;
  whatsapp_number?: string | null;
  has_active_subscription?: boolean;
  trial_taken?: boolean;
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

  const fetchUserProfile = useCallback(async (supabaseUser: User): Promise<AuthUser> => {
    if (!isMounted.current) return { ...supabaseUser } as AuthUser;

    console.log(`[SessionContext] Hydrating session for: ${supabaseUser.id}`);

    try {
      // 1. Fetch Profile and latest active subscription in parallel for speed and accuracy
      const [profileResponse, subResponse] = await Promise.all([
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

      const profileData = profileResponse.data;
      const latestSub = subResponse.data;

      // 2. Determine actual subscription status
      // We trust the 'user_subscriptions' table as the source of truth over the profile flag
      let currentHasActiveSubscription = false;

      if (latestSub && latestSub.end_date) {
        const endDate = parseISO(latestSub.end_date);
        if (!isPast(endDate)) {
          currentHasActiveSubscription = true;
        } else {
          // It's expired - trigger background update if profile still says true
          if (profileData?.has_active_subscription) {
            supabase.functions.invoke('update-expired-subscription-status', {
              body: { user_id: supabaseUser.id, is_active: false },
            });
          }
        }
      }

      // 3. Fallback: if no record in sub table, but profile says true (could be a manual override or free award)
      // but only if we didn't find an expired record above.
      if (!latestSub && profileData?.has_active_subscription) {
        currentHasActiveSubscription = true;
      }

      const hydratedUser: AuthUser = {
        ...supabaseUser,
        is_admin: profileData?.is_admin || false,
        first_name: profileData?.first_name || null,
        last_name: profileData?.last_name || null,
        phone_number: profileData?.phone_number || null,
        whatsapp_number: profileData?.whatsapp_number || null,
        has_active_subscription: currentHasActiveSubscription,
        trial_taken: profileData?.trial_taken || false,
      };

      return hydratedUser;
    } catch (e: any) {
      console.error(`[SessionContext] Hydration error:`, e.message);
      return { ...supabaseUser, has_active_subscription: false } as AuthUser;
    }
  }, []);

  const updateSessionAndUser = useCallback(async (currentSession: Session | null, event: string) => {
    if (!isMounted.current) return;

    if (!currentSession) {
      setSession(null);
      setUser(null);
    } else {
      // Always fetch on initial load or user change to ensure accuracy
      const needsDbProfileFetch = !user || user.id !== currentSession.user.id || event === 'USER_UPDATED' || event === 'INITIAL_LOAD';

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

    const performInitialSessionCheck = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        await updateSessionAndUser(initialSession, 'INITIAL_LOAD');
      } catch (e) {
        console.error('[SessionContext] Initial check failed:', e);
      } finally {
        if (isMounted.current) setHasCheckedInitialSession(true);
      }
    };

    performInitialSessionCheck();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      await updateSessionAndUser(currentSession, event);
    });

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, [updateSessionAndUser]);

  useEffect(() => {
    if (hasCheckedInitialSession && user && (location.pathname === '/login' || location.pathname === '/signup')) {
      navigate(user.is_admin ? '/admin/dashboard' : '/user/dashboard');
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