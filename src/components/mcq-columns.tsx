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
import { toast } from "@/hooks/use-toast";

export type MCQ = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  category_id: string | null; // Updated to category_id
  subcategory_id: string | null; // Added subcategory_id
  difficulty: string | null;
  explanation_id: string | null;
};

interface MCQColumnsProps {
  onDelete: (mcqId: string, explanationId: string | null) => void;
}

export const createMcqColumns = ({ onDelete }: MCQColumnsProps): ColumnDef<MCQ>[] => [
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
    accessorKey: "category_id", // Display category ID for now, will fetch name later
    header: "Category ID",
  },
  {
    accessorKey: "subcategory_id", // Display subcategory ID for now
    header: "Subcategory ID",
  },
  {
    accessorKey: "difficulty",
    header: "Difficulty",
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
            <DropdownMenuItem onClick={() => toast({ title: "Edit MCQ", description: "Edit functionality coming soon!" })}>
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