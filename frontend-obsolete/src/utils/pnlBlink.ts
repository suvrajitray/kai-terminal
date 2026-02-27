export function getBlinkClass(prev: number | undefined, current: number) {
  if (prev === undefined) return "";
  if (current > prev) return "animate-blink-green";
  if (current < prev) return "animate-blink-red";
  return "";
}
