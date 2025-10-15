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
    console.log(`[fetchUserProfile] User ID type: ${typeof supabaseUser.id}, value: ${supabaseUser.id}`);

    let profileData = null;
    let fetchError = null;

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn(`[fetchUserProfile] WARNING: Supabase profile fetch timed out after 1 second for user ID: ${supabaseUser.id}.`);
        resolve(null); // Resolve with null to indicate timeout
      }, 1000) // 1-second timeout
    );

    try {
      console.log('[fetchUserProfile] Attempting Supabase profile select call with 1-second timeout...');
      console.trace('[fetchUserProfile] Call stack before select');

      const { data: profileDataArray, error: selectError } = await Promise.race([
        supabase
          .from('profiles')
          .select('is_admin, first_name, last_name, phone_number, whatsapp_number, has_active_subscription, trial_taken')
          .eq('id', supabaseUser.id)
          .then(res => ({ data: res.data, error: res.error })), // Ensure consistent return type for Promise.race
        timeoutPromise.then(() => ({ data: null, error: { message: 'Profile fetch timed out', code: 'TIMEOUT' } }))
      ]);
      
      fetchError = selectError;
      console.log('[fetchUserProfile] Supabase profile select call completed (or timed out).');
      console.log('[fetchUserProfile] Supabase profile data:', profileDataArray);
      console.log('[fetchUserProfile] Supabase profile error:', fetchError);

      if (fetchError && fetchError.code !== 'PGRST116' && fetchError.code !== 'TIMEOUT') { // PGRST116 means no rows found
        console.error(`[fetchUserProfile] ERROR: fetching profile (code: ${fetchError.code}):`, fetchError);
      } else if (profileDataArray && profileDataArray[0]) {
        profileData = profileDataArray[0];
      }
    } catch (e: any) { // Catch any unexpected exceptions
      console.error(`[fetchUserProfile] UNEXPECTED EXCEPTION during Supabase profile fetch:`, e.message || e);
      // Assign a generic error if an unexpected exception occurs
      fetchError = { message: e.message || 'Unknown error during fetch', code: 'UNEXPECTED_EXCEPTION' }; 
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

    const performInitialSessionCheck = async () => {
      try {
        console.log('SessionContextProvider: Starting initial session fetch...');
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('SessionContextProvider: Error during initial getSession:', error);
          // Even if error, try to update session and user, then mark as checked
          await updateSessionAndUser(null, 'INITIAL_LOAD_ERROR');
        } else if (isMounted.current) {
          console.log('SessionContextProvider: Initial Session Check Result:', initialSession ? 'Session found' : 'No session');
          await updateSessionAndUser(initialSession, 'INITIAL_LOAD');
        }
      } catch (e) {
        console.error('SessionContextProvider: UNEXPECTED ERROR during initial session check:', e);
        // Ensure we still attempt to update state even on unexpected errors
        await updateSessionAndUser(null, 'INITIAL_LOAD_UNEXPECTED_ERROR');
      } finally {
        if (isMounted.current) {
          console.log('SessionContextProvider: Initial load process finished, setting hasCheckedInitialSession to TRUE.');
          setHasCheckedInitialSession(true);
        } else {
          console.warn('SessionContextProvider: Component unmounted before setting hasCheckedInitialSession in finally block of initial check.');
        }
      }
    };

    performInitialSessionCheck();

    // Listen for auth state changes (these will update session/user but not toggle global isLoading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted.current) {
        console.warn(`SessionContextProvider: onAuthStateChange: Skipping event ${event} - component unmounted.`);
        return;
      }
      console.log('SessionContextProvider: onAuthStateChange: Event:', event, 'Session:', currentSession ? 'present' : 'null');
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