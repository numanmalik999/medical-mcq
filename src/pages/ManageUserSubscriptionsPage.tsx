"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, AlertTriangle, Loader2, RefreshCcw, Search, Filter } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from '@/components/SessionContextProvider';
import { format } from 'date-fns';

interface UserSubscription {
  id: string;
  user_id: string;
  status: string;
  start_date: string;
  end_date: string;
  stripe_subscription_id: string | null;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  subscription_tiers: {
    name: string;
    price: number;
    currency: string;
  } | null;
}

const ManageUserSubscriptionsPage = () => {
  const { hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSubscriptions = async () => {
    setIsPageLoading(true);
    let query = supabase
      .from('user_subscriptions')
      .select(`
        *,
        profiles (first_name, last_name, email),
        subscription_tiers (name, price, currency)
      `)
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Error", description: "Failed to load subscriptions.", variant: "destructive" });
    } else {
      // Client-side search filtering because deep relation filtering is complex in Supabase JS
      let filtered = (data as any[]).map(sub => {
         // Manually fetch email if not in profile (older users)
         return sub;
      });

      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        filtered = filtered.filter(sub => 
            sub.profiles?.email?.toLowerCase().includes(lowerTerm) || 
            sub.profiles?.first_name?.toLowerCase().includes(lowerTerm) ||
            sub.profiles?.last_name?.toLowerCase().includes(lowerTerm) ||
            sub.stripe_subscription_id?.toLowerCase().includes(lowerTerm)
        );
      }
      setSubscriptions(filtered);
    }
    setIsPageLoading(false);
  };

  useEffect(() => {
    if (hasCheckedInitialSession) fetchSubscriptions();
  }, [hasCheckedInitialSession, statusFilter]); // Refetch on status filter change

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
        if (hasCheckedInitialSession) fetchSubscriptions();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleRefund = async (sub: UserSubscription) => {
    if (!window.confirm(`⚠️ REFUND WARNING ⚠️\n\nThis will:\n1. Immediately refund the last payment in Stripe.\n2. Cancel the Stripe subscription.\n3. Revoke user access immediately.\n\nAre you sure you want to refund ${sub.profiles?.email}?`)) {
        return;
    }

    setIsProcessing(true);
    try {
        const { data, error } = await supabase.functions.invoke('admin-refund-subscription', {
            body: { subscription_id: sub.id }
        });

        if (error || data?.error) throw new Error(error?.message || data?.error);

        toast({ 
            title: "Refund Processed", 
            description: data.details || "Subscription cancelled and refunded."
        });
        fetchSubscriptions();
    } catch (e: any) {
        toast({ title: "Refund Failed", description: e.message, variant: "destructive" });
    } finally {
        setIsProcessing(false);
    }
  };

  const columns: ColumnDef<UserSubscription>[] = [
    {
      id: "user",
      header: "User",
      cell: ({ row }) => {
        const p = row.original.profiles;
        return (
          <div>
            <p className="font-bold text-sm">{p?.first_name} {p?.last_name}</p>
            <p className="text-xs text-muted-foreground">{p?.email || "Email Hidden"}</p>
          </div>
        );
      }
    },
    {
      id: "plan",
      header: "Plan Details",
      cell: ({ row }) => {
        const t = row.original.subscription_tiers;
        return (
          <div>
            <Badge variant="outline" className="text-[10px] uppercase font-black">{t?.name || "Unknown Plan"}</Badge>
            <p className="text-xs mt-1 font-mono text-muted-foreground">
                {t ? `${t.currency} ${t.price}` : 'N/A'}
            </p>
          </div>
        );
      }
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const s = row.original.status;
            const variant = s === 'active' ? 'default' : s === 'refunded' ? 'destructive' : 'secondary';
            return <Badge variant={variant} className="capitalize">{s}</Badge>;
        }
    },
    {
        id: "dates",
        header: "Billing Cycle",
        cell: ({ row }) => (
            <div className="text-xs text-muted-foreground">
                <p>Start: {format(new Date(row.original.start_date), 'MMM dd, yyyy')}</p>
                <p>End: {format(new Date(row.original.end_date), 'MMM dd, yyyy')}</p>
            </div>
        )
    },
    {
        id: "gateway",
        header: "Gateway ID",
        cell: ({ row }) => (
            <div className="font-mono text-[10px] text-muted-foreground" title={row.original.stripe_subscription_id || ''}>
                {row.original.stripe_subscription_id ? row.original.stripe_subscription_id.substring(0, 12) + '...' : 'Manual/Free'}
            </div>
        )
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem 
                onClick={() => navigator.clipboard.writeText(row.original.stripe_subscription_id || '')}
                disabled={!row.original.stripe_subscription_id}
            >
                Copy Stripe ID
            </DropdownMenuItem>
            {row.original.status === 'active' && (
                <DropdownMenuItem onClick={() => handleRefund(row.original)} className="text-red-600 font-bold focus:text-red-700">
                    <AlertTriangle className="mr-2 h-4 w-4" /> Refund & Revoke
                </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (!hasCheckedInitialSession) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Active Subscriptions</h1>
            <p className="text-muted-foreground">Monitor revenue, expiry dates, and process refunds.</p>
        </div>
        <Button onClick={fetchSubscriptions} variant="outline" size="sm" disabled={isPageLoading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${isPageLoading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="border-b bg-muted/40 pb-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex items-center gap-2 flex-1">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by email, name or ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-sm bg-white"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px] bg-white">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active Only</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="refunded">Refunded</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="all">All Records</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <DataTable columns={columns} data={subscriptions} pageSize={20} />
        </CardContent>
      </Card>
    </div>
  );
};

export default ManageUserSubscriptionsPage;