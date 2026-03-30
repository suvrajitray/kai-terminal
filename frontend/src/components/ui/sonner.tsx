import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <>
      <style>{`
        /* ── Base toast ──────────────────────────────────────────────── */
        [data-sonner-toast] {
          background: var(--popover) !important;
          border: 1px solid color-mix(in oklch, var(--border) 50%, transparent) !important;
          border-left: 4px solid var(--border) !important;
          border-radius: var(--radius) !important;
          padding: 14px 16px !important;
          box-shadow: 0 4px 24px rgb(0 0 0 / 0.4) !important;
          gap: 0 !important;
        }

        /* ── Left border color per type ──────────────────────────────── */
        [data-sonner-toast][data-type="error"]   { border-left-color: hsl(var(--destructive)) !important; }
        [data-sonner-toast][data-type="success"] { border-left-color: #10b981 !important; }
        [data-sonner-toast][data-type="warning"] { border-left-color: #f59e0b !important; }
        [data-sonner-toast][data-type="info"]    { border-left-color: hsl(var(--primary)) !important; }
        [data-sonner-toast][data-type="loading"] { border-left-color: hsl(var(--muted-foreground)) !important; }

        /* ── Title ───────────────────────────────────────────────────── */
        [data-sonner-toast] [data-title] {
          font-size: 0.875rem !important;
          font-weight: 600 !important;
          color: var(--foreground) !important;
          line-height: 1.4 !important;
        }
        [data-sonner-toast][data-type="error"]   [data-title] { color: var(--destructive) !important; }
        [data-sonner-toast][data-type="success"] [data-title] { color: #10b981 !important; }
        [data-sonner-toast][data-type="warning"] [data-title] { color: #f59e0b !important; }
        [data-sonner-toast][data-type="info"]    [data-title] { color: var(--primary) !important; }

        /* ── Description ─────────────────────────────────────────────── */
        [data-sonner-toast] [data-description] {
          color: color-mix(in oklch, var(--foreground) 80%, transparent) !important;
          font-size: 0.8125rem !important;
          line-height: 1.55 !important;
          margin-top: 4px !important;
        }

        /* ── Hide icon ───────────────────────────────────────────────── */
        [data-sonner-toast] [data-icon] { display: none !important; }

        /* ── Close button ────────────────────────────────────────────── */
        [data-sonner-toast] [data-close-button] {
          left: auto !important;
          right: 8px !important;
          top: 8px !important;
          background: transparent !important;
          border: none !important;
          color: var(--muted-foreground) !important;
        }
        [data-sonner-toast] [data-close-button]:hover {
          color: var(--foreground) !important;
        }
      `}</style>
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
        style={
          {
            "--normal-bg":     "var(--popover)",
            "--normal-text":   "var(--popover-foreground)",
            "--normal-border": "var(--border)",
            "--border-radius": "var(--radius)",
          } as React.CSSProperties
        }
        {...props}
      />
    </>
  )
}

export { Toaster }
