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
      // If component unmounted during fetch, return a basic AuthUser to avoid null issues
      return {
        ...supabaseUser,
        is_admin: false,
        has_active_subscription: false,
        trial_taken: false,
      } as AuthUser;
    }
    console.log(`Fetching profile for user ID: ${supabaseUser.id}`);
    const { data: profileDataArray, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin, first_name, last_name, phone_number, whatsapp_number, has_active_subscription, trial_taken')
      .eq('id', supabaseUser.id);

    if (profileError && profileError.code !== 'PGRST116') {
      console.error(`Error fetching profile (code: ${profileError.code}):`, profileError);
      // Always return an AuthUser object, even on error, with defaults
      return {
        ...supabaseUser,
        is_admin: false,
        has_active_subscription: false,
        trial_taken: false,
      } as AuthUser;
    }

    const profileData = profileDataArray && profileDataArray.length > 0 ? profileDataArray[0] : null;
    console.log('Profile data fetched:', profileData);

    return {
      ...supabaseUser,
      is_admin: profileData?.is_admin || false,
      first_name: profileData?.first_name || null,
      last_name: profileData?.last_name || null,
      phone_number: profileData?.phone_number || null,
      whatsapp_number: profileData?.whatsapp_number || null,
      has_active_subscription: profileData?.has_active_subscription || false,
      trial_taken: profileData?.trial_taken || false,
    } as AuthUser;
  }, []); // No dependencies, as it only uses supabase and isMounted.current

  // Main effect for setting up auth listener and initial session check
  useEffect(() => {
    isMounted.current = true;
    console.log('SessionContextProvider: Main useEffect mounted.');

    const handleSessionAndProfile = async (currentSession: Session | null) => { // Removed 'event' parameter
      if (!isMounted.current) return;

      try {
        if (!currentSession) {
          console.log('No session, clearing user and session.');
          setSession(null);
          setUser(null);
          // Only navigate to login if not already on login/signup
          if (location.pathname !== '/login' && location.pathname !== '/signup') {
            navigate('/login');
          }
        } else {
          // Fetch user profile if session exists
          const authUser = await fetchUserProfile(currentSession.user);
          if (isMounted.current) {
            setSession(currentSession);
            setUser(authUser);
          }
        }
      } catch (error) {
        console.error("Error in handleSessionAndProfile:", error);
        // On error, ensure session and user are cleared
        setSession(null);
        setUser(null);
      } finally {
        if (isMounted.current) {
          setIsLoading(false); // Always set loading to false when done processing
        }
      }
    };

    // Initial session check
    setIsLoading(true); // Ensure loading is true for the very first check
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (isMounted.current) {
        console.log('Initial Session Check Result:', initialSession);
        await handleSessionAndProfile(initialSession); // Removed 'INITIAL_LOAD' event
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted.current) return;
      console.log('onAuthStateChange: Event:', event, 'Session:', currentSession);

      // For any auth state change, we re-evaluate the session and profile
      // Set loading to true temporarily while processing the change
      setIsLoading(true); 
      await handleSessionAndProfile(currentSession); // Removed 'event' parameter
    });

    return () => {
      isMounted.current = false;
      console.log('SessionContextProvider: Main useEffect cleanup, unsubscribing from auth state changes.');
      subscription.unsubscribe();
    };
  }, [navigate, location.pathname, fetchUserProfile]); // Removed 'user' from dependencies

  // Dedicated useEffect for redirection after login/signup
  useEffect(() => {
    if (!isLoading && user && (location.pathname === '/login' || location.pathname === '/signup')) {
      console.log('Redirecting after login/signup based on user role.');
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