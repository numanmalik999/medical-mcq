"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EditStaticPageDialog, { StaticPage } from '@/components/EditStaticPageDialog';
import { useSession } from '@/components/SessionContextProvider';
import { Badge } from '@/components/ui/badge';
import SocialMediaSettingsCard from '@/components/SocialMediaSettingsCard';
import { cn } from '@/lib/utils';

const roadToGulfContent = `
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

After or during your PSV, you must pass the country-specific licensing exam. Below is a breakdown for each country.

### 🇦🇪 United Arab Emirates (UAE)

To practice in the UAE, you must obtain a license from one of three different health authorities, depending on the emirate:
- **DHA (Dubai Health Authority):** For practicing in Dubai.
- **MOHAP (Ministry of Health and Prevention):** For practicing in Sharjah, Ajman, Umm Al Quwain, Ras Al Khaimah, and Fujairah.
- **DOH / HAAD (Department of Health - Abu Dhabi):** For practicing in Abu Dhabi.

**Exam Format:** All are computer-based tests (CBT) consisting of multiple-choice questions.
**Key Focus:** General medical knowledge, clinical scenarios, and specialty-specific questions.
**Note:** Passing one authority's exam may allow for license transfer to another, but specific rules apply.

### 🇸🇦 Saudi Arabia

The licensing body in Saudi Arabia is the Saudi Commission for Health Specialties (SCFHS).
**Authority:** Saudi Commission for Health Specialties (SCFHS).
**Exam:** Saudi Medical Licensing Exam (SMLE).

**Exam Format:** A computer-based test with MCQs.
**Key Focus:** The exam is comprehensive and covers a broad range of medical topics. It is known for its clinical-vignette style questions.
**Process:** You must first register with the SCFHS Mumaris Plus system before you can book your exam.

### 🇶🇦 Qatar

In Qatar, the process is managed by the Department of Healthcare Professions (DHP).
**Authority:** Department of Healthcare Professions (DHP) under the Ministry of Public Health (MOPH), formerly QCHP.
**Exam:** Qatar Prometric Exam.

**Exam Format:** A computer-based MCQ exam administered by Prometric.
**Key Focus:** Varies by specialty but generally covers foundational and clinical knowledge relevant to your field.
**Process:** You need to create an account on the DHP e-licensing system and complete the initial credentialing before being eligible for the exam.

### 🇴🇲 Oman

The Oman Medical Specialty Board (OMSB) oversees the licensing process in Oman.
**Authority:** Oman Medical Specialty Board (OMSB).
**Exam:** Oman Prometric Exam.

**Exam Format:** Computer-based MCQ exam.
**Key Focus:** The exam tests the knowledge and skills required for your specific specialty.
**Process:** Similar to other countries, you must apply through the OMSB portal and complete credentialing and PSV.

### 🇰🇼 Kuwait

The Ministry of Health (MOH) is responsible for licensing in Kuwait.
**Authority:** Ministry of Health (MOH).
**Exam:** Kuwait Medical Licensing Examination (KMLE).

**Exam Format:** Typically a written or computer-based MCQ exam.
**Key Focus:** General medicine and specialty-specific knowledge.
**Process:** The process is managed by the MOH, and requirements can be specific. It's essential to check the latest guidelines on their official website.

### 🇧🇭 Bahrain

In Bahrain, the National Health Regulatory Authority (NHRA) is the governing body.
**Authority:** National Health Regulatory Authority (NHRA).
**Exam:** Bahrain Licensure Examination.

**Exam Format:** Computer-based MCQ exam.
**Key Focus:** Assesses the candidate's competency in their chosen specialty.
**Process:** Application is done through the NHRA portal, followed by credential verification and the exam.

---

**Disclaimer:** Licensing requirements and processes can change. Always refer to the official websites of the respective health authorities for the most up-to-date information.
`;

const defaultPages = [
  { slug: 'about', title: 'About Us', content: '# About Study Prometric MCQs...', location: ['footer'] },
  { slug: 'contact', title: 'Contact Us', content: '# Contact Us...', location: ['footer'] },
  { slug: 'privacy', title: 'Privacy Policy', content: '# Privacy Policy...', location: ['footer'] },
  { slug: 'terms', title: 'Terms of Service', content: '# Terms of Service...', location: ['footer'] },
  { slug: 'faq', title: 'FAQ', content: '# Frequently Asked Questions...', location: ['footer'] },
  { slug: 'refund', title: 'Return & Refund Policy', content: '# Return and Refund Policy...', location: ['footer'] },
  { slug: 'reviews', title: 'Reviews', content: 'This page is dynamically generated.', location: ['footer'] },
  { slug: 'road-to-gulf', title: 'Road to Gulf', content: roadToGulfContent, location: ['header', 'footer'] },
  { slug: 'editorial-guidelines', title: 'Editorial Guidelines', content: '# Editorial Guidelines\n\nAt Study Prometric, we maintain strict clinical accuracy...', location: ['footer'] },
  { slug: 'team', title: 'Our Team', content: '# Our Team\n\nMeet the experts behind the question bank...', location: ['footer'] },
];

