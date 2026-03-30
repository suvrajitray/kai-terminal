import { toast as sonner } from "sonner";

// Wrapper that formats toasts with a type title + message description,
// matching the left-border card design in sonner.tsx.
type SonnerOpts = Parameters<typeof sonner.error>[1];

export const toast = {
  error:   (msg: string, opts?: SonnerOpts) => sonner.error("Error",   { description: msg, ...opts }),
  success: (msg: string, opts?: SonnerOpts) => sonner.success("Success", { description: msg, ...opts }),
  warning: (msg: string, opts?: SonnerOpts) => sonner.warning("Warning", { description: msg, ...opts }),
  info:    (msg: string, opts?: SonnerOpts) => sonner.info("Info",     { description: msg, ...opts }),
  loading: (msg: string, opts?: Parameters<typeof sonner.loading>[1]) => sonner.loading(msg, opts),
  promise: sonner.promise.bind(sonner),
  dismiss: sonner.dismiss.bind(sonner),
};
