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

export type MCQ = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  category_id: string | null;
  subcategory_id: string | null;
  difficulty: string | null;
  explanation_id: string | null;
};

// Extend MCQ type for display purposes to include category/subcategory names
type DisplayMCQ = MCQ & {
  category_name: string | null;
  subcategory_name: string | null;
};

interface MCQColumnsProps {
  onDelete: (mcqId: string, explanationId: string | null) => void;
  onEdit: (mcq: MCQ) => void; // Added onEdit prop
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
    accessorKey: "category_name", // Display category name
    header: "Category",
  },
  {
    accessorKey: "subcategory_name", // Display subcategory name
    header: "Subcategory",
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
            <DropdownMenuItem onClick={() => onEdit(mcq)}> {/* Call onEdit */}
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