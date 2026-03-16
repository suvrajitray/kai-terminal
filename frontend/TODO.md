# KAI Terminal — Enhancement Backlog

## Look & Feel (positions panel)

- [x] **CE/PE colour badge on symbol** — `OptionTypeBadge` renders green/red badge in `position-row.tsx`.
- [ ] **Left border stripe by position side** — 2px left border: green = long, red = short. No layout change.
- [ ] **P&L row flash per position** — reuse `useValueFlash` hook on each row's P&L cell when LTP updates.
- [x] **Animated row entry** — implemented via `useNewRows` hook + `animate-row-enter` CSS.
- [ ] **Position age** — subtle indicator per row showing how long position has been open (e.g. "2h 14m").

## Look & Feel (orders panel)

- [x] **BUY/SELL pill** — filled pill (`bg-green-500/15 text-green-500` vs red) instead of plain coloured text.
- [x] **Order status colours** — `StatusBadge` in `orders-panel.tsx`: complete=green, rejected=red, open/pending=amber.
- [x] **Empty state icons** — `EmptyState` with `Inbox`, `CheckCircle2`, `LayoutList` icons already in use.

## Stats Bar

- [ ] **Open/closed count badges** — replace `3 open · 1 closed` plain text with small styled pills.
- [ ] **MTM sparkline** — tiny inline chart showing MTM trajectory over the session.

## Terminal Page

- [ ] **Position age** — subtle indicator per row showing how long position has been open (e.g. "2h 14m").

## Header / Nav

- [ ] **Index Ticker clickable** — clicking an index copies the value or opens a quick view.

## Done
- [x] Market status pill in header (OPEN / PRE-OPEN / CLOSED, IST-aware, updates every 30s)
- [x] Keyboard shortcuts — Q (Quick Trade), R (Refresh), E (Exit All with confirm)
- [x] Session timer in stats bar (time since 09:15 IST, market hours only)
- [x] MTM flash on change (green/red background blink via useValueFlash hook)
- [x] `?` keyboard shortcut help — `KeyboardShortcutsHelp` component in stats bar (`stats-bar.tsx`), popover lists R / E / Q / ? shortcuts
- [x] Quick Trade `Q` keyboard trigger — implemented in `quick-trade-button.tsx`
- [x] Orders panel: rich symbol formatting — `parseOptionSymbol()` in `orders-panel.tsx` shows `NIFTY 23100 [PE pill]` / `NFO 17MAR26 · Intraday`
- [x] Orders panel: product label — `productLabel()` maps `I→Intraday`, `D→Delivery` in secondary line
- [x] Orders panel: sticky header — `bg-background z-10` on `<thead>` prevents scroll bleed-through
