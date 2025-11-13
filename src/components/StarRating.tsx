"use client";

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: number;
  className?: string;
}

const StarRating = ({ rating, onRatingChange, size = 24, className }: StarRatingProps) => {
  const isInteractive = !!onRatingChange;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'cursor-pointer transition-colors',
            rating >= star ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300',
            isInteractive && 'hover:text-yellow-400'
          )}
          style={{ width: size, height: size }}
          onClick={() => onRatingChange?.(star)}
        />
      ))}
    </div>
  );
};

export default StarRating;