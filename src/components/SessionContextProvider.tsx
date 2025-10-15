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
  hasCheckedInitialSession: boolean; // Flag to indicate if the initial check is complete
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hasCheckedInitialSession, setHasCheckedInitialSession] = useState(false); // New state
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
    let profileData = null;
    let profileError = null; // Initialize profileError to capture it

    try {
      console.log('[fetchUserProfile] Attempting Supabase profile select call...');
      const { data: profileDataArray, error: fetchError } = await supabase
        .from('profiles')
        .select('is_admin, first_name, last_name, phone_number, whatsapp_number, has_active_subscription, trial_taken')
        .eq('id', supabaseUser.id);
      
      profileError = fetchError; // Assign the error if any
      console.log('[fetchUserProfile] Supabase profile select call completed.');
      console.log('[fetchUserProfile] Supabase profile data:', profileDataArray);
      console.log('[fetchUserProfile] Supabase profile error:', profileError);

      if (profileError && profileError.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error(`[fetchUserProfile] ERROR: fetching profile (code: ${profileError.code}):`, profileError);
        // Don't re-throw, just log and proceed with default values
      } else if (profileDataArray && profileDataArray[0]) {
        profileData = profileDataArray[0];
      }
    } catch (e) {
      console.error(`[fetchUserProfile] UNEXPECTED EXCEPTION during Supabase profile fetch:`, e);
      // Ensure we still return a hydrated user even if fetch fails
    }
    
    console.log('[fetchUserProfile] Profile data processed:', profileData);
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
  // It only updates session/user and handles redirection for unauthenticated states.
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
        if (location.pathname !== '/login' && location.pathname !== '/signup') {
          console.log('[updateSessionAndUser] Navigating to /login due to no session.');
          navigate('/login');
        }
      } else {
        console.log('[updateSessionAndUser] Session exists, fetching user profile.');
        const authUser = await fetchUserProfile(currentSession.user);
        if (isMounted.current) {
          console.log('[updateSessionAndUser] Setting session and user states.');
          setSession(currentSession);
          setUser(authUser);
          console.log('[updateSessionAndUser] User and Session states updated.');
        } else {
          console.warn('[updateSessionAndUser] Component unmounted before setting session and user states.');
        }
      }
    } catch (error) {
      console.error("[updateSessionAndUser] ERROR: processing auth event:", error);
      setSession(null);
      setUser(null);
    }
  }, [navigate, location.pathname, fetchUserProfile]);

  // Main effect for setting up auth listener and initial session check
  useEffect(() => {
    isMounted.current = true;
    console.log('SessionContextProvider: Main useEffect mounted.');

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (isMounted.current) {
        console.log('SessionContextProvider: Initial Session Check Result:', initialSession);
        await updateSessionAndUser(initialSession, 'INITIAL_LOAD');
      }
    }).finally(() => { // Use finally to ensure hasCheckedInitialSession is set after the initial check
      if (isMounted.current) {
        console.log('SessionContextProvider: Initial load complete, setting hasCheckedInitialSession to TRUE.');
        setHasCheckedInitialSession(true);
      } else {
        console.warn('SessionContextProvider: Component unmounted before setting hasCheckedInitialSession in finally block.');
      }
    });

    // Listen for auth state changes (these will update session/user but not toggle global isLoading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted.current) {
        console.warn(`SessionContextProvider: onAuthStateChange: Skipping event ${event} - component unmounted.`);
        return;
      }
      console.log('SessionContextProvider: onAuthStateChange: Event:', event, 'Session:', currentSession);
      await updateSessionAndUser(currentSession, event);
    });

    // Listen for tab visibility changes to re-check session
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isMounted.current) {
        console.log('SessionContextProvider: Tab became visible, re-checking session...');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        await updateSessionAndUser(currentSession, 'TAB_FOCUS');
      } else if (!isMounted.current) {
        console.warn('SessionContextProvider: handleVisibilityChange: Skipping - component unmounted.');
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
    console.log('Redirection useEffect: Current state - hasCheckedInitialSession:', hasCheckedInitialSession, 'user:', user ? `(ID: ${user.id}, Admin: ${user.is_admin}, Subscribed: ${user.has_active_subscription})` : 'null', 'pathname:', location.pathname);
    if (hasCheckedInitialSession && user && (location.pathname === '/login' || location.pathname === '/signup')) {
      console.log('Redirection triggered. User is_admin:', user.is_admin, 'User has_active_subscription:', user.has_active_subscription);
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