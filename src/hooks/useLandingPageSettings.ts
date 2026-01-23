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
  ctaQodText: "Question of the Day", // Default value
};

const defaultFeatures: FeatureItem[] = [
  { icon: "BookOpen", title: "Interactive Quizzes", description: "Engage with dynamic questions that provide instant feedback and adapt to your learning pace." },
  { icon: "Map", title: "Structured Learning Path", description: "Follow a logically organized curriculum that takes you from foundational concepts to clinical mastery." },
  { icon: "BrainCircuit", title: "AI-Powered Explanations", description: "Get deep clinical insights and reasoning for every answer choice, powered by advanced medical AI." },
  { icon: "Bookmark", title: "Bookmark & Review", description: "Save challenging questions and create your own personalized revision lists for focused study sessions." },
  { icon: "BarChart", title: "Personalized Learning", description: "Track your progress with detailed analytics that highlight your strengths and identify areas for improvement." },
  { icon: "FilePlus", title: "Submit Your Own MCQs", description: "Contribute to the medical community by sharing your own high-yield questions and explanations." },
  { icon: "ShieldCheck", title: "Secure & Reliable", description: "Your study progress and data are protected by industry-standard security and cloud-sync technology." },
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
              // Handle case where ctaQodText might be missing in existing DB settings
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