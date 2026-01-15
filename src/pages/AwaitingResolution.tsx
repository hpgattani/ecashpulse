import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AwaitingResolutionSection from "@/components/AwaitingResolutionSection";

const AwaitingResolutionPage = () => {
  return (
    <>
      <Helmet>
        <title>Awaiting Resolution | eCash Pulse</title>
        <meta
          name="description"
          content="Markets where betting has closed and results are pending verification."
        />
        <link rel="canonical" href={`${window.location.origin}/awaiting`} />
      </Helmet>

      <div className="min-h-screen">
        <Header />
        <main className="container mx-auto px-4 pt-24 pb-12">
          <div className="glass-card p-4 md:p-6">
            <AwaitingResolutionSection embedded />
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default AwaitingResolutionPage;
