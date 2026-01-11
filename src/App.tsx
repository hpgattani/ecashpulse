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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <LightModeOrbs />
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
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
