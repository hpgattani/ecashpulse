import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { LightModeOrbs } from "@/components/LightModeOrbs";

import Index from "./pages/Index";
import AwaitingResolutionPage from "./pages/AwaitingResolution";
import Auth from "./pages/Auth";
import MyBets from "./pages/MyBets";
import Admin from "./pages/Admin";
import Prediction from "./pages/Prediction";
import CreatePrediction from "./pages/CreatePrediction";
import Stats from "./pages/Stats";
import Sentiment from "./pages/Sentiment";
import Raffle from "./pages/Raffle";
import Games from "./pages/Games";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <div className="relative min-h-screen">
              {/* Global background */}
              <LightModeOrbs />

              {/* All app UI must sit above the background */}
              <div className="relative z-10">
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/awaiting" element={<AwaitingResolutionPage />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/my-bets" element={<MyBets />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/prediction/:id" element={<Prediction />} />
                    <Route path="/create-prediction" element={<CreatePrediction />} />
                    <Route path="/stats" element={<Stats />} />
                    <Route path="/sentiment" element={<Sentiment />} />
                    <Route path="/raffle" element={<Raffle />} />
                    <Route path="/games" element={<Games />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </div>
            </div>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
