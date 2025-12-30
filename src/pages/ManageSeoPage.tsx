"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wand2, ShieldAlert, History, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ManageSeoPage = () => {
  const { toast } = useToast();
  
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [auditReports, setAuditReports] = useState<any[]>([]);
  const [selectedAuditCategory, setSelectedAuditCategory] = useState('');
  
  const [blogTopic, setBlogTopic] = useState('');
  const [blogKeywords, setBlogKeywords] = useState('');
  const [isGeneratingBlog, setIsGeneratingBlog] = useState(false);
  const [generatedBlog, setGeneratedBlog] = useState<any>(null);

  const [mcqId, setMcqId] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [latestReport, setLatestReport] = useState<any>(null);

  useEffect(() => {
    fetchCategories();
    fetchReports();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('id, name').order('name');
    if (data) setCategories(data);
  };

  const fetchReports = async () => {
    const { data } = await supabase
      .from('content_audit_reports')
      .select('*, mcqs(question_text)')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setAuditReports(data);
  };

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

  const handleRunAudit = async (type: 'single' | 'category') => {
    setIsAuditing(true);
    try {
      const body = type === 'single' ? { mcq_id: mcqId } : { category_id: selectedAuditCategory };
      const { data, error } = await supabase.functions.invoke('ai-content-audit', { body });
      
      if (error) throw error;

      if (type === 'single') {
        setLatestReport(data);
        fetchReports();
      } else {
        toast({ 
          title: "Audit Started", 
          description: "AI is checking the category in the background. Refresh in a few minutes to see reports." 
        });
      }
    } catch (error: any) {
      toast({ title: "Audit Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsAuditing(false);
    }
  };

  const clearAllReports = async () => {
    if (!window.confirm("Clear all audit history?")) return;
    await supabase.from('content_audit_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    fetchReports();
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Trigger Audit</CardTitle>
                  <CardDescription>Check content quality and accuracy.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Single MCQ Audit</Label>
                    <div className="flex gap-2">
                      <Input placeholder="MCQ ID..." value={mcqId} onChange={(e) => setMcqId(e.target.value)} />
                      <Button size="icon" onClick={() => handleRunAudit('single')} disabled={isAuditing || !mcqId}><Wand2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 border-t pt-4">
                    <Label>Category Bulk Audit</Label>
                    <Select value={selectedAuditCategory} onValueChange={setSelectedAuditCategory}>
                      <SelectTrigger><SelectValue placeholder="Select Category..." /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button 
                      className="w-full mt-2" 
                      onClick={() => handleRunAudit('category')} 
                      disabled={isAuditing || !selectedAuditCategory}
                    >
                      {isAuditing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
                      Audit Whole Category
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {latestReport && (
                <Card className="border-primary">
                  <CardHeader><CardTitle className="text-md">Latest Single Result</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-2">
                    <div className="flex justify-between"><span>Score:</span><Badge>{latestReport.score}%</Badge></div>
                    <p className="font-bold">Suggestions:</p>
                    <p className="text-muted-foreground">{latestReport.suggestions}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Audit History</CardTitle>
                    <CardDescription>Recent findings across your database.</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearAllReports} className="text-red-500"><Trash2 className="h-4 w-4" /></Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {auditReports.map((report) => (
                      <div key={report.id} className="p-4 border rounded-lg bg-muted/30">
                        <div className="flex justify-between items-start mb-2">
                          <p className="text-xs font-mono text-muted-foreground">MCQ: {report.mcq_id.substring(0,8)}</p>
                          <Badge variant={report.score > 80 ? 'default' : report.score > 50 ? 'secondary' : 'destructive'}>
                            {report.score}% Quality
                          </Badge>
                        </div>
                        <p className="text-sm font-medium line-clamp-1 mb-2">"{report.mcqs?.question_text}"</p>
                        <div className="flex gap-2 mb-2">
                          {!report.is_clinically_sound && <Badge variant="destructive" className="text-[10px]">INACCURATE</Badge>}
                          {report.seo_keywords?.slice(0,2).map((kw: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{kw}</Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground italic">"{report.suggestions?.substring(0,100)}..."</p>
                      </div>
                    ))}
                    {auditReports.length === 0 && <p className="text-center py-10 text-muted-foreground">No audit reports found.</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <MadeWithDyad />
    </div>
  );
};

export default ManageSeoPage;