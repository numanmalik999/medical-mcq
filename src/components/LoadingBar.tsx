"use client";

import { cn } from "@/lib/utils";

interface LoadingBarProps {
  className?: string;
}

const LoadingBar = ({ className }: LoadingBarProps) => {
  return (
    <div className={cn("fixed top-16 left-0 right-0 h-1 z-[60] overflow-hidden bg-muted", className)}>
      <div className="h-full bg-primary animate-progress-loading w-full origin-left"></div>
    </div>
  );
};

export default LoadingBar;