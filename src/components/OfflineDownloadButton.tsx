"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MultiSelect from './MultiSelect';
import useOfflineMcqs from '@/hooks/useOfflineMcqs';

interface Category {
  id: string;
  name: string;
}

interface OfflineDownloadButtonProps {
  className?: string;
}

const OfflineDownloadButton = ({ className }: OfflineDownloadButtonProps) => {
  const { isDbInitialized, fetchAndStoreMcqs, isNative } = useOfflineMcqs();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [mcqLimit, setMcqLimit] = useState(100);
  const [isFetchingCategories, setIsFetchingCategories] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    setIsFetchingCategories(true);
    const { data, error } = await supabase
      .from('categories')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
      setCategories([]);
    } else {
      setCategories(data || []);
    }
    setIsFetchingCategories(false);
  };

  const handleDownload = async () => {
    if (!isNative) {
      toast({ title: "Info", description: "Offline download is only available on the installed mobile app.", variant: "default" });
      return;
    }
    if (!isDbInitialized) {
      toast({ title: "Error", description: "Local database is not initialized yet. Please wait.", variant: "destructive" });
      return;
    }
    if (selectedCategoryIds.length === 0) {
      toast({ title: "Error", description: "Please select at least one category.", variant: "destructive" });
      return;
    }
    if (mcqLimit <= 0) {
      toast({ title: "Error", description: "MCQ limit must be greater than zero.", variant: "destructive" });
      return;
    }

    setIsDownloading(true);
    const result = await fetchAndStoreMcqs(selectedCategoryIds, mcqLimit);
    setIsDownloading(false);
    
    if (result.success) {
        setIsOpen(false);
        setSelectedCategoryIds([]);
    }
  };

  if (!isNative) {
    return (
      <Button variant="outline" disabled className={className}>
        <Download className="h-4 w-4 mr-2" /> Offline Download (Web Only)
      </Button>
    );
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} disabled={!isDbInitialized} className={className}>
        <Download className="h-4 w-4 mr-2" /> Download for Offline
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Download MCQs for Offline Study</DialogTitle>
            <DialogDescription>
              Select categories and the maximum number of questions to store locally on your device.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Categories</Label>
              {isFetchingCategories ? (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading categories...
                </div>
              ) : (
                <MultiSelect
                  options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
                  selectedValues={selectedCategoryIds}
                  onValueChange={setSelectedCategoryIds}
                  placeholder="Select categories to download"
                  disabled={isDownloading}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="mcq-limit">Maximum MCQs to Download</Label>
              <Input
                id="mcq-limit"
                type="number"
                min="1"
                value={mcqLimit}
                onChange={(e) => setMcqLimit(parseInt(e.target.value) || 1)}
                placeholder="e.g., 100"
                disabled={isDownloading}
              />
              <p className="text-sm text-muted-foreground">
                The system will fetch up to this many questions across the selected categories.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isDownloading}>Cancel</Button>
            <Button onClick={handleDownload} disabled={isDownloading || selectedCategoryIds.length === 0}>
              {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isDownloading ? "Downloading..." : "Start Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OfflineDownloadButton;