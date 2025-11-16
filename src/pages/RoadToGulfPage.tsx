"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';

const defaultContent = `
# Your Road to Practicing in the Gulf

Navigating the requirements for medical practice in the Gulf countries can be complex. This guide provides a clear overview of the DataFlow verification process and the specific licensing exams for each major Gulf country.

---

## 1. Primary Source Verification (PSV) by DataFlow Group

Primary Source Verification (PSV) is a mandatory process for all healthcare professionals seeking to practice in the Gulf region. The DataFlow Group is the designated body that verifies your credentials directly from the issuing source (e.g., your university, previous employers).

**What is verified?**
- **Educational Qualifications:** Degrees, Diplomas.
- **Work Experience:** Certificates of employment.
- **Professional Licenses:** Your home country's medical license.
- **Good Standing Certificate:** A certificate from your home medical council.

**The Process:**
1.  **Create an Account:** Register on the DataFlow portal for the specific country's health authority.
2.  **Submit Documents:** Upload clear scans of all required documents.
3.  **Payment:** Pay the verification fees online.
4.  **Verification:** DataFlow contacts the issuing authorities to verify your documents. This can take several weeks to months.
5.  **Report:** Once completed, a PSV report is generated and sent to you and the relevant health authority.

**Tip:** Start your DataFlow application as early as possible, as it is often the most time-consuming part of the licensing process.

---

## 2. Country-Specific Licensing Exams

After or during your PSV, you must pass the country-specific licensing exam.

### 🇦🇪 United Arab Emirates (UAE)

The UAE has three different health authorities depending on the emirate you wish to work in:
- **DHA (Dubai Health Authority):** For practicing in Dubai.
- **MOHAP (Ministry of Health and Prevention):** For practicing in Sharjah, Ajman, Umm Al Quwain, Ras Al Khaimah, and Fujairah.
- **DOH / HAAD (Department of Health - Abu Dhabi):** For practicing in Abu Dhabi.

**Exam Format:** All are computer-based tests (CBT) consisting of multiple-choice questions.
**Key Focus:** General medical knowledge, clinical scenarios, and specialty-specific questions.
**Note:** Passing one authority's exam may allow for license transfer to another, but specific rules apply.

### 🇸🇦 Saudi Arabia

**Authority:** Saudi Commission for Health Specialties (SCFHS).
**Exam:** Saudi Medical Licensing Exam (SMLE).

**Exam Format:** A computer-based test with MCQs.
**Key Focus:** The exam is comprehensive and covers a broad range of medical topics. It is known for its clinical-vignette style questions.
**Process:** You must first register with the SCFHS Mumaris Plus system before you can book your exam.

### 🇶🇦 Qatar

**Authority:** Department of Healthcare Professions (DHP) under the Ministry of Public Health (MOPH), formerly QCHP.
**Exam:** Qatar Prometric Exam.

**Exam Format:** A computer-based MCQ exam administered by Prometric.
**Key Focus:** Varies by specialty but generally covers foundational and clinical knowledge relevant to your field.
**Process:** You need to create an account on the DHP e-licensing system and complete the initial credentialing before being eligible for the exam.

### 🇴🇲 Oman

**Authority:** Oman Medical Specialty Board (OMSB).
**Exam:** Oman Prometric Exam.

**Exam Format:** Computer-based MCQ exam.
**Key Focus:** The exam tests the knowledge and skills required for your specific specialty.
**Process:** Similar to other countries, you must apply through the OMSB portal and complete credentialing and PSV.

### 🇰🇼 Kuwait

**Authority:** Ministry of Health (MOH).
**Exam:** Kuwait Medical Licensing Examination (KMLE).

**Exam Format:** Typically a written or computer-based MCQ exam.
**Key Focus:** General medicine and specialty-specific knowledge.
**Process:** The process is managed by the MOH, and requirements can be specific. It's essential to check the latest guidelines on their official website.

### 🇧🇭 Bahrain

**Authority:** National Health Regulatory Authority (NHRA).
**Exam:** Bahrain Licensure Examination.

**Exam Format:** Computer-based MCQ exam.
**Key Focus:** Assesses the candidate's competency in their chosen specialty.
**Process:** Application is done through the NHRA portal, followed by credential verification and the exam.
`;

const RoadToGulfPage = () => {
  const { toast } = useToast();
  const [pageContent, setPageContent] = useState(defaultContent);
  const [pageTitle, setPageTitle] = useState("Road to Gulf");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPageContent = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('static_pages')
        .select('title, content')
        .eq('slug', 'road-to-gulf')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching Road to Gulf page content:', error);
        toast({ title: "Error", description: "Failed to load page content.", variant: "destructive" });
      } else if (data) {
        setPageTitle(data.title);
        setPageContent(data.content || defaultContent);
      }
      setIsLoading(false);
    };

    fetchPageContent();
  }, [toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16 pb-12">
        <p className="text-gray-700 dark:text-gray-300">Loading content...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16 pb-12">
      <Card className="w-full max-w-6xl">
        <CardHeader>
          <CardTitle className="text-3xl text-center">{pageTitle}</CardTitle>
          <CardDescription className="text-center mt-2">
            A guide to DataFlow verification and licensing exams for Gulf countries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 prose dark:prose-invert max-w-none">
          <ReactMarkdown>{pageContent}</ReactMarkdown>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default RoadToGulfPage;