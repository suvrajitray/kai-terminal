# KAI Terminal — Enhancement Backlog

## Look & Feel (positions panel)

- [ ] **CE/PE colour badge on symbol** — green badge for CE, red for PE next to strike price. Instant directional scan.
- [ ] **Left border stripe by position side** — 2px left border: green = long, red = short. No layout change.
- [ ] **P&L row flash per position** — reuse `useValueFlash` hook on each row's P&L cell when LTP updates.
- [ ] **Animated row entry** — new positions/orders slide in with fade+translate instead of appearing instantly.
- [ ] **Position age** — subtle indicator per row showing how long position has been open (e.g. "2h 14m").

## Look & Feel (orders panel)

- [ ] **BUY/SELL pill** — filled pill (`bg-green-500/15 text-green-500` vs red) instead of plain coloured text.
- [ ] **Order status colours** — trading-specific: complete=green, rejected=red, open/pending=amber pill.
- [ ] **Empty state icons** — add muted icon (e.g. `Inbox`) above "No positions" / "No open orders" text.

## Stats Bar

- [ ] **Open/closed count badges** — replace `3 open · 1 closed` plain text with small styled pills.
- [ ] **MTM sparkline** — tiny inline chart showing MTM trajectory over the session.

## Terminal Page

- [ ] **`?` keyboard shortcut help** — small button in stats bar showing all shortcuts in a popover.
- [ ] **Position age** — subtle indicator per row showing how long position has been open (e.g. "2h 14m").

## Header / Nav

- [ ] **Index Ticker clickable** — clicking an index copies the value or opens a quick view.
- [ ] **Quick Trade keyboard trigger** — `Q` key anywhere on terminal opens Quick Trade dialog.

## Done
- [x] Market status pill in header (OPEN / PRE-OPEN / CLOSED, IST-aware, updates every 30s)
- [x] Keyboard shortcuts — Q (Quick Trade), R (Refresh), E (Exit All with confirm)
- [x] Session timer in stats bar (time since 09:15 IST, market hours only)
- [x] MTM flash on change (green/red background blink via useValueFlash hook)
