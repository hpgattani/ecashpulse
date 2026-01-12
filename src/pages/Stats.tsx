import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { TrendingUp, Users, BarChart3, Trophy, Target, CheckCircle } from "lucide-react";

interface PlatformStats {
  totalBets: number;
  totalVolume: number;
  uniqueBettors: number;
  totalUsers: number;
  totalWon: number;
  totalPredictions: number;
  resolvedPredictions: number;
}

const formatXEC = (sats: number) => {
  const xec = sats / 100;
  if (xec >= 1_000_000) {
    return `${(xec / 1_000_000).toFixed(2)}M XEC`;
  }
  if (xec >= 1_000) {
    return `${(xec / 1_000).toFixed(1)}K XEC`;
  }
  return `${xec.toLocaleString()} XEC`;
};

export default function Stats() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-platform-stats');
        if (error) throw error;
        setStats(data);
      } catch (err: any) {
        console.error('Error fetching stats:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = stats ? [
    {
      title: "Total Volume",
      value: formatXEC(stats.totalVolume),
      description: "Total amount bet on the platform",
      icon: TrendingUp,
      gradient: "from-emerald-500/20 to-emerald-600/10",
      iconColor: "text-emerald-500",
    },
    {
      title: "Total Bets",
      value: stats.totalBets.toLocaleString(),
      description: "Number of bets placed",
      icon: BarChart3,
      gradient: "from-blue-500/20 to-blue-600/10",
      iconColor: "text-blue-500",
    },
    {
      title: "Amount Won",
      value: formatXEC(stats.totalWon),
      description: "Total payouts to winners",
      icon: Trophy,
      gradient: "from-amber-500/20 to-amber-600/10",
      iconColor: "text-amber-500",
    },
    {
      title: "Unique Bettors",
      value: stats.uniqueBettors.toLocaleString(),
      description: "Users who placed bets",
      icon: Users,
      gradient: "from-purple-500/20 to-purple-600/10",
      iconColor: "text-purple-500",
    },
    {
      title: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      description: "Registered users",
      icon: Users,
      gradient: "from-pink-500/20 to-pink-600/10",
      iconColor: "text-pink-500",
    },
    {
      title: "Predictions",
      value: stats.totalPredictions.toLocaleString(),
      description: `${stats.resolvedPredictions} resolved`,
      icon: Target,
      gradient: "from-cyan-500/20 to-cyan-600/10",
      iconColor: "text-cyan-500",
    },
  ] : [];

  return (
    <>
      <Helmet>
        <title>Platform Stats | eCash Pulse</title>
        <meta name="description" content="View platform-wide statistics for eCash Pulse prediction market." />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container mx-auto px-4 py-8 pt-24">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Platform Statistics
              </h1>
              <p className="text-muted-foreground text-lg">
                Real-time metrics from eCash Pulse prediction market
              </p>
            </div>

            {error && (
              <div className="text-center py-10">
                <p className="text-destructive">Failed to load stats: {error}</p>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-10 w-32 mb-2" />
                      <Skeleton className="h-3 w-40" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : stats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {statCards.map((stat, index) => (
                  <Card 
                    key={stat.title} 
                    className={`overflow-hidden border-0 bg-gradient-to-br ${stat.gradient} backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}
                  >
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </CardTitle>
                      <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold tracking-tight mb-1" style={{ color: 'white' }}>
                        {stat.value}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {stat.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}

            {stats && (
              <div className="mt-12 text-center">
                <Card className="inline-block px-8 py-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-primary" />
                    <div className="text-left">
                      <p className="font-semibold">Live Data</p>
                      <p className="text-sm text-muted-foreground">
                        Statistics updated in real-time from the blockchain
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </main>
        
        <Footer />
      </div>
    </>
  );
}
