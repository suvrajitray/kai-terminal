import { toast as sonner } from "sonner";

// Wrapper that formats toasts with a type title + message description,
// matching the left-border card design in sonner.tsx.
export const toast = {
  error:   (msg: string) => sonner.error("Error",   { description: msg }),
  success: (msg: string) => sonner.success("Success", { description: msg }),
  warning: (msg: string) => sonner.warning("Warning", { description: msg }),
  info:    (msg: string) => sonner.info("Info",     { description: msg }),
  loading: (msg: string, opts?: Parameters<typeof sonner.loading>[1]) => sonner.loading(msg, opts),
  promise: sonner.promise.bind(sonner),
  dismiss: sonner.dismiss.bind(sonner),
};
