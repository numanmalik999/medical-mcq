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

    try {
      // 1. Fetch Profile and latest active subscription in parallel
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

      // 2. Determine subscription status
      let currentHasActiveSubscription = false;

      if (latestSub?.end_date) {
        const endDate = parseISO(latestSub.end_date);
        if (!isPast(endDate)) {
          currentHasActiveSubscription = true;
        } else {
          // Trigger background cleanup if needed, but don't await it
          if (profileData?.has_active_subscription) {
            supabase.functions.invoke('update-expired-subscription-status', {
              body: { user_id: supabaseUser.id, is_active: false },
            }).catch(console.error);
          }
        }
      }

      // 3. Fallback to profile flag if no sub record exists (covers manual awards/legacy)
      if (!latestSub && profileData?.has_active_subscription) {
        currentHasActiveSubscription = true;
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
      };
    } catch (e: any) {
      console.error(`[SessionContext] Profile hydration failed:`, e.message);
      return { ...supabaseUser, has_active_subscription: false } as AuthUser;
    }
  }, []);

  const updateSessionAndUser = useCallback(async (currentSession: Session | null, event: string) => {
    if (!isMounted.current) return;

    if (!currentSession) {
      setSession(null);
      setUser(null);
    } else {
      // Fetch details if it's the initial load or a user-specific change
      const needsFullFetch = !user || user.id !== currentSession.user.id || event === 'SIGNED_IN' || event === 'INITIAL_LOAD';
      
      if (needsFullFetch) {
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

    const initSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        await updateSessionAndUser(initialSession, 'INITIAL_LOAD');
      } catch (e) {
        console.error('[SessionContext] initialization error:', e);
      } finally {
        if (isMounted.current) setHasCheckedInitialSession(true);
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      // Ensure we don't re-trigger initial check logic if already handled
      await updateSessionAndUser(currentSession, event);
      if (isMounted.current && !hasCheckedInitialSession) setHasCheckedInitialSession(true);
    });

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, [updateSessionAndUser, hasCheckedInitialSession]);

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