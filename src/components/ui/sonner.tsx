import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      offset={32}
      toastOptions={{
        classNames: {
          toast:
            "group toast w-[min(92vw,340px)] border-none bg-gradient-to-r from-primary to-accent text-white shadow-2xl backdrop-blur-xl rounded-xl px-6 py-5 text-center",
          title: "font-display text-lg font-bold leading-tight text-white",
          description: "text-white/95 text-sm font-semibold mt-1.5",
          actionButton:
            "bg-white/20 text-white hover:bg-white/30",
          cancelButton: "bg-white/10 text-white/80",
          success: "from-primary to-accent",
          error: "from-destructive to-accent",
        },
        duration: 5500,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
