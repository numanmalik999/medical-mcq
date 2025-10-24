"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';

export interface StaticPage {
  id: string;
  slug: string;
  title: string;
  content: string | null;
  updated_at: string;
  location: string[] | null; // Added location field
}

const LocationEnum = z.enum(["header", "footer"]);
type LocationType = z.infer<typeof LocationEnum>;

const formSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1, "Slug is required."),
  title: z.string().min(1, "Title is required."),
  content: z.string().optional().or(z.literal('')),
  location: z.array(LocationEnum).optional(), // Use LocationEnum
});

interface EditStaticPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: StaticPage | null; // Null for adding, object for editing
  onSave: () => void; // Callback to refresh data after save
}

const locationOptions: { id: LocationType; label: string }[] = [
  { id: "header", label: "Header Navigation" },
  { id: "footer", label: "Footer Links" },
];

const EditStaticPageDialog = ({ open, onOpenChange, page, onSave }: EditStaticPageDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      slug: "",
      title: "",
      content: "",
      location: ["footer"] as LocationType[], // Ensure default is correctly typed
    },
  });

  useEffect(() => {
    if (page && open) {
      // Cast page.location to the expected type for form.reset
      const initialLocation = (page.location || ["footer"]).filter((loc): loc is LocationType => LocationEnum.options.includes(loc as LocationType));
      
      form.reset({
        id: page.id,
        slug: page.slug,
        title: page.title,
        content: page.content || "",
        location: initialLocation,
      });
    } else if (!open) {
      form.reset(); // Reset form when dialog closes
    }
  }, [page, open, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const pageData = {
        slug: values.slug,
        title: values.title,
        content: values.content || null,
        location: values.location && values.location.length > 0 ? values.location : null,
      };

      if (page?.id) {
        // Update existing page
        const { error } = await supabase
          .from('static_pages')
          .update(pageData)
          .eq('id', page.id);

        if (error) throw error;
        toast({ title: "Success!", description: "Static page updated successfully." });
      } else {
        // Add new page
        const { error } = await supabase
          .from('static_pages')
          .insert(pageData);

        if (error) throw error;
        toast({ title: "Success!", description: "Static page added successfully." });
      }

      onSave(); // Refresh data in parent component
      onOpenChange(false); // Close dialog
    } catch (error: any) {
      console.error("Error saving static page:", error);
      toast({
        title: "Error",
        description: `Failed to save static page: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{page ? 'Edit Static Page' : 'Add New Static Page'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Page Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., About Us, FAQ" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Page Slug (Unique Identifier)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., about-us, faq" {...field} disabled={!!page?.id} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter page content here (supports basic HTML/Markdown)" rows={10} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field: _field }) => ( // Renamed to _field to avoid TS6133
                <FormItem className="space-y-3">
                  <FormLabel>Link Location</FormLabel>
                  <FormDescription>
                    Select where this page should appear in the navigation.
                  </FormDescription>
                  <div className="flex flex-col space-y-2">
                    {locationOptions.map((item) => (
                      <FormField
                        key={item.id}
                        control={form.control}
                        name="location"
                        render={({ field: innerField }) => {
                          return (
                            <FormItem
                              key={item.id}
                              className="flex flex-row items-start space-x-3 space-y-0"
                            >
                              <FormControl>
                                <Checkbox
                                  checked={innerField.value?.includes(item.id)}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? innerField.onChange([...(innerField.value || []), item.id])
                                      : innerField.onChange(
                                          innerField.value?.filter(
                                            (value) => value !== item.id
                                          )
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {item.label}
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default EditStaticPageDialog;