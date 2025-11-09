"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface SocialLink {
  platform: string;
  url: string;
}

interface GlobalSettings {
  socialLinks: SocialLink[];
}

export const useGlobalSettings = () => {
  // Removed unused 'toast' variable
  useToast(); 
  const [settings, setSettings] = useState<GlobalSettings>({ socialLinks: [] });
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('global_settings')
        .select('key, value')
        .in('key', ['social_links']);

      if (error) throw error;

      const newSettings: GlobalSettings = { socialLinks: [] };

      data.forEach(setting => {
        if (setting.key === 'social_links' && Array.isArray(setting.value)) {
          newSettings.socialLinks = setting.value as SocialLink[];
        }
      });

      setSettings(newSettings);
    } catch (error: any) {
      console.error("Error fetching global settings:", error);
      // Do not show toast on every page load failure, just log
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, isLoading };
};