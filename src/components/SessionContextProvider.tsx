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

interface DbQuizSession {
  id: string;
  user_id: string;
  category_id: string | null;
  mcq_ids_order: string[]; // Array of MCQ IDs
  current_question_index: number;
  user_answers_json: { [mcqId: string]: any }; // JSONB object
  is_trial_session: boolean;
  test_duration_seconds: number | null;
  remaining_time_seconds: number | null;
  skipped_mcq_ids: string[] | null;
  created_at: string;
  updated_at: string;
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
  const [hasCheckedInitialSession, setHasCheckedInitialSession] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isMounted = useRef(true);
  const lastFetchedUserId = useRef<string | null>(null); // To track the last user whose profile was fetched

  // Memoized function to fetch a single user profile from the database
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
    let fetchError = null;

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn(`[fetchUserProfile] WARNING: Supabase profile fetch timed out after 5 seconds for user ID: ${supabaseUser.id}.`);
        resolve(null);
      }, 5000)
    );

    try {
      const { data: profileDataArray, error: selectError } = await Promise.race([
        supabase
          .from('profiles')
          .select('is_admin, first_name, last_name, phone_number, whatsapp_number, has_active_subscription, trial_taken')
          .eq('id', supabaseUser.id)
          .then(res => ({ data: res.data, error: res.error })),
        timeoutPromise.then(() => ({ data: null, error: { message: 'Profile fetch timed out', code: 'TIMEOUT' } }))
      ]);
      
      fetchError = selectError;
      if (fetchError && fetchError.code !== 'PGRST116' && fetchError.code !== 'TIMEOUT') {
        console.error(`[fetchUserProfile] ERROR: fetching profile (code: ${fetchError.code}):`, fetchError);
      } else if (profileDataArray && profileDataArray[0]) {
        profileData = profileDataArray[0];
      }
    } catch (e: any) {
      console.error(`[fetchUserProfile] UNEXPECTED EXCEPTION during Supabase profile fetch:`, e.message || e);
      fetchError = { message: e.message || 'Unknown error during fetch', code: 'UNEXPECTED_EXCEPTION' }; 
    }
    
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

    if (!currentSession) {
      console.log('[updateSessionAndUser] No session, clearing user and session states.');
      setSession(null);
      setUser(null);
      lastFetchedUserId.current = null; // Clear last fetched user on logout
    } else {
      let hydratedUser: AuthUser | null = null;

      // Condition to decide if we need to fetch profile from DB
      // We fetch if:
      // 1. There's no user object in our local state yet (first time loading for this session or after logout).
      // 2. The user ID in the current session is different from the user ID in our local state.
      // 3. The event explicitly indicates a user profile update.
      // We *do not* fetch from DB for 'SIGNED_IN', 'TOKEN_REFRESHED', or 'INITIAL_SESSION'
      // if the user is already in state and their ID matches.
      const needsDbProfileFetch = 
        !user || // No user in state (first load or after logout)
        user.id !== currentSession.user.id || // Different user logged in
        event === 'USER_UPDATED'; // Explicit user profile update

      if (needsDbProfileFetch) {
        console.log(`[updateSessionAndUser] Fetching profile for user ID: ${currentSession.user.id} due to event: ${event}`);
        hydratedUser = await fetchUserProfile(currentSession.user);
        lastFetchedUserId.current = currentSession.user.id; // Mark as fetched
      } else {
        console.log(`[updateSessionAndUser] Reusing existing profile for user ID: ${currentSession.user.id} (event: ${event}).`);
        // If we don't need to fetch from DB, use the current user state
        hydratedUser = user; // Reuse the existing user object
      }

      if (isMounted.current) {
        setSession(currentSession);
        setUser(hydratedUser); // Set the hydrated or reused user
        console.log('[updateSessionAndUser] User and Session states updated.');
      } else {
        console.warn('[updateSessionAndUser] Component unmounted before setting session and user states.');
      }
    }
  }, [fetchUserProfile, user]); // 'user' dependency is still important for '!user' and 'user.id !== currentSession.user.id'

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
          await updateSessionAndUser(null, 'INITIAL_LOAD_ERROR');
        } else if (isMounted.current) {
          console.log('SessionContextProvider: Initial Session Check Result:', initialSession ? 'Session found' : 'No session');
          await updateSessionAndUser(initialSession, 'INITIAL_LOAD');
        }
      } catch (e) {
        console.error('SessionContextProvider: UNEXPECTED ERROR during initial session check:', e);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted.current) {
        console.warn(`SessionContextProvider: onAuthStateChange: Skipping event ${event} - component unmounted.`);
        return;
      }
      console.log('SessionContextProvider: onAuthStateChange: Event:', event, 'Session:', currentSession ? 'present' : 'null');
      await updateSessionAndUser(currentSession, event);
    });

    return () => {
      isMounted.current = false;
      console.log('SessionContextProvider: Main useEffect cleanup, unsubscribing from auth state changes.');
      subscription.unsubscribe();
    };
  }, [updateSessionAndUser]);

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