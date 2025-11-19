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
import { MoreHorizontal, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type McqCategoryLink = {
  category_id: string;
  category_name: string;
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
  category_links: McqCategoryLink[];
  
  explanation_text?: string;
  image_url?: string | null;
};

type DisplayMCQ = MCQ;

interface MCQColumnsProps {
  onDelete: (mcqId: string, explanationId: string | null) => void;
  onEdit: (mcq: MCQ) => void;
}

export const createMcqColumns = ({ onDelete, onEdit }: MCQColumnsProps): ColumnDef<DisplayMCQ>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "question_text",
    header: "Question",
    cell: ({ row }) => {
      const question: string = row.getValue("question_text");
      return <div className="w-[200px] truncate">{question}</div>;
    },
  },
  {
    id: "enhanced",
    header: "AI",
    cell: ({ row }) => {
      const difficulty = row.original.difficulty;
      if (difficulty) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center">
                  <Wand2 className="h-4 w-4 text-blue-500" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>AI Enhanced (Difficulty: {difficulty})</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      return <div className="flex justify-center text-muted-foreground">-</div>;
    },
  },
  {
    accessorKey: "correct_answer",
    header: "Correct",
  },
  {
    id: "categories",
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
    accessorKey: "is_trial_mcq",
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