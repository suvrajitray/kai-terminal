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

const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

const WEEKLY_EXPIRY_RE  = /^(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})$/;
const MONTHLY_EXPIRY_RE = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})$/;

/**
 * Converts a parsed expiry string to YYYY-MM-DD format for API calls.
 *   "10MAR26" → "2026-03-10"
 *   "MAR25"   → last Thursday of March 2025 (monthly expiry convention)
 */
export function parseExpiryToDate(expiry: string): string | null {
  const e = expiry.toUpperCase().trim();

  const w = WEEKLY_EXPIRY_RE.exec(e);
  if (w) {
    const [, day, mon, yy] = w;
    const year = 2000 + parseInt(yy, 10);
    const month = MONTH_MAP[mon];
    return `${year}-${String(month + 1).padStart(2, "0")}-${day}`;
  }

  const m = MONTHLY_EXPIRY_RE.exec(e);
  if (m) {
    const [, mon, yy] = m;
    const year = 2000 + parseInt(yy, 10);
    const month = MONTH_MAP[mon];
    // Find last Thursday (day 4) of the month
    const d = new Date(year, month + 1, 0);
    while (d.getDay() !== 4) d.setDate(d.getDate() - 1);
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  return null;
}
