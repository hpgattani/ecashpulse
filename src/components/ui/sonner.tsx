import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group !fixed !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast w-[min(92vw,320px)] border-none bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-2xl backdrop-blur-xl rounded-lg px-5 py-4 text-center",
          title: "font-display text-base font-bold leading-tight",
          description: "text-primary-foreground/90 text-sm font-medium mt-1",
          actionButton:
            "bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25",
          cancelButton: "bg-primary-foreground/10 text-primary-foreground/80",
          success: "from-primary to-accent",
          error: "from-destructive to-accent",
        },
        duration: 4000,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
