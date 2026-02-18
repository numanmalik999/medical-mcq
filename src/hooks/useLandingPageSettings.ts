"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  SeoMetadata,
  HeroSection,
  FeatureItem,
  PricingCta,
  seoMetadataSchema,
  heroSectionSchema,
  featuresSectionSchema,
  pricingCtaSchema,
} from '@/utils/landingPageSchemas';

// Default values synced with target keywords
const defaultSeo: SeoMetadata = {
  metaTitle: "Prometric Exam Preparation for Gulf | DHA, MOH, HAAD, SMLE, OMSB & QCHP MCQs",
  metaDescription: "Master your Gulf licensing with Study Prometric. Access thousands of DHA exam questions, SMLE MCQs, and MOH practice tests for doctors and nurses. Pass HAAD, OMSB, and QCHP today!",
  keywords: "Prometric exam preparation, DHA exam questions, SMLE MCQs, MOH exam, HAAD exam prep, Gulf medical exam, online Prometric test, Prometric practice test, Saudi medical licensing, DHA Dubai exam.",
};

const defaultHero: HeroSection = {
  mainTitle: "Ace Your Prometric & Gulf Medical Licensing Exams",
  subtitle: "The #1 platform for DHA, SMLE, MOH, and HAAD preparation. Master high-yield MCQs with AI-powered clinical explanations and simulated practice tests.",
  ctaPrimaryText: "Start Preparation",
  ctaSecondaryText: "Free DHA & SMLE Quiz",
  ctaQodText: "Question of the Day",
};

const defaultFeatures: FeatureItem[] = [
  { icon: "Stethoscope", title: "AI Clinical Cases", description: "Immerse yourself in complex patient scenarios for DHA and SMLE with interactive clinical cases designed to test your diagnostic logic." },
  { icon: "CalendarCheck", title: "AI Study Planner", description: "Receive a personalized daily study roadmap based on your exam date, ensuring you cover every high-yield specialty before your test." },
  { icon: "Zap", title: "Memory Master (SRS)", description: "Master clinical pearls using our Spaced Repetition flashcard system (Anki-style), designed for maximum long-term retention of exam facts." },
  { icon: "ClipboardCheck", title: "Simulated Mock Exams", description: "Prepare for your Prometric test with timed simulations that mirror the real DHA, HAAD, and SMLE testing interface." },
  { icon: "ShieldCheck", title: "Pass Prediction", description: "Track your readiness with advanced analytics. Our engine predicts your pass probability based on real-time performance data." },
  { icon: "Youtube", title: "Expert Video Library", description: "Access high-yield medical masterclasses from curated sources, all mapped to specific topics in your licensing curriculum." },
];

const defaultPricingCta: PricingCta = {
  title: "Specialty Access Plans",
  subtitle: "Choose the right plan to unlock full access to DHA, MOH, HAAD, and SMLE question banks.",
};

interface LandingPageSettings {
  seo: SeoMetadata;
  hero: HeroSection;
  features: FeatureItem[];
  pricingCta: PricingCta;
}

export const useLandingPageSettings = () => {
  const [settings, setSettings] = useState<LandingPageSettings>({
    seo: defaultSeo,
    hero: defaultHero,
    features: defaultFeatures,
    pricingCta: defaultPricingCta,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('global_settings')
        .select('key, value')
        .in('key', ['seo_metadata', 'landing_page_hero', 'landing_page_features', 'landing_page_pricing_cta']);

      if (error) throw error;

      const newSettings: Partial<LandingPageSettings> = {};

      data.forEach(setting => {
        try {
          switch (setting.key) {
            case 'seo_metadata':
              newSettings.seo = seoMetadataSchema.parse(setting.value);
              break;
            case 'landing_page_hero':
              const val = setting.value as any;
              if (!val.ctaQodText) val.ctaQodText = defaultHero.ctaQodText;
              newSettings.hero = heroSectionSchema.parse(val);
              break;
            case 'landing_page_features':
              newSettings.features = featuresSectionSchema.parse(setting.value);
              break;
            case 'landing_page_pricing_cta':
              newSettings.pricingCta = pricingCtaSchema.parse(setting.value);
              break;
          }
        } catch (e) {
          console.error(`Validation failed for setting key \${setting.key}:`, e);
        }
      });

      setSettings({
        seo: newSettings.seo || defaultSeo,
        hero: newSettings.hero || defaultHero,
        features: newSettings.features || defaultFeatures,
        pricingCta: newSettings.pricingCta || defaultPricingCta,
      });

    } catch (error: any) {
      console.error("Error fetching landing page settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, isLoading };
};