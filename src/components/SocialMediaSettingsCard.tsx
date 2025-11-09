"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';

const socialLinkSchema = z.object({
  platform: z.string().min(1, "Platform is required."),
  url: z.string().url("Must be a valid URL."),
});

const formSchema = z.object({
  links: z.array(socialLinkSchema),
});

interface SocialMediaSettingsCardProps {
  onSave?: () => void;
}

const SocialMediaSettingsCard = ({ onSave }: SocialMediaSettingsCardProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      links: [],
    },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "links",
  });

  useEffect(() => {
    fetchSocialLinks();
  }, []);

  const fetchSocialLinks = async () => {
    setIsFetching(true);
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', 'social_links')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching social links:', error);
      toast({ title: "Error", description: "Failed to load social media settings.", variant: "destructive" });
    } else if (data && Array.isArray(data.value)) {
      form.reset({ links: data.value as z.infer<typeof formSchema>['links'] });
    } else {
      form.reset({ links: [] });
    }
    setIsFetching(false);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('global_settings')
        .upsert({
          key: 'social_links',
          value: values.links,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;

      toast({ title: "Success!", description: "Social media links updated successfully." });
      onSave?.();
    } catch (error: any) {
      console.error("Error saving social links:", error);
      toast({
        title: "Error",
        description: `Failed to save social links: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social Media Links</CardTitle>
        <CardDescription>Manage the social media links displayed in the footer.</CardDescription>
      </CardHeader>
      <CardContent>
        {isFetching ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-end gap-2 border p-3 rounded-md">
                    <FormField
                      control={form.control}
                      name={`links.${index}.platform`}
                      render={({ field: platformField }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Platform</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Twitter, Facebook" {...platformField} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`links.${index}.url`}
                      render={({ field: urlField }) => (
                        <FormItem className="flex-1">
                          <FormLabel>URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://..." {...urlField} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => append({ platform: "", url: "" })}
                className="w-full"
              >
                <PlusCircle className="h-4 w-4 mr-2" /> Add Link
              </Button>

              <Button type="submit" className="w-full" disabled={isSubmitting || !form.formState.isValid}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Social Links"}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
};

export default SocialMediaSettingsCard;