const AdminSettingsPage = () => {
  const { toast } = useToast();
  const [staticPages, setStaticPages] = useState<StaticPage[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isCheckingTrial, setIsCheckingTrial] = useState(true);
  const [isTrialConfigured, setIsTrialConfigured] = useState(false);
  const [isFixingTrial, setIsFixingTrial] = useState(false);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPageForEdit, setSelectedPageForEdit] = useState<StaticPage | null>(null);

  const { hasCheckedInitialSession } = useSession();

  const fetchStaticPages = useCallback(async () => {
    const { data, error } = await supabase
      .from('static_pages')
      .select('*')
      .order('title', { ascending: true });

    if (error) {
      console.error('Error fetching static pages:', error);
      toast({ title: "Error", description: "Failed to load static pages.", variant: "destructive" });
      return [];
    }
    return data || [];
  }, [toast]);

  const checkTrialTier = useCallback(async () => {
    setIsCheckingTrial(true);
    try {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('id')
        .eq('name', '3-Day Trial')
        .maybeSingle();
      
      if (error) throw error;
      setIsTrialConfigured(!!data);
    } catch (e) {
      console.error("Error checking trial tier:", e);
    } finally {
      setIsCheckingTrial(false);
    }
  }, []);

  const handleFixTrial = async () => {
    setIsFixingTrial(true);
    try {
      const { error } = await supabase
        .from('subscription_tiers')
        .insert({
          name: '3-Day Trial',
          price: 0,
          currency: 'USD',
          duration_in_months: 1, // Stored as integer, used for the trial metadata
          description: 'Automatic 3-day full access for new signups.',
          features: ['Full Question Bank', 'AI Clinical Cases', 'Timed Exams', 'All Videos']
        });

      if (error) throw error;
      toast({ title: "Success", description: "3-Day Trial tier created. New signups will now receive access." });
      setIsTrialConfigured(true);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsFixingTrial(false);
    }
  };

  const ensureDefaultStaticPages = useCallback(async (currentPages: StaticPage[]) => {
    const existingPagesMap = new Map(currentPages.map(p => [p.slug, p]));
    const pagesToInsert = [];
    const pagesToUpdate = [];

    for (const defaultPage of defaultPages) {
      const existingPage = existingPagesMap.get(defaultPage.slug);
      if (!existingPage) {
        pagesToInsert.push(defaultPage);
      } else {
        const existingLocation = existingPage.location || [];
        const defaultLocation = defaultPage.location || [];
        const needsLocationUpdate = defaultLocation.length !== existingLocation.length || !defaultLocation.every(loc => existingLocation.includes(loc));
        
        const needsContentUpdate = existingPage.slug === 'road-to-gulf' && existingPage.content !== roadToGulfContent;

        if (needsLocationUpdate || needsContentUpdate) {
          pagesToUpdate.push({
            id: existingPage.id,
            location: defaultPage.location,
            content: needsContentUpdate ? defaultPage.content : existingPage.content,
          });
        }
      }
    }

    let changesMade = false;

    if (pagesToInsert.length > 0) {
      changesMade = true;
      const { error } = await supabase.from('static_pages').insert(pagesToInsert);
      if (error) {
        console.error('Error inserting default static pages:', error);
      }
    }

    if (pagesToUpdate.length > 0) {
      changesMade = true;
      const updates = pagesToUpdate.map(page => 
        supabase.from('static_pages').update({ location: page.location, content: page.content }).eq('id', page.id)
      );
      await Promise.all(updates);
    }

    return changesMade;
  }, []);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      const runSetup = async () => {
        setIsPageLoading(true);
        const initialPages = await fetchStaticPages();
        setStaticPages(initialPages);
        await ensureDefaultStaticPages(initialPages);
        await checkTrialTier();
        setIsPageLoading(false);
      };
      runSetup();
    }
  }, [hasCheckedInitialSession, fetchStaticPages, ensureDefaultStaticPages, checkTrialTier]);

  const handleDeletePage = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this static page?")) return;
    try {
      const { error } = await supabase.from('static_pages').delete().eq('id', id);
      if (error) throw error;
      const updatedPages = await fetchStaticPages();
      setStaticPages(updatedPages);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openEditDialog = (page?: StaticPage) => {
    setSelectedPageForEdit(page || null);
    setIsEditDialogOpen(true);
  };

  const columns: ColumnDef<StaticPage>[] = [
    { accessorKey: 'title', header: 'Page Title' },
    { accessorKey: 'slug', header: 'Slug' },
    {
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {(row.original.location || []).map((loc, index) => (
            <Badge key={index} variant="secondary">{loc}</Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditDialog(row.original)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeletePage(row.original.id)} className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (!hasCheckedInitialSession || isPageLoading) {
    return <div className="min-h-screen flex items-center justify-center pt-24"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Settings</h1>

      {/* Trial Tier Configuration Check */}
      <Card className={cn("border-l-4", isTrialConfigured ? "border-l-green-500" : "border-l-orange-500")}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            {isCheckingTrial ? <Loader2 className="h-5 w-5 animate-spin" /> : isTrialConfigured ? <ShieldCheck className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-orange-500" />}
            <CardTitle className="text-lg">System Health: 3-Day Trial Access</CardTitle>
          </div>
          <CardDescription>Ensures the mandatory '3-Day Trial' tier exists for new user automation.</CardDescription>
        </CardHeader>
        <CardContent>
          {isTrialConfigured ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Automation is active. New users correctly receive trial access upon signup.</p>
              <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Ready</Badge>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-sm text-orange-700 font-medium">The '3-Day Trial' tier is missing! New signups will NOT receive automatic access until this is fixed.</p>
              <Button onClick={handleFixTrial} disabled={isFixingTrial} size="sm" variant="default">
                {isFixingTrial ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Fix Trial Tier Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <SocialMediaSettingsCard />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl">Static Pages Content</CardTitle>
          <Button onClick={() => openEditDialog()}>Add New Page</Button>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={staticPages} />
        </CardContent>
      </Card>

      <MadeWithDyad />

      <EditStaticPageDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        page={selectedPageForEdit}
        onSave={async () => {
          const updatedPages = await fetchStaticPages();
          setStaticPages(updatedPages);
        }}
      />
    </div>
  );
};

export default AdminSettingsPage;