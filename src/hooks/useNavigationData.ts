"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface NavLink {
  slug: string;
  title: string;
  location: string[];
}

// Global cache to persist across re-renders/navigation
let cachedLinks: NavLink[] | null = null;

export const useNavigationData = () => {
  const [links, setLinks] = useState<NavLink[]>(cachedLinks || []);
  const [isLoading, setIsLoading] = useState(!cachedLinks);

  useEffect(() => {
    if (cachedLinks) return;

    const fetchLinks = async () => {
      const { data, error } = await supabase
        .from('static_pages')
        .select('slug, title, location')
        .order('title', { ascending: true });

      if (!error && data) {
        cachedLinks = data as NavLink[];
        setLinks(cachedLinks);
      }
      setIsLoading(false);
    };

    fetchLinks();
  }, []);

  const headerLinks = links.filter(l => l.location?.includes('header'));
  const footerLinks = links.filter(l => l.location?.includes('footer'));

  return { headerLinks, footerLinks, isLoading };
};