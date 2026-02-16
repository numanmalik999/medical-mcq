"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Plus, Zap, Search } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EditFlashcardDialog from '@/components/EditFlashcardDialog';
import { Input } from '@/components/ui/input';

const ManageFlashcardsPage = () => {
  const { toast } = useToast();
  const [cards, setCards] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any | null>(null);

  const fetchCards = async () => {
    try {
        const { data, error } = await supabase
            .from('flashcards')
            .select('*, categories(name)')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        setCards(data || []);
    } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this flashcard?")) return;
    const { error } = await supabase.from('flashcards').delete().eq('id', id);
    if (!error) {
        toast({ title: "Deleted" });
        fetchCards();
    }
  };

  const filteredCards = cards.filter(c => 
    c.front_text.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.back_text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: ColumnDef<any>[] = [
    { 
        accessorKey: 'front_text', 
        header: 'Front Side',
        cell: ({ row }) => <div className="max-w-[300px] truncate font-bold text-xs">{row.original.front_text}</div>
    },
    { 
        accessorKey: 'back_text', 
        header: 'Back Side',
        cell: ({ row }) => <div className="max-w-[300px] truncate text-xs text-muted-foreground">{row.original.back_text}</div>
    },
    { 
        id: 'category',
        header: 'Category',
        cell: ({ row }) => <span className="text-[10px] font-black uppercase tracking-tight">{row.original.categories?.name || 'General'}</span>
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedCard(row.original); setIsDialogOpen(true); }}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDelete(row.original.id)} className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter flex items-center gap-2">
            <Zap className="h-8 w-8 text-primary" /> Memory Management
          </h1>
          <p className="text-muted-foreground">Manage the active-recall deck for the Gulf licensing exams.</p>
        </div>
        <Button onClick={() => { setSelectedCard(null); setIsDialogOpen(true); }} className="rounded-full font-bold">
           <Plus className="h-4 w-4 mr-2" /> New Flashcard
        </Button>
      </div>

      <Card>
        <CardHeader>
           <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search card content..." 
                className="pl-10 h-10 rounded-xl"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={filteredCards} />
        </CardContent>
      </Card>

      <EditFlashcardDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        card={selectedCard} 
        onSave={fetchCards} 
      />
      <MadeWithDyad />
    </div>
  );
};

export default ManageFlashcardsPage;