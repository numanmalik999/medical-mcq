"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { cn } from '@/lib/utils';

interface CheatSheetItem {
  title: string;
  content: string;
  category?: string;
  difficulty?: string;
}

interface CheatSheetGeneratorProps {
  title: string;
  subtitle: string;
  items: CheatSheetItem[];
  buttonText?: string;
  variant?: "default" | "outline" | "secondary";
  className?: string;
}

const CheatSheetGenerator = ({ 
  title, 
  subtitle, 
  items, 
  buttonText = "Download Cheat Sheet", 
  variant = "outline",
  className 
}: CheatSheetGeneratorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generatePdf = async () => {
    if (items.length === 0) {
      toast({ title: "No content", description: "There is no content to generate a cheat sheet from.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    
    // Create a hidden container for the PDF content
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '800px';
    container.style.padding = '40px';
    container.style.background = '#ffffff';
    container.style.color = '#1e293b';
    container.style.fontFamily = 'Inter, sans-serif';

    // Build the HTML structure
    container.innerHTML = `
      <div style="border-bottom: 4px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="margin: 0; color: #1e3a8a; font-size: 32px; font-weight: 800; text-transform: uppercase;">Study Prometric</h1>
          <p style="margin: 5px 0 0 0; color: #64748b; font-size: 16px; font-weight: 600;">${title}</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">Generated on ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
      
      <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 40px; font-style: italic;">${subtitle}</p>

      ${items.map((item, index) => `
        <div style="margin-bottom: 30px; page-break-inside: avoid; border-left: 4px solid #e2e8f0; padding-left: 20px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <span style="background: #1e3a8a; color: white; border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 900;">#${index + 1}</span>
            ${item.category ? `<span style="text-transform: uppercase; font-size: 10px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.1em;">${item.category}</span>` : ''}
            ${item.difficulty ? `<span style="text-transform: uppercase; font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 0.1em; border: 1px solid #e2e8f0; padding: 1px 6px; border-radius: 99px;">${item.difficulty}</span>` : ''}
          </div>
          <h3 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 700; line-height: 1.4;">${item.title}</h3>
          <div style="font-size: 14px; color: #334155; line-height: 1.6; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #f1f5f9;">
            ${item.content.replace(/\n/g, '<br/>')}
          </div>
        </div>
      `).join('')}

      <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="font-size: 11px; color: #94a3b8; font-weight: 600;">&copy; ${new Date().getFullYear()} Study Prometric. For personal study use only. Pass your DHA, SMLE, & MOH exams with clinical intelligence.</p>
      </div>
    `;

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`StudyPrometric_CheatSheet_${Date.now()}.pdf`);

      toast({ title: "Success", description: "Your clinical cheat sheet has been generated." });
    } catch (error: any) {
      console.error("PDF generation error:", error);
      toast({ title: "Export Failed", description: "Could not generate PDF. Please try again.", variant: "destructive" });
    } finally {
      document.body.removeChild(container);
      setIsGenerating(false);
    }
  };

  return (
    <Button 
      onClick={generatePdf} 
      disabled={isGenerating || items.length === 0}
      variant={variant}
      size="sm"
      className={cn("h-9 rounded-full font-bold uppercase text-[10px] gap-2", className)}
    >
      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {buttonText}
    </Button>
  );
};

export default CheatSheetGenerator;