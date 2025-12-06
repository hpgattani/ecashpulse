import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Coins, Users, Vote, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const TOKEN_ID = 'f8587c2a05d09228d4516339823ef838cf31a74ee32b136290d1d236ee276fc7';
const CASHTAB_URL = `https://cashtab.com/#/token/${TOKEN_ID}`;

const Token = () => {
  const features = [
    {
      icon: Vote,
      title: 'Governance Rights',
      description: 'Vote on platform decisions, new market categories, and protocol upgrades.',
    },
    {
      icon: Coins,
      title: 'Fee Discounts',
      description: 'Hold tokens to receive reduced trading fees on all prediction markets.',
    },
    {
      icon: Shield,
      title: 'Staking Rewards',
      description: 'Stake your tokens to earn a share of platform fees and rewards.',
    },
    {
      icon: Users,
      title: 'Community Access',
      description: 'Exclusive access to community events, early features, and airdrops.',
    },
  ];

  return (
    <>
      <Helmet>
        <title>PULSE Token - eCash Pulse Governance Token</title>
        <meta
          name="description"
          content="PULSE is the governance and utility token for eCash Pulse prediction markets. Vote on proposals, earn rewards, and shape the future of decentralized predictions."
        />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/30">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16 md:h-20">
              <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Markets</span>
              </Link>
              <Button asChild variant="glow" size="sm">
                <a href={CASHTAB_URL} target="_blank" rel="noopener noreferrer" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  View on Cashtab
                </a>
              </Button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="pt-32 pb-16 md:pt-40 md:pb-24">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-3xl mx-auto"
            >
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Zap className="w-12 h-12 text-primary-foreground" />
                  </div>
                  <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-2xl" />
                </div>
              </div>
              
              <Badge variant="secondary" className="mb-4">
                eToken on eCash
              </Badge>
              
              <h1 className="font-display text-4xl md:text-6xl font-bold text-foreground mb-4">
                PULSE <span className="text-primary">Token</span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground mb-8">
                The governance and utility token powering eCash Pulse prediction markets. 
                Shape the future of decentralized predictions.
              </p>

              <div className="flex flex-wrap justify-center gap-4">
                <Button asChild size="lg" className="gap-2">
                  <a href={CASHTAB_URL} target="_blank" rel="noopener noreferrer">
                    <Coins className="w-5 h-5" />
                    Get PULSE Token
                  </a>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/">Explore Markets</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Token Info */}
        <section className="py-16 border-t border-border/30">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="glass-card border-border/30 mb-12">
                <CardHeader>
                  <CardTitle>Token Details</CardTitle>
                  <CardDescription>Official PULSE token information</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground mb-1 md:mb-0">Token ID</span>
                      <code className="text-xs md:text-sm font-mono text-foreground break-all">
                        {TOKEN_ID}
                      </code>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground">Token Type</span>
                      <span className="font-medium text-foreground">eToken (SLP)</span>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground">Network</span>
                      <span className="font-medium text-foreground">eCash (XEC)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Features Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">
                Token Utility
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
                  >
                    <Card className="glass-card border-border/30 h-full hover:border-primary/50 transition-colors">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <feature.icon className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                              {feature.title}
                            </h3>
                            <p className="text-muted-foreground">
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 border-t border-border/30">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-center"
            >
              <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                Acquire PULSE tokens through Cashtab wallet and join the eCash Pulse community.
              </p>
              <Button asChild size="lg" className="gap-2">
                <a href={CASHTAB_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-5 h-5" />
                  Open in Cashtab
                </a>
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 border-t border-border/30">
          <div className="container mx-auto px-4 text-center">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              ← Back to eCash Pulse
            </Link>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Token;
