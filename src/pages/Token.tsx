import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy, Coins, TrendingUp, Users, Shield } from "lucide-react";
import { toast } from "sonner";
import xpulseLogo from "@/assets/xpulse-logo.jpg";

const TOKEN_ID = "2d9064b3dcd32abf3f682a79e6cc1c7614f1092299d8a66877829faaa2f68680";
const CASHTAB_URL = `https://cashtab.com/#/token/${TOKEN_ID}`;

const Token = () => {
  const copyTokenId = () => {
    navigator.clipboard.writeText(TOKEN_ID);
    toast.success("Token ID copied to clipboard!");
  };

  return (
    <>
      <Helmet>
        <title>$XPULSE Token | eCash Pulse</title>
        <meta name="description" content="$XPULSE is the official eToken of eCash Pulse. Fund the platform and earn future revenue sharing." />
      </Helmet>

      <Header />

      <main className="min-h-screen pt-24 md:pt-28 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center mb-12"
          >
            <motion.img
              src={xpulseLogo}
              alt="XPULSE Token Logo"
              className="w-28 h-28 md:w-36 md:h-36 rounded-2xl shadow-xl mb-6"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            />
            <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-2">
              <span className="text-primary">$XPULSE</span> Token
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              The official eToken powering the eCash Pulse prediction market platform
            </p>
          </motion.div>

          {/* Price Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-2xl p-6 md:p-8 mb-8 border border-primary/20"
          >
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Launch Price</p>
                <p className="text-4xl md:text-5xl font-display font-bold text-primary">5.46 XEC</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Introductory price for the first 2 months · Price hike planned
                </p>
              </div>
              <div className="text-center md:text-right">
                <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Total Supply</p>
                <p className="text-2xl md:text-3xl font-display font-bold text-foreground">500,000,000</p>
                <p className="text-sm text-muted-foreground mt-1">500M $XPULSE</p>
              </div>
              <div className="flex flex-col gap-3">
                <Button size="lg" className="gap-2" asChild>
                  <a href={CASHTAB_URL} target="_blank" rel="noopener noreferrer">
                    <Coins className="w-5 h-5" />
                    Buy on Cashtab
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {[
              {
                icon: TrendingUp,
                title: "Platform Funding",
                desc: "All proceeds go directly to funding eCash Pulse development and operations.",
              },
              {
                icon: Users,
                title: "Revenue Sharing",
                desc: "Token holders will receive revenue sharing once the decentralised escrow is built.",
              },
              {
                icon: Shield,
                title: "eCash eToken",
                desc: "Built on the eCash blockchain as a native ALP ⛰️ eToken with full on-chain transparency.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="glass-card rounded-xl p-6 border border-border/30"
              >
                <item.icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-display font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Token ID */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card rounded-xl p-6 border border-border/30"
          >
            <p className="text-sm text-muted-foreground mb-2">eToken ID</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs md:text-sm font-mono text-foreground bg-muted/50 rounded-lg px-3 py-2 overflow-x-auto">
                {TOKEN_ID}
              </code>
              <Button variant="outline" size="icon" onClick={copyTokenId} title="Copy Token ID">
                <Copy className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" asChild title="View on Cashtab">
                <a href={CASHTAB_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default Token;
