"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
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

// Default values
const defaultSeo: SeoMetadata = {
  metaTitle: "Prometric Exam Preparation for Gulf Countries | StudyPrometric – Online MCQs & Practice Tests",
  metaDescription: "Prepare for Prometric exams for Saudi Arabia, UAE, Qatar, Oman, Kuwait & Bahrain. Thousands of updated MCQs for doctors, nurses, and medical professionals. Start your free trial today!",
  keywords: "Prometric exam, Prometric exam preparation, DHA MOH HAAD exam questions, Gulf medical exam, SMLE MCQs, QCHP exam, OMSB exam, online Prometric test, Prometric practice test.",
};

const defaultHero: HeroSection = {
  mainTitle: "Master Your Medical Exams",
  subtitle: "Your ultimate platform for interactive quizzes, simulated tests, and AI-powered explanations to ace your Prometric MCQs.",
  ctaPrimaryText: "Get Started",
  ctaSecondaryText: "Take a Free Quiz",
};

const defaultFeatures: FeatureItem[] = [
  { icon: "Stethoscope", title: "AI Clinical Cases", description: "Immerse yourself in complex patient scenarios with multi-step interactive clinical cases designed to test your diagnostic logic." },
  { icon: "ShieldCheck", title: "Verified Accuracy", description: "Our content is continuously audited by clinical AI to ensure 100% accuracy, clarity, and relevance to the latest exam standards." },
  { icon: "ClipboardCheck", title: "Simulated Tests", description: "Prepare with timed, customizable tests. Configure question count, difficulty, and time limits to mirror real exam conditions." },
  { icon: "Youtube", title: "Curated Video Library", description: "Access a hand-picked selection of high-yield medical videos from Ninja Nerd, Osmosis, and more, all mapped to specific topics." },
  { icon: "BrainCircuit", title: "AI Medical Assistant", description: "Get instant answers to your clinical queries with our integrated AI chatbot, available 24/7 to support your learning journey." },
  { icon: "Trophy", title: "Daily Challenge", description: "Compete in our Question of the Day leaderboard. Earn points for correct answers and win free premium subscription months!" },
];

const defaultPricingCta: PricingCta = {
  title: "Pricing Plans",
  subtitle: "Choose the plan that fits your study schedule and unlock premium features instantly.",
};


interface LandingPageSettings {
  seo: SeoMetadata;
  hero: HeroSection;
  features: FeatureItem[];
  pricingCta: PricingCta;
}

export const useLandingPageSettings = () => {
  const { toast } = useToast();
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
              newSettings.hero = heroSectionSchema.parse(setting.value);
              break;
            case 'landing_page_features':
              newSettings.features = featuresSectionSchema.parse(setting.value);
              break;
            case 'landing_page_pricing_cta':
              newSettings.pricingCta = pricingCtaSchema.parse(setting.value);
              break;
          }
        } catch (e) {
          console.error(`Validation failed for setting key ${setting.key}:`, e);
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
      toast({ title: "Error", description: "Failed to load dynamic landing page content.", variant: "destructive" });
      setSettings({
        seo: defaultSeo,
        hero: defaultHero,
        features: defaultFeatures,
        pricingCta: defaultPricingCta,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, isLoading };
};