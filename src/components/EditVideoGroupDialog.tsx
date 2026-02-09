"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Upload, X } from 'lucide-react';

export interface VideoGroup {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  order: number;
}

const formSchema = z.object({
  name: z.string().min(1, "Group name is required."),
  description: z.string().optional().or(z.literal('')),
  image_url: z.string().url("Must be a valid URL.").optional().or(z.literal('')),
  order: z.preprocess((val) => parseInt(String(val), 10), z.number().min(0)),
});

interface EditVideoGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: VideoGroup | null;
  onSave: () => void;
}

const EditVideoGroupDialog = ({ open, onOpenChange, group, onSave }: EditVideoGroupDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "", image_url: "", order: 0 },
  });

  useEffect(() => {
    if (group && open) {
      form.reset({
        name: group.name,
        description: group.description || "",
        image_url: group.image_url || "",
        order: group.order,
      });
      setPreviewUrl(group.image_url);
    } else if (!open) {
      form.reset({ name: "", description: "", image_url: "", order: 0 });
      setPreviewUrl(null);
    }
  }, [group, open, form]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if the user is logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        toast({ title: "Error", description: "You must be logged in to upload files.", variant: "destructive" });
        return;
    }

    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `video-covers/${fileName}`;

      // Upload the file to the 'media' bucket
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

      if (uploadError) {
          // If the error is 'Bucket not found', give a more helpful message
          if (uploadError.message.includes('not found')) {
              throw new Error("The 'media' storage bucket does not exist. Please run the SQL fix in your Supabase Dashboard.");
          }
          throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      form.setValue('image_url', publicUrl);
      setPreviewUrl(publicUrl);
      toast({ title: "Upload complete", description: "Image uploaded successfully." });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = () => {
    form.setValue('image_url', '');
    setPreviewUrl(null);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...values,
        description: values.description || null,
        image_url: values.image_url || null,
      };

      const { error } = group?.id 
        ? await supabase.from('video_groups').update(payload).eq('id', group.id)
        : await supabase.from('video_groups').insert(payload);

      if (error) throw error;
      toast({ title: "Success", description: "Video group saved." });
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{group ? 'Edit Group' : 'Add New Group'}</DialogTitle>
          <DialogDescription>Create a high-level category for your video lessons.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Group Name</FormLabel><FormControl><Input placeholder="e.g., Cardiology Basics" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            
            <div className="space-y-4">
              <FormLabel>Cover Image</FormLabel>
              
              {previewUrl ? (
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border group">
                  <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                  <Button 
                    type="button" 
                    variant="destructive" 
                    size="icon" 
                    className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={removeImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center aspect-video w-full rounded-xl border-2 border-dashed bg-muted/50 transition-colors hover:bg-muted/80 relative">
                  <Input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                  {isUploading ? (
                    <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
                  ) : (
                    <>
                      <div className="p-3 bg-white rounded-full shadow-sm mb-2">
                        <Upload className="h-6 w-6 text-primary" />
                      </div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Click to upload image</p>
                    </>
                  )}
                </div>
              )}

              <FormField control={form.control} name="image_url" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground">Or provide an Image URL</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input placeholder="https://images.unsplash.com/..." {...field} onChange={(e) => { field.onChange(e); setPreviewUrl(e.target.value); }} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Short summary of this group..." {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <FormField control={form.control} name="order" render={({ field }) => (
              <FormItem><FormLabel>Display Order</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <DialogFooter className="pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancel</Button>
              <Button type="submit" disabled={isSubmitting || isUploading}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Group
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditVideoGroupDialog;