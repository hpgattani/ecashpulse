import { useEffect, useState } from "react";
import { ShieldCheck, X } from "lucide-react";

const STORAGE_KEY = "security-banner-aes-gcm-v1-dismissed";

export const SecurityAnnouncementBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "1") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div className="relative w-full border-b border-white/10 bg-gradient-to-r from-teal-500/15 via-purple-500/15 to-teal-500/15 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2 pr-12 sm:px-4">
        <ShieldCheck className="h-4 w-4 shrink-0 text-teal-300" aria-hidden />
        <p className="text-xs leading-snug text-foreground/90 sm:text-sm">
          <span className="font-semibold">Security upgrade:</span>{" "}
          Escrow keys are now encrypted at rest with AES-256-GCM.{" "}
          <span className="hidden sm:inline">P2SH multisig escrow coming next.</span>
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss security announcement"
        className="absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-md text-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default SecurityAnnouncementBanner;
