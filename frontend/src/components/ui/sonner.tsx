import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <>
      <style>{`
        /* ── Base toast ──────────────────────────────────────────────── */
        [data-sonner-toast] {
          background: hsl(var(--popover)) !important;
          border: 1px solid hsl(var(--border) / 0.5) !important;
          border-left: 4px solid hsl(var(--border)) !important;
          border-radius: var(--radius) !important;
          padding: 14px 16px !important;
          box-shadow: 0 4px 24px hsl(0 0% 0% / 0.4) !important;
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
          color: hsl(var(--foreground)) !important;
          line-height: 1.4 !important;
        }
        [data-sonner-toast][data-type="error"]   [data-title] { color: hsl(var(--destructive)) !important; }
        [data-sonner-toast][data-type="success"] [data-title] { color: #10b981 !important; }
        [data-sonner-toast][data-type="warning"] [data-title] { color: #f59e0b !important; }
        [data-sonner-toast][data-type="info"]    [data-title] { color: hsl(var(--primary)) !important; }

        /* ── Description ─────────────────────────────────────────────── */
        [data-sonner-toast] [data-description] {
          color: hsl(var(--foreground) / 0.8) !important;
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
          color: hsl(var(--muted-foreground)) !important;
        }
        [data-sonner-toast] [data-close-button]:hover {
          color: hsl(var(--foreground)) !important;
        }
      `}</style>
      <Sonner
        theme={theme as ToasterProps["theme"]}
        className="toaster group"
        style={
          {
            "--normal-bg":     "hsl(var(--popover))",
            "--normal-text":   "hsl(var(--popover-foreground))",
            "--normal-border": "hsl(var(--border))",
            "--border-radius": "var(--radius)",
          } as React.CSSProperties
        }
        {...props}
      />
    </>
  )
}

export { Toaster }
