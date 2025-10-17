"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge"; // Import Badge

// New type for a single MCQ-Category-Subcategory link
export type McqCategoryLink = {
  category_id: string;
  category_name: string; // For display
  subcategory_id: string | null;
  subcategory_name: string | null; // For display
};

export type MCQ = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation_id: string | null;
  difficulty: string | null;
  is_trial_mcq: boolean | null;
  // New: Array of category links
  category_links: McqCategoryLink[];
};

// DisplayMCQ is now the same as MCQ as category_links contains display names
type DisplayMCQ = MCQ;

interface MCQColumnsProps {
  onDelete: (mcqId: string, explanationId: string | null) => void;
  onEdit: (mcq: MCQ) => void;
}

export const createMcqColumns = ({ onDelete, onEdit }: MCQColumnsProps): ColumnDef<DisplayMCQ>[] => [
  {
    accessorKey: "question_text",
    header: "Question",
    cell: ({ row }) => {
      const question: string = row.getValue("question_text");
      return <div className="w-[200px] truncate">{question}</div>;
    },
  },
  {
    accessorKey: "correct_answer",
    header: "Correct",
  },
  {
    id: "categories", // New ID for categories column
    header: "Categories",
    cell: ({ row }) => {
      const categories = row.original.category_links.map(link => link.category_name).filter(Boolean);
      return (
        <div className="w-[150px] flex flex-wrap gap-1">
          {categories.length > 0 ? categories.map((name, index) => (
            <Badge key={index} variant="secondary">{name}</Badge>
          )) : 'N/A'}
        </div>
      );
    },
  },
  {
    id: "subcategories", // New ID for subcategories column
    header: "Subcategories",
    cell: ({ row }) => {
      const subcategories = row.original.category_links.map(link => link.subcategory_name).filter(Boolean);
      return (
        <div className="w-[150px] flex flex-wrap gap-1">
          {subcategories.length > 0 ? subcategories.map((name, index) => (
            <Badge key={index} variant="outline">{name}</Badge>
          )) : 'N/A'}
        </div>
      );
    },
  },
  {
    accessorKey: "difficulty",
    header: "Difficulty",
  },
  {
    accessorKey: "is_trial_mcq", // New column for trial status
    header: "Trial MCQ",
    cell: ({ row }) => {
      const isTrial = row.original.is_trial_mcq;
      return (
        <Badge variant={isTrial ? "default" : "secondary"}>
          {isTrial ? "Yes" : "No"}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const mcq = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(mcq.id)}
            >
              Copy MCQ ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(mcq)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(mcq.id, mcq.explanation_id)}
              className="text-red-600"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];