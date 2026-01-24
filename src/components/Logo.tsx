"use client";

import { Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
}

const Logo = ({ className, iconOnly = false }: LogoProps) => {
  return (
    <div 
      className={cn("flex items-center gap-3 select-none py-1", className)}
      role="img" 
      aria-label="Study Prometric Logo"
    >
      <div className="bg-white p-2 rounded-xl shadow-md flex items-center justify-center transition-transform hover:scale-110 ring-2 ring-white/20">
        <Stethoscope className="h-6 w-6 text-blue-700" strokeWidth={3} />
      </div>
      {!iconOnly && (
        <div className="flex flex-col items-start leading-none">
          <span className="text-xl font-black tracking-tight text-white uppercase drop-shadow-sm">
            Study Prometric
          </span>
          <span className="text-[10px] font-bold tracking-[0.25em] text-blue-100 uppercase mt-0.5">
            Medical MCQs
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;