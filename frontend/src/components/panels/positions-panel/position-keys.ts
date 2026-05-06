import type { Position } from "@/types";

export function selectionKey(position: Position) {
  return `${position.instrumentToken}|${position.product}`;
}

export function rowKey(position: Position) {
  return position.instrumentToken + position.product;
}

