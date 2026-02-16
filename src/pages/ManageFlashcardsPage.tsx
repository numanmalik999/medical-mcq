"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Plus, Zap, Search, Wand2, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EditFlashcardDialog from '@/components/EditFlashcardDialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const ManageFlashcardsPage = () => {
  const { toast } = useToast();
  const [cards, setCards] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Bulk Gen State
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any | null>(null);

  const fetchMetadata = useCallback(async () => {
    const [cardsRes, catsRes] = await Promise.all([
        supabase.from('flashcards').select('*, categories(name)').order('created_at', { ascending: false }),
        supabase.from('categories').select('id, name').order('name')
    ]);
    
    if (cardsRes.data) setCards(cardsRes.data);
    if (catsRes.data) setCategories(catsRes.data);
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  const handleBulkGenerate = async () => {
    if (!selectedCatId) return;
    setIsBulkGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-generate-flashcards', {
        body: { category_id: selectedCatId, limit: 10 },
      });

      if (error) throw error;
      toast({ title: "Bulk Sync Complete", description: `Generated ${data.successCount} new active recall cards.` });
      fetchMetadata();
    } catch (e: any) {
      toast({ title: "Sync Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this flashcard?")) return;
    const { error } = await supabase.from('flashcards').delete().eq('id', id);
    if (!error) {
        toast({ title: "Deleted" });
        fetchMetadata();
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bulk Tool */}
        <Card className="lg:col-span-1 border-primary/20 bg-primary/5 shadow-inner">
           <CardHeader>
              <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-primary" /> AI Batch Creator
              </CardTitle>
              <CardDescription>Generate pearls from MCQs without cards.</CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
              <div className="space-y-2">
                 <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Target Specialty</Label>
                 <Select onValueChange={setSelectedCatId} value={selectedCatId}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Select specialty..." /></SelectTrigger>
                    <SelectContent>
                       {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                 </Select>
              </div>
              <Button 
                className="w-full h-11 rounded-xl font-bold uppercase tracking-tight shadow-md" 
                disabled={!selectedCatId || isBulkGenerating}
                onClick={handleBulkGenerate}
              >
                 {isBulkGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2 fill-current" />}
                 {isBulkGenerating ? "Generating..." : "Generate 10 Cards"}
              </Button>
           </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="lg:col-span-2 border-none shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search card content..." 
                        className="pl-10 h-10 rounded-xl bg-white border-none shadow-inner"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <DataTable columns={columns} data={filteredCards} />
            </CardContent>
        </Card>
      </div>

      <EditFlashcardDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        card={selectedCard} 
        onSave={fetchMetadata} 
      />
      <MadeWithDyad />
    </div>
  );
};

export default ManageFlashcardsPage;