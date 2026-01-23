"use client";

import { MadeWithDyad } from '@/components/made-with-dyad';
import EditLandingPageSection from '@/components/EditLandingPageSection';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';
import {
  seoMetadataSchema,
  heroSectionSchema,
  featuresSectionSchema,
  pricingCtaSchema,
} from '@/utils/landingPageSchemas';
import * as z from 'zod';

// --- Default Values matching new design ---

const defaultSeo: z.infer<typeof seoMetadataSchema> = {
  metaTitle: "Prometric Exam Preparation for Gulf Countries | StudyPrometric – Online MCQs & Practice Tests",
  metaDescription: "Prepare for Prometric exams for Saudi Arabia, UAE, Qatar, Oman, Kuwait & Bahrain. Thousands of updated MCQs for doctors, nurses, and medical professionals. Start your free trial today!",
  keywords: "Prometric exam, Prometric exam preparation, DHA MOH HAAD exam questions, Gulf medical exam, SMLE MCQs, QCHP exam, OMSB exam, online Prometric test, Prometric practice test.",
};

const defaultHero: z.infer<typeof heroSectionSchema> = {
  mainTitle: "Master Your Medical Exams",
  subtitle: "Your ultimate platform for interactive quizzes, simulated tests, and AI-powered explanations to ace your Prometric MCQs.",
  ctaPrimaryText: "Get Started",
  ctaSecondaryText: "Take a Free Quiz",
  ctaQodText: "Question of the Day",
};

const defaultFeatures: z.infer<typeof featuresSectionSchema> = [
  { icon: "Stethoscope", title: "AI Clinical Cases", description: "Immerse yourself in complex patient scenarios with multi-step interactive clinical cases designed to test your diagnostic logic." },
  { icon: "ShieldCheck", title: "Verified Accuracy", description: "Our content is continuously audited by clinical AI to ensure 100% accuracy, clarity, and relevance to the latest exam standards." },
  { icon: "ClipboardCheck", title: "Simulated Tests", description: "Prepare with timed, customizable tests. Configure question count, difficulty, and time limits to mirror real exam conditions." },
  { icon: "Youtube", title: "Curated Video Library", description: "Access a hand-picked selection of high-yield medical videos from Ninja Nerd, Osmosis, and more, all mapped to specific topics." },
  { icon: "BrainCircuit", title: "AI Medical Assistant", description: "Get instant answers to your clinical queries with our integrated AI chatbot, available 24/7 to support your learning journey." },
  { icon: "Trophy", title: "Daily Challenge", description: "Compete in our Question of the Day leaderboard. Earn points for correct answers and win free premium subscription months!" },
];

const defaultPricingCta: z.infer<typeof pricingCtaSchema> = {
  title: "Pricing Plans",
  subtitle: "Choose the plan that fits your study schedule and unlock premium features instantly.",
};

const ManageLandingPage = () => {
  // Need a wrapper schema for the features list to use useFieldArray
  const featuresWrapperSchema = z.object({
    links: featuresSectionSchema,
  });

  // --- SEO Metadata Form ---
  const renderSeoForm = (form: UseFormReturn<z.infer<typeof seoMetadataSchema>>) => (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="metaTitle"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Meta Title</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="metaDescription"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Meta Description</FormLabel>
            <FormControl><Textarea rows={3} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="keywords"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Keywords (Comma-separated)</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  // --- Hero Section Form ---
  const renderHeroForm = (form: UseFormReturn<z.infer<typeof heroSectionSchema>>) => (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="mainTitle"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Main Title (H1)</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="subtitle"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Subtitle</FormLabel>
            <FormControl><Textarea rows={2} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="ctaPrimaryText"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Primary CTA Button Text</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="ctaSecondaryText"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Secondary CTA Button Text</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="ctaQodText"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Question of the Day Button Text</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  // --- Features Section Form (List) ---
  const renderFeaturesForm = (form: UseFormReturn<z.infer<typeof featuresWrapperSchema>>, index?: number) => (
    <div className="space-y-3">
      <h4 className="font-semibold">Feature #{index !== undefined ? index + 1 : 'New'}</h4>
      <FormField
        control={form.control}
        name={`links.${index!}.icon` as const}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Icon Name (Lucide)</FormLabel>
            <FormControl><Input placeholder="e.g., BookOpenText" {...field} value={field.value as string} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`links.${index!}.title` as const}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl><Input {...field} value={field.value as string} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`links.${index!}.description` as const}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl><Textarea rows={3} {...field} value={field.value as string} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  // --- Pricing CTA Form ---
  const renderPricingCtaForm = (form: UseFormReturn<z.infer<typeof pricingCtaSchema>>) => (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Pricing Section Title</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="subtitle"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Pricing Section Subtitle</FormLabel>
            <FormControl><Textarea rows={2} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Manage Landing Page Content</h1>
      <p className="text-muted-foreground">Edit the dynamic sections of your homepage.</p>

      <EditLandingPageSection
        settingKey="seo_metadata"
        title="SEO Metadata"
        description="Configure the meta title, description, and keywords for the homepage."
        schema={seoMetadataSchema}
        defaultValues={defaultSeo}
      >
        {renderSeoForm}
      </EditLandingPageSection>

      <EditLandingPageSection
        settingKey="landing_page_hero"
        title="Hero Section"
        description="Edit the main title, subtitle, and call-to-action text."
        schema={heroSectionSchema}
        defaultValues={defaultHero}
      >
        {renderHeroForm}
      </EditLandingPageSection>

      <EditLandingPageSection
        settingKey="landing_page_features"
        title="Features Section"
        description="Manage the list of features displayed in the 'Why Choose Us?' section."
        schema={featuresWrapperSchema}
        defaultValues={{ links: defaultFeatures }}
        isList={true}
      >
        {renderFeaturesForm}
      </EditLandingPageSection>

      <EditLandingPageSection
        settingKey="landing_page_pricing_cta"
        title="Pricing CTA Section"
        description="Edit the title and subtitle above the subscription tiers."
        schema={pricingCtaSchema}
        defaultValues={defaultPricingCta}
      >
        {renderPricingCtaForm}
      </EditLandingPageSection>

      <MadeWithDyad />
    </div>
  );
};

export default ManageLandingPage;