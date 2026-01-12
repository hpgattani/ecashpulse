// Re-export sonner toast for backward compatibility
import { toast } from "sonner";

// Stub useToast for components that may still import it
const useToast = () => ({
  toast: (props: { title?: string; description?: string; variant?: string }) => {
    if (props.variant === "destructive") {
      toast.error(props.title, { description: props.description });
    } else {
      toast.success(props.title, { description: props.description });
    }
  },
  dismiss: () => {},
  toasts: [],
});

export { useToast, toast };
