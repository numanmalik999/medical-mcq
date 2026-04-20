import { useEffect } from "react";

interface UseSeoOptions {
  title: string;
  description: string;
  keywords?: string;
  canonicalPath?: string;
  robots?: string;
  ogType?: "website" | "article";
  ogImage?: string;
  twitterCard?: "summary" | "summary_large_image";
}

const SITE_URL = "https://www.studyprometric.com";
const DEFAULT_OG_IMAGE = `${SITE_URL}/social-preview.png`;

const upsertMetaTag = (selector: string, attr: "name" | "property", key: string, content: string) => {
  let tag = document.querySelector(selector) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
};

const upsertCanonical = (href: string) => {
  let link = document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
};

export const useSeo = ({
  title,
  description,
  keywords,
  canonicalPath,
  robots,
  ogType = "website",
  ogImage = DEFAULT_OG_IMAGE,
  twitterCard = "summary_large_image",
}: UseSeoOptions) => {
  useEffect(() => {
    const canonicalUrl = canonicalPath
      ? `${SITE_URL}${canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`}`
      : window.location.href;

    document.title = title;

    upsertMetaTag('meta[name="description"]', "name", "description", description);

    if (keywords && keywords.trim().length > 0) {
      upsertMetaTag('meta[name="keywords"]', "name", "keywords", keywords);
    }

    if (robots) {
      upsertMetaTag('meta[name="robots"]', "name", "robots", robots);
    }

    upsertCanonical(canonicalUrl);

    upsertMetaTag('meta[property="og:type"]', "property", "og:type", ogType);
    upsertMetaTag('meta[property="og:url"]', "property", "og:url", canonicalUrl);
    upsertMetaTag('meta[property="og:title"]', "property", "og:title", title);
    upsertMetaTag('meta[property="og:description"]', "property", "og:description", description);
    upsertMetaTag('meta[property="og:image"]', "property", "og:image", ogImage);

    upsertMetaTag('meta[property="twitter:card"]', "property", "twitter:card", twitterCard);
    upsertMetaTag('meta[property="twitter:url"]', "property", "twitter:url", canonicalUrl);
    upsertMetaTag('meta[property="twitter:title"]', "property", "twitter:title", title);
    upsertMetaTag('meta[property="twitter:description"]', "property", "twitter:description", description);
    upsertMetaTag('meta[property="twitter:image"]', "property", "twitter:image", ogImage);
  }, [title, description, keywords, canonicalPath, robots, ogType, ogImage, twitterCard]);
};
