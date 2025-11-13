"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import StarRating from '@/components/StarRating';
import { format } from 'date-fns';

interface Review {
  id: string;
  name: string;
  rating: number;
  review_text: string;
  created_at: string;
}

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  rating: z.number().min(1, "Please select a rating.").max(5),
  review_text: z.string().min(10, "Review must be at least 10 characters."),
});

const ReviewsPage = () => {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      rating: 0,
      review_text: "",
    },
  });

  const fetchReviews = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
      toast({ title: "Error", description: "Failed to load reviews.", variant: "destructive" });
    } else {
      setReviews(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          name: values.name,
          rating: values.rating,
          review_text: values.review_text,
        });

      if (error) throw error;

      toast({
        title: "Review Submitted!",
        description: "Thank you for your feedback.",
      });
      form.reset();
      fetchReviews(); // Refresh the list
    } catch (error: any) {
      console.error("Error submitting review:", error);
      toast({
        title: "Submission Failed",
        description: `Failed to submit review: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 pt-16 pb-12">
      <div className="container mx-auto max-w-4xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Reviews & Testimonials</h1>
          <p className="text-muted-foreground mt-2">See what our users are saying about their experience.</p>
        </div>

        {/* Submit Review Form */}
        <Card>
          <CardHeader>
            <CardTitle>Leave a Review</CardTitle>
            <CardDescription>Share your experience with the community.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Rating</FormLabel>
                      <FormControl>
                        <StarRating rating={field.value} onRatingChange={field.onChange} size={28} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="review_text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Review</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Tell us about your experience..." rows={5} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit Review"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Display Reviews */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center">Recent Reviews</h2>
          {isLoading ? (
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-center text-muted-foreground">No reviews yet. Be the first to leave one!</p>
          ) : (
            reviews.map((review) => (
              <Card key={review.id}>
                <CardHeader className="flex flex-row justify-between items-start">
                  <div>
                    <CardTitle>{review.name}</CardTitle>
                    <CardDescription>{format(new Date(review.created_at), 'PPP')}</CardDescription>
                  </div>
                  <StarRating rating={review.rating} size={20} />
                </CardHeader>
                <CardContent>
                  <p className="text-card-foreground">{review.review_text}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default ReviewsPage;