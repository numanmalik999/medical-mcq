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
      className={cn("flex items-center gap-2 select-none", className)}
      role="img" 
      aria-label="Study Prometric Logo"
    >
      <div className="bg-white p-1.5 rounded-xl shadow-sm flex items-center justify-center transition-transform hover:scale-105">
        <Stethoscope className="h-6 w-6 text-primary" strokeWidth={2.5} />
      </div>
      {!iconOnly && (
        <div className="flex flex-col items-start leading-none">
          <span className="text-xl font-black tracking-tighter text-white uppercase">
            Study Prometric
          </span>
          <span className="text-[10px] font-bold tracking-[0.2em] text-white/80 uppercase">
            Medical MCQs
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;