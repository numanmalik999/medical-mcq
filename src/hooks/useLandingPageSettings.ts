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
  { icon: "ShieldCheck", title: "Exam-Aligned Accuracy", description: "Our question bank is mapped to current DHA, MOH, and SCFHS blueprints to ensure you are studying the most relevant exam patterns." },
  { icon: "ClipboardCheck", title: "Simulated Mock Exams", description: "Prepare for your Prometric test with timed simulations that mirror the real DHA, HAAD, and SMLE testing interface." },
  { icon: "Youtube", title: "Video Explanations", description: "Access high-yield medical videos from Ninja Nerd and Osmosis, curated to help you master difficult DHA and MOH exam topics." },
  { icon: "BrainCircuit", title: "24/7 AI Medical Tutor", description: "Get instant clinical clarifications for your SMLE and HAAD study questions with our integrated AI assistant." },
  { icon: "Trophy", title: "Daily SMLE Challenge", description: "Answer our Question of the Day correctly to earn points toward free premium months for your Prometric exam preparation." },
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