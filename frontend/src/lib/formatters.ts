// Shared Intl instances — reuse instead of creating per-component
export const INR     = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const INR_INT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹1,23,456.78 with leading +/- sign */
export function formatSignedInr(value: number): string {
  const abs = Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value >= 0 ? `+₹${abs}` : `-₹${abs}`;
}

/** Signed number always showing sign, e.g. +0.35 or -12.40 */
export function formatGreek(value: number, decimals = 2): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: "always",
  });
}
