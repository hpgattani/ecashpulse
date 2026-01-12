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
      toastOptions={{
        classNames: {
          toast:
            "group toast w-[min(92vw,440px)] border-none bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-2xl backdrop-blur-xl rounded-lg px-4 py-3",
          title: "font-display text-sm font-semibold leading-tight",
          description: "text-primary-foreground/85 text-xs leading-snug",
          actionButton:
            "bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25",
          cancelButton: "bg-primary-foreground/10 text-primary-foreground/80",
          success: "from-primary to-accent",
          error: "from-destructive to-accent",
        },
        duration: 6500,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
