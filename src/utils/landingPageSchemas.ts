import * as z from 'zod';

export const seoMetadataSchema = z.object({
  metaTitle: z.string().min(1, "Meta Title is required."),
  metaDescription: z.string().min(1, "Meta Description is required."),
  keywords: z.string().optional().or(z.literal('')),
});

export const heroSectionSchema = z.object({
  mainTitle: z.string().min(1, "Main Title is required."),
  subtitle: z.string().min(1, "Subtitle is required."),
  ctaPrimaryText: z.string().min(1, "Primary CTA text is required."),
  ctaSecondaryText: z.string().min(1, "Secondary CTA text is required."),
  ctaQodText: z.string().min(1, "QOD CTA text is required."), // Added this field
});

export const featureItemSchema = z.object({
  title: z.string().min(1, "Feature title is required."),
  description: z.string().min(1, "Feature description is required."),
  icon: z.string().min(1, "Lucide icon name is required (e.g., BookOpenText)."),
});

export const featuresSectionSchema = z.array(featureItemSchema);

export const pricingCtaSchema = z.object({
  title: z.string().min(1, "Pricing title is required."),
  subtitle: z.string().min(1, "Pricing subtitle is required."),
});

export type SeoMetadata = z.infer<typeof seoMetadataSchema>;
export type HeroSection = z.infer<typeof heroSectionSchema>;
export type FeatureItem = z.infer<typeof featureItemSchema>;
export type PricingCta = z.infer<typeof pricingCtaSchema>;