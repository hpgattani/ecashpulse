import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, TrendingDown, ExternalLink, Users, DollarSign, Clock, CheckCircle2, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface BetWithDetails {
  id: string;
  amount: number;
  position: 'yes' | 'no';
  status: string;
  tx_hash: string | null;
  created_at: string;
  confirmed_at: string | null;
  user_id: string;
  prediction_id: string;
  users: {
    ecash_address: string;
  } | null;
  predictions: {
    title: string;
    category: string;
  } | null;
}

interface UserWithProfile {
  id: string;
  ecash_address: string;
  created_at: string;
  last_login_at: string | null;
  profiles: {
    display_name: string | null;
    bio: string | null;
    total_bets: number | null;
    total_volume: number | null;
    total_wins: number | null;
  } | null;
}

const Admin = () => {
  const [bets, setBets] = useState<BetWithDetails[]>([]);
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    checkAdminStatus();
  }, [user, navigate]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) throw error;
      setIsAdmin(!!data);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setCheckingAdmin(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAllBets();
      fetchAllUsers();
      
      const channel = supabase
        .channel('admin-bets')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bets' }, () => {
          fetchAllBets();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
          fetchAllUsers();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAdmin]);

  const fetchAllBets = async () => {
    try {
      const { data, error } = await supabase
        .from('bets')
        .select(`
          *,
          users(ecash_address),
          predictions(title, category)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBets((data as BetWithDetails[]) || []);
    } catch (error) {
      console.error('Error fetching bets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          profiles(display_name, bio, total_bets, total_volume, total_wins)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers((data as UserWithProfile[]) || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setUsersLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    if (address.length <= 20) return address;
    return `${address.slice(0, 12)}...${address.slice(-8)}`;
  };

  const formatAmount = (satoshis: number) => {
    return (satoshis / 100).toLocaleString() + ' XEC';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-emerald-500/20 text-emerald-400"><CheckCircle2 className="w-3 h-3 mr-1" />Confirmed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'won':
        return <Badge className="bg-primary/20 text-primary">Won</Badge>;
      case 'lost':
        return <Badge className="bg-red-500/20 text-red-400">Lost</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Stats
  const totalBets = bets.length;
  const totalVolume = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const confirmedBets = bets.filter(b => b.status === 'confirmed').length;
  const uniqueUsers = new Set(bets.map(b => b.user_id)).size;

  if (checkingAdmin || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Helmet>
          <title>Access Denied - eCash Pulse</title>
        </Helmet>
        <div className="min-h-screen bg-background">
          <Header />
          <main className="py-20 px-4">
            <div className="max-w-md mx-auto text-center">
              <div className="glass-card p-8">
                <Shield className="w-16 h-16 text-destructive mx-auto mb-4" />
                <h1 className="font-display text-2xl font-bold text-foreground mb-2">Access Denied</h1>
                <p className="text-muted-foreground mb-6">You don't have admin privileges to view this page.</p>
                <Button onClick={() => navigate('/')}>Back to Home</Button>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Admin Dashboard - eCash Pulse</title>
        <meta name="description" content="Admin dashboard for eCash Pulse prediction market" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />
        <main className="py-8 px-4">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <Button variant="ghost" onClick={() => navigate('/')} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                  Admin Dashboard
                </h1>
                <p className="text-muted-foreground text-sm">View all bets and user activity</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4"
              >
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <TrendingUp className="w-4 h-4" />
                  Total Bets
                </div>
                <div className="text-2xl font-bold text-foreground">{totalBets}</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-4"
              >
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <DollarSign className="w-4 h-4" />
                  Total Volume
                </div>
                <div className="text-2xl font-bold text-foreground">{formatAmount(totalVolume)}</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-4"
              >
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmed
                </div>
                <div className="text-2xl font-bold text-foreground">{confirmedBets}</div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card p-4"
              >
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                  <Users className="w-4 h-4" />
                  Total Users
                </div>
                <div className="text-2xl font-bold text-foreground">{users.length}</div>
              </motion.div>
            </div>

            {/* Tabs for Bets and Users */}
            <Tabs defaultValue="bets" className="space-y-4">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="bets" className="gap-2">
                  <TrendingUp className="w-4 h-4" />
                  All Bets
                </TabsTrigger>
                <TabsTrigger value="users" className="gap-2">
                  <Users className="w-4 h-4" />
                  All Users
                </TabsTrigger>
              </TabsList>

              <TabsContent value="bets">
                <div className="glass-card overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <h2 className="font-display font-bold text-lg text-foreground">All Bets</h2>
                  </div>
                  
                  {loading ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                    </div>
                  ) : bets.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No bets yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/30">
                          <tr className="text-left text-sm text-muted-foreground">
                            <th className="p-4">Position</th>
                            <th className="p-4">Amount</th>
                            <th className="p-4">Prediction</th>
                            <th className="p-4">User Wallet</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Date</th>
                            <th className="p-4">TX Hash</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {bets.map((bet, index) => (
                            <motion.tr
                              key={bet.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: index * 0.02 }}
                              className="hover:bg-muted/20"
                            >
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  {bet.position === 'yes' ? (
                                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <TrendingDown className="w-4 h-4 text-red-400" />
                                  )}
                                  <span className={`font-semibold ${bet.position === 'yes' ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {bet.position.toUpperCase()}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 font-medium text-foreground">
                                {formatAmount(bet.amount)}
                              </td>
                              <td className="p-4">
                                <div className="max-w-xs">
                                  <p className="text-foreground text-sm truncate">{bet.predictions?.title || 'Unknown'}</p>
                                  <Badge variant="outline" className="mt-1 text-xs">{bet.predictions?.category || 'N/A'}</Badge>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="font-mono text-xs text-muted-foreground">
                                  {bet.users ? formatAddress(bet.users.ecash_address) : 'Unknown'}
                                </span>
                              </td>
                              <td className="p-4">{getStatusBadge(bet.status)}</td>
                              <td className="p-4 text-sm text-muted-foreground">
                                {formatDate(bet.created_at)}
                              </td>
                              <td className="p-4">
                                {bet.tx_hash ? (
                                  <a
                                    href={`https://explorer.e.cash/tx/${bet.tx_hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-primary hover:underline text-xs font-mono"
                                  >
                                    {bet.tx_hash.slice(0, 8)}...
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="users">
                <div className="glass-card overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <h2 className="font-display font-bold text-lg text-foreground">All Users</h2>
                  </div>
                  
                  {usersLoading ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                    </div>
                  ) : users.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No users yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/30">
                          <tr className="text-left text-sm text-muted-foreground">
                            <th className="p-4">User</th>
                            <th className="p-4">eCash Address</th>
                            <th className="p-4">Bio</th>
                            <th className="p-4">Total Bets</th>
                            <th className="p-4">Total Volume</th>
                            <th className="p-4">Wins</th>
                            <th className="p-4">Joined</th>
                            <th className="p-4">Last Login</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {users.map((u, index) => (
                            <motion.tr
                              key={u.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: index * 0.02 }}
                              className="hover:bg-muted/20"
                            >
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                    <User className="w-4 h-4 text-primary" />
                                  </div>
                                  <span className="font-medium text-foreground">
                                    {u.profiles?.display_name || 'Anonymous'}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="font-mono text-xs text-muted-foreground">
                                  {u.ecash_address}
                                </span>
                              </td>
                              <td className="p-4">
                                <p className="text-sm text-muted-foreground max-w-xs truncate">
                                  {u.profiles?.bio || '-'}
                                </p>
                              </td>
                              <td className="p-4 text-foreground">
                                {u.profiles?.total_bets || 0}
                              </td>
                              <td className="p-4 text-foreground">
                                {formatAmount(u.profiles?.total_volume || 0)}
                              </td>
                              <td className="p-4 text-foreground">
                                {u.profiles?.total_wins || 0}
                              </td>
                              <td className="p-4 text-sm text-muted-foreground">
                                {formatDate(u.created_at)}
                              </td>
                              <td className="p-4 text-sm text-muted-foreground">
                                {u.last_login_at ? formatDate(u.last_login_at) : '-'}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Admin;