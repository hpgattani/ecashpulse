import { useEffect, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";

const STORAGE_KEY = "security-banner-aes-gcm-v1-dismissed";
const CSS_VAR = "--security-banner-height";

const updateCssVar = (height: number) => {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(CSS_VAR, `${height}px`);
};

export const SecurityAnnouncementBanner = () => {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "1") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      updateCssVar(0);
      return;
    }

    const el = ref.current;
    if (!el) return;

    updateCssVar(el.getBoundingClientRect().height);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        updateCssVar(entry.contentRect.height);
      }
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [visible]);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    updateCssVar(0);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      ref={ref}
      className="fixed top-0 left-0 right-0 z-[60] w-full border-b border-white/10 bg-gradient-to-r from-teal-500/15 via-purple-500/15 to-teal-500/15 backdrop-blur-md pointer-events-none"
    >
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
        className="absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-md text-foreground/70 hover:text-foreground hover:bg-white/5 transition-colors pointer-events-auto"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default SecurityAnnouncementBanner;
