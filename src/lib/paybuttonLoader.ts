const PAYBUTTON_SOURCES = [
  "https://cdn.jsdelivr.net/npm/@paybutton/paybutton@5.4.0/dist/paybutton.js",
  "https://unpkg.com/@paybutton/paybutton@5.4.0/dist/paybutton.js",
  "https://unpkg.com/@paybutton/paybutton/dist/paybutton.js",
];

const SCRIPT_TIMEOUT_MS = 8000;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PayButton) {
      resolve();
      return;
    }

    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");

    const cleanup = () => {
      window.clearTimeout(timeout);
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };

    const handleLoad = () => {
      script.dataset.loaded = "true";
      cleanup();
      window.PayButton ? resolve() : reject(new Error(`PayButton missing after loading ${src}`));
    };

    const handleError = () => {
      cleanup();
      if (!existing) script.remove();
      reject(new Error(`Failed to load ${src}`));
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      if (!existing) script.remove();
      reject(new Error(`Timed out loading ${src}`));
    }, SCRIPT_TIMEOUT_MS);

    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);

    if (!existing) {
      script.src = src;
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

export async function ensurePayButtonLoaded(): Promise<void> {
  if (window.PayButton) return;

  const errors: string[] = [];
  for (const src of PAYBUTTON_SOURCES) {
    try {
      await loadScript(src);
      return;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(`Payment widget could not load. ${errors[errors.length - 1] ?? "Please try again."}`);
}