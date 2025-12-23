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
      expand={true}
      richColors
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:text-base group-[.toaster]:p-4 group-[.toaster]:min-h-[60px]",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:!bg-emerald-500/20 group-[.toaster]:!border-emerald-500/50 group-[.toaster]:!text-emerald-100",
          error: "group-[.toaster]:!bg-red-500/20 group-[.toaster]:!border-red-500/50 group-[.toaster]:!text-red-100",
        },
        duration: 5000,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
