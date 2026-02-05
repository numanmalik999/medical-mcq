"use client";

import { useEffect } from 'react';
import { useSession } from './SessionContextProvider';

const ADSENSE_CLIENT_ID = "ca-pub-9671540145726670";

const AdSenseManager = () => {
  const { user, hasCheckedInitialSession } = useSession();

  useEffect(() => {
    if (!hasCheckedInitialSession) return;

    // Check if user is NOT subscribed
    const shouldShowAds = !user || !user.has_active_subscription;

    const timer = setTimeout(() => {
        if (shouldShowAds) {
            console.log("[AdSenseManager] Loading AdSense script.");
            const existingScript = document.querySelector(`script[src*="pagead2.googlesyndication.com"]`);
            if (!existingScript) {
                const script = document.createElement("script");
                script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
                script.async = true;
                script.crossOrigin = "anonymous";
                document.head.appendChild(script);
            }
        } else {
            console.log("[AdSenseManager] Subscribed user. Removing AdSense artifacts.");
            const script = document.querySelector(`script[src*="pagead2.googlesyndication.com"]`);
            if (script) script.remove();
            
            const ads = document.querySelectorAll(".adsbygoogle, .google-auto-placed, ad-slot");
            ads.forEach(ad => (ad as HTMLElement).style.display = "none");
        }
    }, 1000); // 1-second delay to prioritize main content

    return () => clearTimeout(timer);
  }, [user?.has_active_subscription, hasCheckedInitialSession]);

  return null;
};

export default AdSenseManager;