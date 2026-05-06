import { useState, useRef, useCallback } from "react";

const DEFAULT_ORDERS_HEIGHT = 300;
const MIN_HEIGHT = 32;

export function useOrdersPanelResize() {
  const [ordersHeight, setOrdersHeight] = useState(MIN_HEIGHT);
  const [ordersExpanded, setOrdersExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef<number>(DEFAULT_ORDERS_HEIGHT);
  const lastExpandedHeight = useRef<number>(DEFAULT_ORDERS_HEIGHT);

  const handleOrdersToggle = useCallback(() => {
    if (ordersExpanded) {
      lastExpandedHeight.current = ordersHeight;
      setOrdersHeight(MIN_HEIGHT);
      setOrdersExpanded(false);
    } else {
      setOrdersHeight(lastExpandedHeight.current);
      setOrdersExpanded(true);
    }
  }, [ordersExpanded, ordersHeight]);

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartHeight.current = ordersHeight;
    setIsDragging(true);

    const onMouseMove = (ev: MouseEvent) => {
      if (dragStartY.current === null) return;
      const delta = dragStartY.current - ev.clientY;
      const next = Math.max(MIN_HEIGHT, dragStartHeight.current + delta);
      setOrdersHeight(next);
      setOrdersExpanded(next > MIN_HEIGHT);
    };

    const onMouseUp = () => {
      dragStartY.current = null;
      setIsDragging(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [ordersHeight]);

  return { ordersHeight, ordersExpanded, isDragging, handleOrdersToggle, onDragStart };
}
