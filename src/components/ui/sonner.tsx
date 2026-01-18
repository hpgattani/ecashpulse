import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";
import { Check } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Custom success toast with animated checkmark
const toast = {
  ...sonnerToast,
  success: (title: string, options?: Parameters<typeof sonnerToast.success>[1]) => {
    return sonnerToast.success(title, {
      ...options,
      icon: (
        <div className="toast-check-container">
          <Check className="toast-check-icon" size={22} strokeWidth={3} />
        </div>
      ),
    });
  },
};

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <>
      <style>{`
        .sonner-toast {
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif !important;
        }
        .sonner-toast[data-mounted="true"] {
          animation: toast-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .sonner-toast[data-removed="true"] {
          animation: toast-fade-out 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes toast-slide-up {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes toast-fade-out {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
        }
        .toast-check-container {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.1) 100%);
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          backdrop-filter: blur(12px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.2);
          animation: check-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards;
          opacity: 0;
          transform: scale(0.5);
        }
        .toast-check-icon {
          color: white;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
          animation: check-draw 0.4s ease-out 0.35s forwards;
          stroke-dasharray: 24;
          stroke-dashoffset: 24;
        }
        @keyframes check-pop {
          0% {
            opacity: 0;
            transform: scale(0.5) rotate(-10deg);
          }
          70% {
            transform: scale(1.1) rotate(2deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
        @keyframes check-draw {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
        position="bottom-center"
        offset={40}
        toastOptions={{
          classNames: {
            toast:
              "group toast w-[min(92vw,380px)] border border-white/25 bg-gradient-to-br from-emerald-600/95 via-teal-600/90 to-cyan-700/85 text-white shadow-[0_12px_40px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.15)_inset,0_2px_12px_rgba(255,255,255,0.12)_inset] backdrop-blur-2xl backdrop-saturate-150 rounded-2xl px-6 py-5",
            title: "text-base font-semibold leading-tight text-white tracking-tight",
            description: "text-white/95 text-sm font-medium mt-1.5",
            actionButton:
              "bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm rounded-full",
            cancelButton: "bg-white/10 text-white/80 rounded-full",
            success: "from-emerald-600/95 via-teal-600/90 to-cyan-700/85",
            error: "from-red-600/95 via-red-500/90 to-rose-600/85",
          },
          duration: 4000,
        }}
        {...props}
      />
    </>
  );
};

export { Toaster, toast };
