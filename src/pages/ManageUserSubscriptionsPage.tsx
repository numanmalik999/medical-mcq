"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { ShieldAlert, Loader2, RefreshCcw, Search, Filter, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from '@/components/SessionContextProvider';
import { format, isPast, parseISO } from 'date-fns';

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
    email?: string | null;
  } | null;
  subscription_tiers: {
    name: string;
    price: number;
    currency: string;
  } | null;
  user_email?: string | null;
}

const ManageUserSubscriptionsPage = () => {
  const { hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSubscriptions = async () => {
    setIsPageLoading(true);
    
    let query = supabase
      .from('user_subscriptions')
      .select(`
        *,
        subscription_tiers (name, price, currency)
      `)
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error("Fetch error:", error);
      toast({ title: "Error", description: "Failed to load subscriptions.", variant: "destructive" });
      setIsPageLoading(false);
      return;
    } 
    
    let subsData = data as unknown as UserSubscription[];
    const userIds = Array.from(new Set(subsData.map(s => s.user_id)));

    if (userIds.length > 0) {
        try {
            const { data: profilesWithEmail, error: profilesError } = await supabase.functions.invoke('get-public-profiles', {
                body: { user_ids: userIds }
            });

            if (!profilesError && profilesWithEmail) {
                const userMap = new Map<string, { first_name: string, last_name: string, email: string }>(
                    profilesWithEmail.map((p: any) => [p.id, p])
                );
                
                subsData = subsData.map(sub => {
                    const userDetails = userMap.get(sub.user_id);
                    return {
                        ...sub,
                        user_email: userDetails?.email || null,
                        profiles: {
                            first_name: userDetails?.first_name || null,
                            last_name: userDetails?.last_name || null,
                            email: userDetails?.email || null
                        }
                    };
                });
            }
        } catch (e) {
            console.error("Error fetching user details:", e);
        }
    }

    if (statusFilter !== 'all') {
      subsData = subsData.filter(sub => {
          const expired = isPast(parseISO(sub.end_date));
          if (statusFilter === 'expired') return expired && sub.status === 'active';
          if (statusFilter === 'active') return !expired && sub.status === 'active';
          return sub.status === statusFilter;
      });
    }

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      subsData = subsData.filter(sub => 
          sub.user_email?.toLowerCase().includes(lowerTerm) || 
          sub.profiles?.first_name?.toLowerCase().includes(lowerTerm) ||
          sub.profiles?.last_name?.toLowerCase().includes(lowerTerm) ||
          sub.stripe_subscription_id?.toLowerCase().includes(lowerTerm)
      );
    }
    
    setSubscriptions(subsData);
    setIsPageLoading(false);
  };

  useEffect(() => {
    if (hasCheckedInitialSession) fetchSubscriptions();
  }, [hasCheckedInitialSession, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
        if (hasCheckedInitialSession) fetchSubscriptions();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleRevoke = async (sub: UserSubscription) => {
    if (!window.confirm(`⚠️ REVOKE ACCESS ⚠️\n\nThis will immediately disable premium access for ${sub.user_email || 'this user'}.\n\nContinue?`)) {
        return;
    }

    try {
        // Direct DB Update (works because RLS is disabled)
        const { error: subError } = await supabase
            .from('user_subscriptions')
            .update({ 
                status: 'expired', 
                end_date: new Date().toISOString() 
            })
            .eq('id', sub.id);

        if (subError) throw subError;

        // Try direct profile update
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ has_active_subscription: false })
            .eq('id', sub.user_id);
            
        // If profile update fails due to RLS, fallback to the edge function that handles status updates
        if (profileError) {
            await supabase.functions.invoke('update-expired-subscription-status', {
                body: { user_id: sub.user_id, is_active: false }
            });
        }

        toast({ title: "Access Revoked", description: "User access has been updated successfully." });
        fetchSubscriptions();
    } catch (e: any) {
        toast({ title: "Operation Failed", description: e.message, variant: "destructive" });
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
            <p className="font-bold text-sm">{p?.first_name || 'Unknown'} {p?.last_name || ''}</p>
            <p className="text-xs text-muted-foreground">{row.original.user_email || "Email Hidden"}</p>
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
        header: "Status Audit",
        cell: ({ row }) => {
            const sub = row.original;
            const expired = isPast(parseISO(sub.end_date));
            
            if (sub.status === 'active' && expired) {
                return (
                    <Badge variant="destructive" className="gap-1.5 bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">
                        <AlertTriangle className="h-3 w-3" /> Expired
                    </Badge>
                );
            }

            if (sub.status === 'active') {
                return (
                    <Badge variant="default" className="gap-1.5 bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                        <CheckCircle2 className="h-3 w-3" /> Active
                    </Badge>
                );
            }

            return <Badge variant="secondary" className="capitalize">{sub.status}</Badge>;
        }
    },
    {
        id: "dates",
        header: "Billing Cycle",
        cell: ({ row }) => (
            <div className="text-xs text-muted-foreground">
                <p className="flex items-center gap-1"><Clock className="h-3 w-3 opacity-40" /> {format(new Date(row.original.end_date), 'MMM dd, yyyy')}</p>
            </div>
        )
    },
    {
      id: "actions",
      header: "Admin Actions",
      cell: ({ row }) => {
        const sub = row.original;
        const expired = isPast(parseISO(sub.end_date));
        
        // Only show revoke if it's marked active AND has not yet reached its end date
        if (sub.status !== 'active' || expired) return null;

        return (
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => handleRevoke(sub)}
            className="h-8 rounded-lg font-bold uppercase text-[9px] tracking-tight"
          >
            <ShieldAlert className="mr-1.5 h-3 w-3" /> Revoke Access
          </Button>
        );
      },
    },
  ];

  if (!hasCheckedInitialSession) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter">Subscriber Audit</h1>
            <p className="text-muted-foreground font-medium">Verify credentials and manage active clinical access.</p>
        </div>
        <Button onClick={fetchSubscriptions} variant="outline" size="sm" disabled={isPageLoading} className="rounded-full">
            <RefreshCcw className={`mr-2 h-4 w-4 ${isPageLoading ? 'animate-spin' : ''}`} /> Sync Data
        </Button>
      </div>

      <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
        <CardHeader className="border-b bg-muted/40 pb-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="flex items-center gap-2 flex-1">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search practitioners..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-sm bg-white rounded-xl h-10 border-none shadow-inner"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[180px] bg-white rounded-xl h-10 border-none shadow-inner font-bold text-xs">
                            <SelectValue placeholder="Filter Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="active">Active Access</SelectItem>
                            <SelectItem value="expired">Expired Access</SelectItem>
                            <SelectItem value="inactive">Inactive / Revoked</SelectItem>
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