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

  const fetchUserProfile = useCallback(async (supabaseUser: User): Promise<AuthUser> => {
    if (!isMounted.current) {
      return {
        ...supabaseUser,
        is_admin: false,
        has_active_subscription: false,
        trial_taken: false,
      } as AuthUser;
    }

    let profileData = null;
    let latestSubEndDate: string | null = null;

    try {
      const { data: profileDataArray, error: _selectError } = await supabase
          .from('profiles')
          .select('is_admin, first_name, last_name, phone_number, whatsapp_number, has_active_subscription, trial_taken')
          .eq('id', supabaseUser.id);
      
      if (profileDataArray && profileDataArray[0]) {
        profileData = profileDataArray[0];
      }

      let currentHasActiveSubscription = profileData?.has_active_subscription || false;

      if (currentHasActiveSubscription) {
        const { data: latestSub, error: subError } = await supabase
          .from('user_subscriptions')
          .select('end_date, status')
          .eq('user_id', supabaseUser.id)
          .eq('status', 'active')
          .order('end_date', { ascending: false })
          .limit(1)
          .single();

        if (!subError && latestSub && latestSub.end_date) {
            latestSubEndDate = latestSub.end_date;
            const endDate = parseISO(latestSub.end_date);
            if (isPast(endDate)) {
                currentHasActiveSubscription = false;
                await supabase.functions.invoke('update-expired-subscription-status', {
                    body: { user_id: supabaseUser.id, is_active: false },
                });
            }
        }
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
        subscription_end_date: latestSubEndDate,
      };
      return hydratedUser;
    } catch (e: any) {
      return {
        ...supabaseUser,
        is_admin: profileData?.is_admin || false,
        has_active_subscription: profileData?.has_active_subscription || false,
        trial_taken: profileData?.trial_taken || false,
      } as AuthUser;
    }
  }, []);

  const updateSessionAndUser = useCallback(async (currentSession: Session | null, event: string) => {
    if (!isMounted.current) return;

    if (!currentSession) {
      setSession(null);
      setUser(null);
    } else {
      const needsDbProfileFetch = !user || user.id !== currentSession.user.id || event === 'USER_UPDATED';
      let hydratedUser: AuthUser | null = user;

      if (needsDbProfileFetch) {
        hydratedUser = await fetchUserProfile(currentSession.user);
      }

      if (isMounted.current) {
        setSession(currentSession);
        setUser(hydratedUser);
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
        await updateSessionAndUser(null, 'INITIAL_LOAD_ERROR');
      } finally {
        if (isMounted.current) setHasCheckedInitialSession(true);
      }
    };

    performInitialSessionCheck();

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
      if (user.is_admin) {
        navigate('/admin/dashboard');
      } else {
        navigate('/user/dashboard');
      }
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