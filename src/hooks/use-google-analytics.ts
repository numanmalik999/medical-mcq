"use client";

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

export function useGoogleAnalytics() {
  const location = useLocation();
  const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

  useEffect(() => {
    if (gaMeasurementId && typeof window.gtag === 'function') {
      window.gtag('config', gaMeasurementId, {
        page_path: location.pathname + location.search,
      });
      console.log('GA Page View:', location.pathname + location.search);
    }
  }, [location, gaMeasurementId]);
}