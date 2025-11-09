"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useForm, FieldValues, UseFormReturn, useFieldArray, Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form } from '@/components/ui/form';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';

interface EditLandingPageSectionProps<T extends FieldValues> {
  settingKey: string;
  title: string;
  description: string;
  schema: z.ZodSchema<T>;
  children: (form: UseFormReturn<T>, index?: number, field?: any) => React.ReactNode;
  isList?: boolean; // Flag if the schema is an array (like features)
  defaultValues: T;
}

// Helper component for list items (specifically for features)
const ListEditor = <T extends FieldValues>({ form, fields, append, remove, renderItem }: {
    form: UseFormReturn<T>;
    fields: any[];
    append: (value: any) => void;
    remove: (index: number) => void;
    renderItem: (form: UseFormReturn<T>, index: number, field: any) => React.ReactNode;
}) => {
    // Safely determine the default structure for a new item
    // Use 'any' for the path to bypass strict RHF Path checking in generic context
    const links = form.getValues('links' as any);
    const defaultItem = Array.isArray(links) && links.length > 0 ? links[0] : { title: '', description: '', icon: '' };

    return (
        <div className="space-y-4">
            {fields.map((field, index) => (
                <div key={field.id} className="flex flex-col gap-3 border p-4 rounded-md bg-muted/50">
                    {renderItem(form, index, field)}
                    <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)} className="w-full sm:w-auto self-end">
                        <Trash2 className="h-4 w-4 mr-2" /> Remove Item
                    </Button>
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                onClick={() => append(defaultItem)}
                className="w-full"
            >
                <PlusCircle className="h-4 w-4 mr-2" /> Add New Item
            </Button>
        </div>
    );
};


const EditLandingPageSection = <T extends FieldValues>({
  settingKey,
  title,
  description,
  schema,
  children,
  isList = false,
  defaultValues,
}: EditLandingPageSectionProps<T>) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as any, // Assert to any to satisfy DefaultValues type constraint
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: isList ? 'links' as any : 'data' as any, // Use 'links' or 'data' as string, assert to any
  });

  const fetchSettings = useCallback(async () => {
    setIsFetching(true);
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', settingKey)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`Error fetching ${settingKey}:`, error);
      toast({ title: "Error", description: `Failed to load ${title} settings.`, variant: "destructive" });
    } else if (data && data.value) {
      try {
        // If it's a list, wrap the array in an object for form.reset
        const resetData = isList ? { links: data.value } : data.value;
        form.reset(resetData as T);
      } catch (e) {
        console.error(`Error parsing ${settingKey} data:`, e);
        form.reset(defaultValues);
      }
    } else {
      form.reset(defaultValues);
    }
    setIsFetching(false);
  }, [settingKey, title, form, defaultValues, isList, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const onSubmit = async (values: T) => {
    setIsSubmitting(true);
    try {
      // If it's a list, extract the array value
      const valueToSave = isList ? (values as any).links : values;

      const { error } = await supabase
        .from('global_settings')
        .upsert({
          key: settingKey,
          value: valueToSave,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;

      toast({ title: "Success!", description: `${title} updated successfully.` });
    } catch (error: any) {
      console.error(`Error saving ${settingKey}:`, error);
      toast({
        title: "Error",
        description: `Failed to save ${title}: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isFetching ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Form {...form as any}> {/* Assert form to any here */}
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {isList ? (
                <ListEditor
                    form={form as any} // Assert form to any here
                    fields={fields}
                    append={append}
                    remove={remove}
                    renderItem={(f, index, field) => children(f as UseFormReturn<T>, index, field)}
                />
              ) : (
                children(form as any) // Assert form to any here
              )}
              
              <Button type="submit" className="w-full" disabled={isSubmitting || !form.formState.isValid}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : `Save ${title}`}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
};

export default EditLandingPageSection;