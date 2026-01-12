import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-gradient-to-r group-[.toaster]:from-[hsl(var(--primary))] group-[.toaster]:to-[hsl(270,60%,50%)] group-[.toaster]:text-white group-[.toaster]:border-none group-[.toaster]:shadow-2xl group-[.toaster]:text-base group-[.toaster]:px-6 group-[.toaster]:py-4 group-[.toaster]:min-h-[56px] group-[.toaster]:backdrop-blur-xl group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-white/90 group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-white/20 group-[.toast]:text-white group-[.toast]:hover:bg-white/30",
          cancelButton: "group-[.toast]:bg-white/10 group-[.toast]:text-white/80",
          success: "group-[.toaster]:from-emerald-500 group-[.toaster]:to-teal-500",
          error: "group-[.toaster]:from-red-500 group-[.toaster]:to-rose-600",
        },
        duration: 6500,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
