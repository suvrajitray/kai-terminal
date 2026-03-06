import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PanelWrapperProps {
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  onRefresh?: () => void;
  loading?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function PanelWrapper({
  title,
  icon,
  onClose,
  onRefresh,
  loading,
  actions,
  children,
}: PanelWrapperProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold tracking-tight">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {onRefresh && (
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              onClick={onRefresh}
              disabled={loading}
              title="Refresh"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="size-7" onClick={onClose} title="Close">
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
