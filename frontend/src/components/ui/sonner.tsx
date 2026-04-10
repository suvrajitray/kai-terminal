import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <>
      <style>{`
        /* ── Base toast ──────────────────────────────────────────────── */
        [data-sonner-toast] {
          width: 400px !important;
          background: var(--popover) !important;
          border: 1px solid color-mix(in oklch, var(--border) 40%, transparent) !important;
          border-radius: 6px !important;
          padding: 14px 16px 14px 22px !important;
          box-shadow: 0 8px 32px rgb(0 0 0 / 0.5), 0 2px 8px rgb(0 0 0 / 0.3), inset 6px 0 0 0 var(--border) !important;
          gap: 0 !important;
        }

        /* ── Left accent strip via inset shadow (respects border-radius) */
        [data-sonner-toast][data-type="error"]   { box-shadow: 0 8px 32px rgb(0 0 0 / 0.5), 0 2px 8px rgb(0 0 0 / 0.3), inset 6px 0 0 0 var(--destructive) !important; }
        [data-sonner-toast][data-type="success"] { box-shadow: 0 8px 32px rgb(0 0 0 / 0.5), 0 2px 8px rgb(0 0 0 / 0.3), inset 6px 0 0 0 #10b981 !important; }
        [data-sonner-toast][data-type="warning"] { box-shadow: 0 8px 32px rgb(0 0 0 / 0.5), 0 2px 8px rgb(0 0 0 / 0.3), inset 6px 0 0 0 #f59e0b !important; }
        [data-sonner-toast][data-type="info"]    { box-shadow: 0 8px 32px rgb(0 0 0 / 0.5), 0 2px 8px rgb(0 0 0 / 0.3), inset 6px 0 0 0 var(--primary) !important; }
        [data-sonner-toast][data-type="loading"] { box-shadow: 0 8px 32px rgb(0 0 0 / 0.5), 0 2px 8px rgb(0 0 0 / 0.3), inset 6px 0 0 0 var(--muted-foreground) !important; }

        /* ── Title ───────────────────────────────────────────────────── */
        [data-sonner-toast] [data-title] {
          font-size: 0.875rem !important;
          font-weight: 700 !important;
          color: var(--foreground) !important;
          line-height: 1.4 !important;
        }
        [data-sonner-toast][data-type="error"]   [data-title] { color: var(--destructive) !important; }
        [data-sonner-toast][data-type="success"] [data-title] { color: #10b981 !important; }
        [data-sonner-toast][data-type="warning"] [data-title] { color: #f59e0b !important; }
        [data-sonner-toast][data-type="info"]    [data-title] { color: var(--primary) !important; }

        /* ── Description ─────────────────────────────────────────────── */
        [data-sonner-toast] [data-description] {
          color: color-mix(in oklch, var(--foreground) 95%, transparent) !important;
          font-size: 0.8125rem !important;
          line-height: 1.6 !important;
          margin-top: 5px !important;
          font-variant-numeric: tabular-nums !important;
          word-break: break-word !important;
          overflow-wrap: break-word !important;
        }

        /* ── Hide icon ───────────────────────────────────────────────── */
        [data-sonner-toast] [data-icon] { display: none !important; }

        /* ── Close button ────────────────────────────────────────────── */
        [data-sonner-toast] [data-close-button] {
          left: auto !important;
          right: 0px !important;
          top: 10px !important;
          background: transparent !important;
          border: none !important;
          color: var(--muted-foreground) !important;
          opacity: 0.5 !important;
          transition: opacity 0.15s !important;
        }
        [data-sonner-toast] [data-close-button]:hover {
          color: var(--foreground) !important;
          opacity: 1 !important;
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
