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

    if (shouldShowAds) {
      console.log("[AdSenseManager] Loading AdSense for non-subscribed user.");
      
      // Check if script already exists
      const existingScript = document.querySelector(`script[src*="pagead2.googlesyndication.com"]`);
      
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
        script.async = true;
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
      }
    } else {
      console.log("[AdSenseManager] User is subscribed. Removing AdSense.");
      
      // Remove the main script if it exists
      const existingScript = document.querySelector(`script[src*="pagead2.googlesyndication.com"]`);
      if (existingScript) {
        existingScript.remove();
      }
      
      // Hide any existing ad containers (Auto-ads injects divs and ins tags)
      const ads = document.querySelectorAll(".adsbygoogle, .google-auto-placed, ad-slot");
      ads.forEach(ad => (ad as HTMLElement).style.display = "none");
    }
  }, [user, hasCheckedInitialSession]);

  return null; // This component doesn't render anything visible
};

export default AdSenseManager;