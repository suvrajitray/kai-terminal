interface PanelResizeHandleProps {
  width: number;
  onResize?: (width: number) => void;
}

const MIN_WIDTH = 350;
const MAX_WIDTH = 550;

export function PanelResizeHandle({ width, onResize }: PanelResizeHandleProps) {
  return (
    <div
      className="absolute left-0 top-0 z-20 h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/40 active:bg-primary/60 transition-colors"
      onMouseDown={(event) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = width;

        const onMove = (moveEvent: MouseEvent) => {
          const delta = startX - moveEvent.clientX;
          const nextWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta));
          onResize?.(nextWidth);
        };

        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      }}
    />
  );
}

