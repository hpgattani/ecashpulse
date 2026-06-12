import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { Tv, Maximize2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const STREAMS = [
  { id: "HM", label: "HM Sports" },
  { id: "D1", label: "D Sports" },
  { id: "CZE2", label: "Craze TV Brasil" },
  { id: "ZHINDI", label: "ZEE" },
];

const Watch = () => {
  const { user, loading } = useAuth();
  const [channel, setChannel] = useState("HM");


  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!user) {
    sessionStorage.setItem("auth_return_url", "/watch");
    return <Navigate to="/auth" replace />;
  }

  const src = `https://tushar-stream-liart.vercel.app/?id=${channel}`;

  const goFullscreen = () => {
    const el = document.getElementById("watch-iframe") as HTMLIFrameElement | null;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
  };

  return (
    <>
      <Helmet>
        <title>Watch Live Sports | eCash Pulse</title>
        <meta name="description" content="Watch live sports streams free for logged-in eCash Pulse users." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 pt-24 pb-16">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-3">
              <Tv className="w-5 h-5" />
              <span className="text-sm font-medium">Live Stream</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Live Sports Streams
            </h1>
            <p className="text-muted-foreground text-sm">Free for logged-in members. Pick a channel below.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {STREAMS.map((s) => (
              <Button
                key={s.id}
                size="sm"
                variant={channel === s.id ? "default" : "outline"}
                onClick={() => setChannel(s.id)}
              >
                {s.label}
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={goFullscreen} className="gap-1">
              <Maximize2 className="w-4 h-4" /> Fullscreen
            </Button>
          </div>

          <div className="glass-card p-2 rounded-2xl overflow-hidden">
            <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
              <iframe
                id="watch-iframe"
                key={channel}
                src={src}
                className="absolute inset-0 w-full h-full rounded-xl border-0 bg-black"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups-to-escape-sandbox"
                title="Live Sports Stream"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Stream provided by a third-party source. eCash Pulse does not host the video.
          </p>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Watch;
