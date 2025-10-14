"use client";

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';

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
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start as true for initial load
  const navigate = useNavigate();
  const location = useLocation();
  const isMounted = useRef(true);

  // Memoize fetchUserProfile to prevent unnecessary re-creations and ensure it always returns AuthUser
  const fetchUserProfile = useCallback(async (supabaseUser: User): Promise<AuthUser> => {
    if (!isMounted.current) {
      console.warn('[fetchUserProfile] Component unmounted during profile fetch, returning default AuthUser.');
      return {
        ...supabaseUser,
        is_admin: false,
        has_active_subscription: false,
        trial_taken: false,
      } as AuthUser;
    }
    console.log(`[fetchUserProfile] START: Fetching profile for user ID: ${supabaseUser.id}`);
    const { data: profileDataArray, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin, first_name, last_name, phone_number, whatsapp_number, has_active_subscription, trial_taken')
      .eq('id', supabaseUser.id);

    if (profileError && profileError.code !== 'PGRST116') {
      console.error(`[fetchUserProfile] ERROR: fetching profile (code: ${profileError.code}):`, profileError);
      return {
        ...supabaseUser,
        is_admin: false,
        has_active_subscription: false,
        trial_taken: false,
      } as AuthUser;
    }

    const profileData = profileDataArray && profileDataArray[0] ? profileDataArray[0] : null;
    console.log('[fetchUserProfile] Profile data fetched:', profileData);

    const hydratedUser: AuthUser = {
      ...supabaseUser,
      is_admin: profileData?.is_admin || false,
      first_name: profileData?.first_name || null,
      last_name: profileData?.last_name || null,
      phone_number: profileData?.phone_number || null,
      whatsapp_number: profileData?.whatsapp_number || null,
      has_active_subscription: profileData?.has_active_subscription || false,
      trial_taken: profileData?.trial_taken || false,
    };
    console.log('[fetchUserProfile] END: Hydrated user object:', hydratedUser);
    return hydratedUser;
  }, []);

  // This function will be called on initial load and on auth state changes
  const updateSessionAndUser = useCallback(async (currentSession: Session | null, event: string) => {
    if (!isMounted.current) {
      console.warn(`[updateSessionAndUser] Skipping event ${event} - component unmounted.`);
      return;
    }

    console.log(`[updateSessionAndUser] Event: ${event}, Session present: ${!!currentSession}.`);

    try {
      if (!currentSession) {
        console.log('[updateSessionAndUser] No session, clearing user and session states.');
        setSession(null);
        setUser(null);
        // Only navigate to login if not already on login/signup
        if (location.pathname !== '/login' && location.pathname !== '/signup') {
          console.log('[updateSessionAndUser] Navigating to /login due to no session.');
          navigate('/login');
        }
      } else {
        console.log('[updateSessionAndUser] Session exists, fetching user profile.');
        const authUser = await fetchUserProfile(currentSession.user);
        if (isMounted.current) { // Only update state if component is still mounted
          setSession(currentSession);
          setUser(authUser);
          console.log('[updateSessionAndUser] User state updated:', authUser);
        }
      }
    } catch (error) {
      console.error("[updateSessionAndUser] ERROR: processing auth event:", error);
      // On error, ensure session and user are cleared
      setSession(null);
      setUser(null);
    }
    // IMPORTANT: isLoading is NOT set to false here for every event.
    // It will be set to false only after the *initial* load is complete.
  }, [navigate, location.pathname, fetchUserProfile]);

  // Main effect for setting up auth listener and initial session check
  useEffect(() => {
    isMounted.current = true;
    console.log('SessionContextProvider: Main useEffect mounted.');

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (isMounted.current) {
        console.log('SessionContextProvider: Initial Session Check Result:', initialSession);
        await updateSessionAndUser(initialSession, 'INITIAL_LOAD');
        // Set isLoading to false ONLY after the initial load is complete
        if (isMounted.current) {
          console.log('SessionContextProvider: Initial load complete, setting isLoading to FALSE.');
          setIsLoading(false);
        }
      }
    });

    // Listen for auth state changes (these will update session/user but not toggle global isLoading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted.current) return;
      console.log('SessionContextProvider: onAuthStateChange: Event:', event, 'Session:', currentSession);
      // For subsequent events, we just update the session/user, not the global isLoading
      // The UI will react to changes in `user` and `session` directly.
      await updateSessionAndUser(currentSession, event);
    });

    // Listen for tab visibility changes to re-check session
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isMounted.current) {
        console.log('SessionContextProvider: Tab became visible, re-checking session...');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        await updateSessionAndUser(currentSession, 'TAB_FOCUS');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted.current = false;
      console.log('SessionContextProvider: Main useEffect cleanup, unsubscribing from auth state changes and visibilitychange.');
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updateSessionAndUser, navigate, location.pathname]);

  // Dedicated useEffect for redirection after login/signup
  useEffect(() => {
    console.log('Redirection useEffect: Current state - isLoading:', isLoading, 'user:', user ? `(ID: ${user.id}, Admin: ${user.is_admin}, Subscribed: ${user.has_active_subscription})` : 'null', 'pathname:', location.pathname);
    if (!isLoading && user && (location.pathname === '/login' || location.pathname === '/signup')) {
      console.log('Redirection triggered. User is_admin:', user.is_admin, 'User has_active_subscription:', user.has_active_subscription);
      if (user.is_admin) {
        navigate('/admin/dashboard');
      } else {
        navigate('/user/dashboard');
      }
    }
  }, [user, isLoading, navigate, location.pathname]);

  return (
    <SessionContext.Provider value={{ session, user, isLoading }}>
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