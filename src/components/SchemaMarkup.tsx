"use client";

import { useEffect } from 'react';

const SchemaMarkup = () => {
  useEffect(() => {
    const siteUrl = "https://www.studyprometric.com";
    
    // 1. Organization & WebSite Schema
    const orgAndWebSiteSchema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${siteUrl}/#organization`,
          "name": "Study Prometric MCQs",
          "url": siteUrl,
          "logo": {
            "@type": "ImageObject",
            "url": `${siteUrl}/favicon.svg`,
            "width": "512",
            "height": "512"
          },
          "sameAs": [
            "https://facebook.com/studyprometric",
            "https://twitter.com/studyprometric"
          ]
        },
        {
          "@type": "WebSite",
          "@id": `${siteUrl}/#website`,
          "url": siteUrl,
          "name": "Study Prometric",
          "publisher": { "@id": `${siteUrl}/#organization` },
          "potentialAction": {
            "@type": "SearchAction",
            "target": `${siteUrl}/quiz?search={search_term_string}`,
            "query-input": "required name=search_term_string"
          }
        }
      ]
    };

    // 2. Site Navigation Schema
    const navigationSchema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "itemListElement": [
        {
          "@type": "SiteNavigationElement",
          "position": 1,
          "name": "Practice Quizzes",
          "url": `${siteUrl}/quiz`
        },
        {
          "@type": "Site-specific QOD",
          "position": 2,
          "name": "Question of the Day",
          "url": `${siteUrl}/quiz-of-the-day`
        },
        {
          "@type": "SiteNavigationElement",
          "position": 3,
          "name": "Medical Blog",
          "url": `${siteUrl}/blog`
        },
        {
          "@type": "SiteNavigationElement",
          "position": 4,
          "name": "Pricing Plans",
          "url": `${siteUrl}/subscription`
        },
        {
          "@type": "SiteNavigationElement",
          "position": 5,
          "name": "About Us",
          "url": `${siteUrl}/about`
        }
      ]
    };

    const injectScript = (id: string, data: object) => {
      let script = document.getElementById(id);
      if (!script) {
        script = document.createElement('script');
        script.id = id;
        script.setAttribute('type', 'application/ld+json');
        document.head.appendChild(script);
      }
      script.innerHTML = JSON.stringify(data);
    };

    injectScript('org-website-schema', orgAndWebSiteSchema);
    injectScript('navigation-schema', navigationSchema);

    return () => {
      document.getElementById('org-website-schema')?.remove();
      document.getElementById('navigation-schema')?.remove();
    };
  }, []);

  return null;
};

export default SchemaMarkup;