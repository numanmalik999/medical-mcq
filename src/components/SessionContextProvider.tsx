"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

// Extend the User type to include profile fields
interface AuthUser extends User {
  is_admin?: boolean;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  phone_number?: string | null;
  whatsapp_number?: string | null;
  has_active_subscription?: boolean; // Added
  trial_taken?: boolean; // Added
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
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('SessionContextProvider: useEffect mounted, initial isLoading:', isLoading);

    const handleAuthSession = async (currentSession: Session | null, isInitialCheck: boolean = false) => {
      setIsLoading(true);
      const logPrefix = isInitialCheck ? 'SessionContextProvider: Initial Session Check:' : 'SessionContextProvider: onAuthStateChange:';
      console.log(`${logPrefix} setIsLoading(true)`);

      if (!currentSession) {
        console.log(`${logPrefix} No session, clearing session and user.`);
        setSession(null);
        setUser(null);
        if (location.pathname !== '/login' && location.pathname !== '/signup') {
          navigate('/login');
        }
        setIsLoading(false);
        console.log(`${logPrefix} setIsLoading(false) for no session.`);
        return;
      }

      console.log(`${logPrefix} Session exists, attempting to fetch profile...`);
      console.log(`${logPrefix} User ID for profile fetch:`, currentSession.user.id);

      let profileFetchCompleted = false;
      const fetchTimeout = setTimeout(() => {
        if (!profileFetchCompleted) {
          console.warn(`${logPrefix} Profile fetch timed out after 5 seconds. Forcing isLoading to false.`);
          setIsLoading(false);
        }
      }, 5000); // 5-second timeout

      try {
        console.log(`${logPrefix} Executing Supabase profile query...`);
        const { data: profileDataArray, error: profileError } = await supabase
          .from('profiles')
          .select('is_admin, first_name, last_name, phone_number, whatsapp_number, has_active_subscription, trial_taken') // Added subscription and trial fields
          .eq('id', currentSession.user.id);

        profileFetchCompleted = true;
        clearTimeout(fetchTimeout);
        console.log(`${logPrefix} Supabase profile query completed.`);

        let isAdmin = false;
        let firstName = null;
        let lastName = null;
        let phoneNumber = null;
        let whatsappNumber = null;
        let hasActiveSubscription = false; // Default value
        let trialTaken = false; // Default value
        let profileData = null;

        if (profileError) {
          if (profileError.code !== 'PGRST116') { // PGRST116 means no rows found, which is not an error for new users
            console.error(`${logPrefix} Error fetching profile (code: ${profileError.code}):`, profileError);
          } else {
            console.log(`${logPrefix} No profile found for user (PGRST116), defaulting profile fields.`);
          }
        } else if (profileDataArray && profileDataArray.length > 0) {
          profileData = profileDataArray[0]; // Take the first profile if available
          isAdmin = profileData.is_admin || false;
          firstName = profileData.first_name || null;
          lastName = profileData.last_name || null;
          phoneNumber = profileData.phone_number || null;
          whatsappNumber = profileData.whatsapp_number || null;
          hasActiveSubscription = profileData.has_active_subscription || false;
          trialTaken = profileData.trial_taken || false;
          console.log(`${logPrefix} Profile data fetched:`, profileData);
        }
        
        const authUser: AuthUser = { 
          ...currentSession.user, 
          is_admin: isAdmin,
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber,
          whatsapp_number: whatsappNumber,
          has_active_subscription: hasActiveSubscription,
          trial_taken: trialTaken,
        };
        setSession(currentSession);
        setUser(authUser);
        console.log(`${logPrefix} Session and user set. User is_admin:`, authUser.is_admin, 'has_active_subscription:', authUser.has_active_subscription);

        if (location.pathname === '/login' || location.pathname === '/signup') {
          console.log(`${logPrefix} On /login or /signup page, redirecting...`);
          if (isAdmin) {
            navigate('/admin/dashboard');
          } else {
            navigate('/user/dashboard');
          }
        }
      } catch (err: any) {
        profileFetchCompleted = true;
        clearTimeout(fetchTimeout);
        console.error(`${logPrefix} Unhandled error during profile fetch:`, err);
        setSession(null);
        setUser(null);
        if (location.pathname !== '/login' && location.pathname !== '/signup') {
          navigate('/login');
        }
      } finally {
        console.log(`${logPrefix} Reaching finally block, setting isLoading to false.`);
        setIsLoading(false);
        console.log(`${logPrefix} setIsLoading(false) in finally block.`);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('SessionContextProvider: onAuthStateChange: Event:', event, 'Session:', currentSession);
      if (event === 'SIGNED_OUT') {
        console.log('SessionContextProvider: onAuthStateChange: SIGNED_OUT, clearing session and user, navigating to /login');
        setSession(null);
        setUser(null);
        navigate('/login');
        setIsLoading(false);
        console.log('SessionContextProvider: onAuthStateChange: setIsLoading(false) after SIGNED_OUT');
      } else {
        handleAuthSession(currentSession);
      }
    });

    // Initial session check
    console.log('SessionContextProvider: Performing initial session check...');
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      console.log('SessionContextProvider: Initial Session Check Result:', initialSession);
      handleAuthSession(initialSession, true);
    });

    return () => {
      console.log('SessionContextProvider: useEffect cleanup, unsubscribing from auth state changes.');
      subscription.unsubscribe();
    };
  }, [navigate]);

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