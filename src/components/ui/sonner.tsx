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
          width: 28px;
          height: 28px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          backdrop-filter: blur(8px);
          animation: check-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s forwards;
          opacity: 0;
          transform: scale(0.5);
        }
        .toast-check-icon {
          color: white;
          animation: check-draw 0.4s ease-out 0.4s forwards;
          stroke-dasharray: 24;
          stroke-dashoffset: 24;
        }
        @keyframes check-pop {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          100% {
            opacity: 1;
            transform: scale(1);
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
              "group toast w-[min(92vw,360px)] border border-white/20 bg-gradient-to-br from-primary/90 via-primary/80 to-accent/90 text-white shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.1)_inset,0_2px_8px_rgba(255,255,255,0.1)_inset] backdrop-blur-2xl backdrop-saturate-150 rounded-[20px] px-7 py-6 text-center",
            title: "text-lg font-semibold leading-tight text-white tracking-tight",
            description: "text-white/90 text-sm font-medium mt-2 tracking-wide",
            actionButton:
              "bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm rounded-full",
            cancelButton: "bg-white/10 text-white/80 rounded-full",
            success: "from-primary/90 via-primary/80 to-accent/90",
            error: "from-destructive/90 to-accent/90",
          },
          duration: 5500,
        }}
        {...props}
      />
    </>
  );
};

export { Toaster, toast };
