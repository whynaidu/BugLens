import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}

export function useToast() {
  const toast = (options: ToastOptions) => {
    if (options.variant === "destructive") {
      sonnerToast.error(options.title, {
        description: options.description,
        duration: options.duration,
      });
    } else {
      sonnerToast.success(options.title, {
        description: options.description,
        duration: options.duration,
      });
    }
  };

  return { toast };
}

export { sonnerToast as toast };
