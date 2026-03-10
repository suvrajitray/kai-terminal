/**
 * Parses Upstox NFO/BFO option trading symbols into human-friendly parts.
 *
 * Two formats exist:
 *   Monthly  — {SYMBOL}{YY}{MMM}{STRIKE}{CE|PE}   e.g. NIFTY25MAR23000CE
 *   Weekly   — {SYMBOL}{YY}{M}{DD}{STRIKE}{CE|PE}  e.g. NIFTY2631025050CE
 *     where single-char month: 1-9 = Jan-Sep, O = Oct, N = Nov, D = Dec
 */

const MONTH_ABBR = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"] as const;

const WEEKLY_MONTH: Record<string, string> = {
  "1": "JAN", "2": "FEB", "3": "MAR", "4": "APR",
  "5": "MAY", "6": "JUN", "7": "JUL", "8": "AUG",
  "9": "SEP", "O": "OCT", "N": "NOV", "D": "DEC",
};

// Monthly: NIFTY25MAR23000CE
const MONTHLY_RE = /^([A-Z&]+)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d+)(CE|PE)$/;
// Weekly:  NIFTY2631025050CE  — single month char then 2-digit day
const WEEKLY_RE  = /^([A-Z&]+)(\d{2})([1-9OND])(\d{2})(\d+)(CE|PE)$/;

export interface ParsedSymbol {
  underlying: string;   // e.g. "NIFTY"
  strike: string;       // e.g. "25050"
  optionType: "CE" | "PE";
  expiry: string;       // e.g. "10MAR26"
  /** Bold headline: "NIFTY 25050 CE" */
  label: string;
  /** Muted sub-line: "10MAR26" */
  expiryLabel: string;
}

export function parseTradingSymbol(symbol: string): ParsedSymbol | null {
  const s = symbol.toUpperCase().trim();

  // Try monthly first
  const m = MONTHLY_RE.exec(s);
  if (m) {
    const [, underlying, yy, mon, strike, optionType] = m;
    const expiry = `${mon}${yy}`;
    return {
      underlying,
      strike,
      optionType: optionType as "CE" | "PE",
      expiry,
      label: `${underlying} ${Number(strike).toLocaleString("en-IN")} ${optionType}`,
      expiryLabel: expiry,
    };
  }

  // Try weekly
  const w = WEEKLY_RE.exec(s);
  if (w) {
    const [, underlying, yy, monthChar, day, strike, optionType] = w;
    const mon = WEEKLY_MONTH[monthChar];
    if (!mon) return null;
    const expiry = `${day}${mon}${yy}`;
    return {
      underlying,
      strike,
      optionType: optionType as "CE" | "PE",
      expiry,
      label: `${underlying} ${Number(strike).toLocaleString("en-IN")} ${optionType}`,
      expiryLabel: expiry,
    };
  }

  return null;
}

// Suppress unused import warning — MONTH_ABBR used only for type safety reference
void (MONTH_ABBR satisfies readonly string[]);
