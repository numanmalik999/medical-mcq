"use client";

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MadeWithDyad } from '@/components/made-with-dyad';

const ManageSeoPage = () => {
  const { toast } = useToast();
  
  // Blog Generator State
  const [blogTopic, setBlogTopic] = useState('');
  const [blogKeywords, setBlogKeywords] = useState('');
  const [isGeneratingBlog, setIsGeneratingBlog] = useState(false);
  const [generatedBlog, setGeneratedBlog] = useState<any>(null);

  // Content Audit State
  const [mcqId, setMcqId] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditReport, setAuditReport] = useState<any>(null);

  const handleGenerateBlog = async () => {
    if (!blogTopic) return;
    setIsGeneratingBlog(true);
    setGeneratedBlog(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-seo-blog', {
        body: { topic: blogTopic, target_keywords: blogKeywords },
      });
      if (error) throw error;
      setGeneratedBlog(data);
      toast({ title: "Blog Generated", description: "The SEO-optimized post is ready for review." });
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsGeneratingBlog(false);
    }
  };

  const handleSaveBlog = async () => {
    if (!generatedBlog) return;
    try {
      const { error } = await supabase.from('blogs').insert({
        title: generatedBlog.title,
        slug: generatedBlog.slug,
        content: generatedBlog.content,
        meta_description: generatedBlog.meta_description,
        keywords: generatedBlog.keywords,
        status: 'published'
      });
      if (error) throw error;
      toast({ title: "Published", description: "Blog post is now live!" });
      setGeneratedBlog(null);
      setBlogTopic('');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleRunAudit = async () => {
    if (!mcqId) return;
    setIsAuditing(true);
    setAuditReport(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-content-audit', {
        body: { mcq_id: mcqId },
      });
      if (error) throw error;
      setAuditReport(data);
    } catch (error: any) {
      toast({ title: "Audit Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">SEO & Content Intelligence</h1>

      <Tabs defaultValue="blog" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="blog">Blog Generator</TabsTrigger>
          <TabsTrigger value="audit">Content Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="blog" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Automated SEO Blog Generator</CardTitle>
              <CardDescription>Generate educational medical articles based on high-traffic topics.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Blog Topic</Label>
                <Input 
                  placeholder="e.g. Preparing for DHA Exam in 30 Days" 
                  value={blogTopic} 
                  onChange={(e) => setBlogTopic(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Keywords (Optional)</Label>
                <Input 
                  placeholder="dha exam, medical license, prometric prep" 
                  value={blogKeywords} 
                  onChange={(e) => setBlogKeywords(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleGenerateBlog} 
                disabled={isGeneratingBlog || !blogTopic}
                className="w-full"
              >
                {isGeneratingBlog ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Generate Optimized Article
              </Button>
            </CardContent>
          </Card>

          {generatedBlog && (
            <Card className="border-primary shadow-lg animate-in fade-in slide-in-from-bottom-4">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  Preview: {generatedBlog.title}
                  <Badge variant="outline">Draft Ready</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-sm font-bold">Meta Description:</p>
                  <p className="text-sm italic">{generatedBlog.meta_description}</p>
                </div>
                <Textarea 
                  value={generatedBlog.content} 
                  readOnly 
                  rows={15} 
                  className="font-mono text-xs"
                />
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setGeneratedBlog(null)}>Discard</Button>
                <Button onClick={handleSaveBlog}>Publish Now</Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Content Audit</CardTitle>
              <CardDescription>Enter an MCQ ID to check for clinical accuracy and SEO potential.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Paste MCQ ID here..." 
                  value={mcqId} 
                  onChange={(e) => setMcqId(e.target.value)}
                />
                <Button onClick={handleRunAudit} disabled={isAuditing || !mcqId}>
                  {isAuditing ? <Loader2 className="animate-spin" /> : "Audit Content"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {auditReport && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    Quality Score: 
                    <span className={auditReport.score > 80 ? 'text-green-600' : 'text-yellow-600'}>
                      {auditReport.score}%
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    {auditReport.is_clinically_sound ? 
                      <CheckCircle2 className="text-green-600 h-5 w-5" /> : 
                      <ShieldAlert className="text-red-600 h-5 w-5" />
                    }
                    <span className="font-semibold">
                      {auditReport.is_clinically_sound ? "Clinically Accurate" : "Action Required: Potential Inaccuracy"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold">Identified Issues:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {auditReport.issues.map((issue: string, i: number) => (
                        <li key={i} className="text-muted-foreground">{issue}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Optimization Suggestions</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-relaxed">{auditReport.suggestions}</p>
                  <div className="space-y-2">
                    <p className="text-sm font-bold">SEO Keywords:</p>
                    <div className="flex flex-wrap gap-1">
                      {auditReport.seo_keywords.map((kw: string, i: number) => (
                        <Badge key={i} variant="secondary">{kw}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
      <MadeWithDyad />
    </div>
  );
};

export default ManageSeoPage;