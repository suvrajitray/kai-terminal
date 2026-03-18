import { BROKERS } from "@/lib/constants";

interface BrokerBadgeProps {
  brokerId: string;
  /** Size in px. Defaults to 14 (matches text-xs inline elements). */
  size?: number;
}

/**
 * A tiny filled circle in the broker's brand color with the first letter in white.
 * Replaces plain "U" / "Z" text labels throughout the UI.
 */
export function BrokerBadge({ brokerId, size = 14 }: BrokerBadgeProps) {
  const broker = BROKERS.find((b) => b.id === brokerId);
  const color  = broker?.color ?? "#6b7280";
  const letter = (broker?.name ?? brokerId).charAt(0).toUpperCase();

  return (
    <span
      title={broker?.name ?? brokerId}
      style={{
        backgroundColor: color,
        width:  size,
        height: size,
        fontSize: Math.round(size * 0.6),
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none text-white"
    >
      {letter}
    </span>
  );
}
