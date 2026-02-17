"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
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
  const isMounted = useRef(true);

  const hydrateProfile = useCallback(async (supabaseUser: User) => {
    if (!isMounted.current) return;

    try {
      // 1. Fetch profile and subscription status in parallel
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

      // Handle subscription expiry logic
      if (currentHasActiveSubscription && latestSubEndDate) {
        const endDate = parseISO(latestSubEndDate);
        if (isPast(endDate)) {
          currentHasActiveSubscription = false;
          // Silently trigger background update
          supabase.functions.invoke('update-expired-subscription-status', {
            body: { user_id: supabaseUser.id, is_active: false },
          }).catch(() => {});
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
      // Fallback to basic auth user so app doesn't hang
      setUser(supabaseUser as AuthUser);
    } finally {
      // ALWAYS set this to true, even on failure
      setHasCheckedInitialSession(true);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    
    // Initial check
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted.current) return;
      setSession(initialSession);
      if (initialSession) {
        hydrateProfile(initialSession.user);
      } else {
        setHasCheckedInitialSession(true);
      }
    });

    // Listen for events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!isMounted.current) return;
      
      setSession(currentSession);
      
      if (currentSession) {
        hydrateProfile(currentSession.user);
      } else {
        setUser(null);
        setHasCheckedInitialSession(true);
        if (event === 'SIGNED_OUT') {
           navigate('/login');
        }
      }
    });

    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, [hydrateProfile, navigate]);

  return (
    <SessionContext.Provider value={{ session, user, hasCheckedInitialSession }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) throw new Error('useSession must be used within a SessionContextProvider');
  return context;
};