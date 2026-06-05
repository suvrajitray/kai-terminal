# Terminal Broker-Auth-Optional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop gating the whole terminal behind broker auth — show the broker-agnostic terminal (option chain, indices, analytics) to logged-in users with no connected broker, and gate only positions, orders, stats actions, and order entry with inline "Connect a broker" prompts.

**Architecture:** Remove the full-page `BrokerAuthRequired` gate in `terminal-page.tsx`. Derive a single reactive `hasValidBroker` flag and thread it to the positions pane (inline empty-state), stats bar (hide broker actions), and orders strip (hidden). Order entry from the option chain and basket is intercepted at click time via a shared imperative guard that shows an actionable toast.

**Tech Stack:** React 19, React Router v7, Zustand, sonner toasts, shadcn/ui, Vite + TypeScript.

> **Project rule — git:** This repo's CLAUDE.md says *never run any git operation without explicit user instruction.* The "Commit" steps below are logical checkpoints; **do not run `git add/commit` unless the user has authorized it.** When unauthorized, treat the commit step as "pause for review" instead.

> **No test framework:** This repo has no frontend test project. "Verify" steps use `npm run build` (tsc typecheck + Vite build) for compile verification plus the manual matrix in Task 7. Run build commands from `frontend/`.

---

### Task 1: Broker guard utility

A single source of truth for the imperative "is there a usable broker right now?" check and the connect-broker prompt toast. Used by the chain row and basket execute click handlers.

**Files:**
- Create: `frontend/src/lib/broker-guard.ts`

- [ ] **Step 1: Create the guard module**

```typescript
import { isBrokerTokenExpired } from "@/lib/token-utils";
import { useBrokerStore } from "@/stores/broker-store";
import { toast } from "@/lib/toast";

/**
 * Imperative check: is at least one broker connected with a non-expired token?
 * Reads the store directly so it can be called from event handlers.
 */
export function hasValidBrokerNow(): boolean {
  const { credentials } = useBrokerStore.getState();
  return Object.entries(credentials).some(
    ([id, c]) => !isBrokerTokenExpired(id, c?.accessToken),
  );
}

/**
 * Guard for order-placement actions. Returns true when a broker is available.
 * When none is available, shows an actionable toast linking to /connect-brokers
 * and returns false so the caller can bail out.
 */
export function ensureBrokerOrPrompt(): boolean {
  if (hasValidBrokerNow()) return true;
  toast.warning("Connect a broker to place orders", {
    action: {
      label: "Connect",
      onClick: () => {
        window.location.href = "/connect-brokers";
      },
    },
  });
  return false;
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors referencing `broker-guard.ts`.

- [ ] **Step 3: Commit** (only if git authorized — see project rule above)

```bash
git add frontend/src/lib/broker-guard.ts
git commit -m "feat(frontend): add broker guard util for order-entry gating"
```

---

### Task 2: Inline connect-broker empty state

A compact, inline version of the old full-page `BrokerAuthRequired` card, rendered inside the positions pane.

**Files:**
- Create: `frontend/src/components/panels/positions-panel/connect-broker-prompt.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * Inline empty-state shown in the positions pane when no broker is connected.
 * Positions and trading require a broker token; the rest of the terminal
 * (option chain, indices, analytics) does not.
 */
export function ConnectBrokerPrompt() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 ring-1 ring-destructive/20">
        <ShieldAlert className="size-5 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Connect a broker to see positions & trade</h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          Option chain, indices, and analytics work without a broker. Connect one
          to view live positions and place orders.
        </p>
      </div>
      <Button size="sm" onClick={() => navigate("/connect-brokers")}>
        Connect Broker
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors referencing `connect-broker-prompt.tsx`.

- [ ] **Step 3: Commit** (only if git authorized)

```bash
git add frontend/src/components/panels/positions-panel/connect-broker-prompt.tsx
git commit -m "feat(frontend): add inline connect-broker prompt for positions pane"
```

---

### Task 3: Gate the positions pane

`PositionsPanel` gains a `hasValidBroker` prop. When false it renders `ConnectBrokerPrompt` instead of the positions table and hides the filters bar.

**Files:**
- Modify: `frontend/src/components/panels/positions-panel/index.tsx`

- [ ] **Step 1: Import the prompt component**

Add to the import block at the top of `index.tsx`:

```tsx
import { ConnectBrokerPrompt } from "./connect-broker-prompt";
```

- [ ] **Step 2: Add `hasValidBroker` to the props interface**

In `interface PositionsPanelProps`, add the field:

```tsx
interface PositionsPanelProps {
  positions: Position[];
  loading: boolean;
  load: () => void;
  hasValidBroker: boolean;
  netDelta?: number;
  thetaPerDay?: number;
  productFilter: "Intraday" | "Delivery" | null;
  onProductFilterChange: (v: "Intraday" | "Delivery" | null) => void;
}
```

- [ ] **Step 3: Destructure the new prop**

In the `export function PositionsPanel({ ... })` destructure, add `hasValidBroker`:

```tsx
export function PositionsPanel({
  positions,
  loading,
  load,
  hasValidBroker,
  netDelta,
  thetaPerDay = 0,
  productFilter,
  onProductFilterChange,
}: PositionsPanelProps) {
```

- [ ] **Step 4: Render the prompt when no broker**

Replace the `return (...)` block's body so that when `!hasValidBroker` the prompt renders instead of filters + table. Change the outer wrapper to early-return the prompt:

```tsx
  if (!hasValidBroker) {
    return (
      <div className="flex h-full flex-col">
        <ConnectBrokerPrompt />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {showFilter && (
        <PositionFilters
```

(Leave the rest of the existing `return` exactly as-is.)

- [ ] **Step 5: Verify it compiles**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: a type error at the `<PositionsPanel ... />` call site in `terminal-page.tsx` (missing `hasValidBroker`). That is expected and fixed in Task 5. No errors inside `positions-panel/index.tsx` itself.

- [ ] **Step 6: Commit** (only if git authorized)

```bash
git add frontend/src/components/panels/positions-panel/index.tsx
git commit -m "feat(frontend): gate positions pane behind hasValidBroker"
```

---

### Task 4: Gate stats-bar broker actions

`StatsBar` and `StatsActions` gain a `hasValidBroker` prop. When false, hide the Profit Protection control. (Exit All already auto-hides when `openCount === 0`, which is always true without a broker, but we also gate it explicitly so it never shows.)

**Files:**
- Modify: `frontend/src/components/terminal/stats-bar/index.tsx`
- Modify: `frontend/src/components/terminal/stats-bar/stats-actions.tsx`

- [ ] **Step 1: Add `hasValidBroker` to `StatsBarProps` and forward it**

In `stats-bar/index.tsx`, add `hasValidBroker: boolean;` to `interface StatsBarProps`, add `hasValidBroker` to the destructured params of `export function StatsBar({ ... })`, and pass it through to the `<StatsActions ... />` element (find where `StatsActions` is rendered in this file and add `hasValidBroker={hasValidBroker}`).

```tsx
interface StatsBarProps {
  positions: Position[];
  isLive: boolean;
  loading: boolean;
  acting: string | null;
  hasValidBroker: boolean;
  onRefresh: () => void;
  onExitAll: () => void;
  onOpenProfitProtection: (brokerId?: string) => void;
  ppBrokers: PpBrokerEntry[];
  onToggleChain: () => void;
  chainOpen: boolean;
  productFilter: "Intraday" | "Delivery" | null;
}
```

- [ ] **Step 2: Add `hasValidBroker` to `StatsActionsProps` and gate the controls**

In `stats-actions.tsx`, add `hasValidBroker: boolean;` to `interface StatsActionsProps`, destructure it, and wrap the broker-only controls. Gate the `ProfitProtectionControl` (and its trailing divider) and the Exit All `Tooltip` block:

```tsx
export function StatsActions({
  connectedBrokers,
  ppEnabled,
  openCount,
  acting,
  loading,
  chainOpen,
  hasValidBroker,
  onOpenProfitProtection,
  onExitAll,
  onRefresh,
  onOpenPayoff,
  onToggleChain,
}: StatsActionsProps) {
  return (
    <div className="flex h-9 items-center gap-2 shrink-0 lg:ml-auto border-t border-border/40 lg:border-t-0">
      {hasValidBroker && (
        <>
          <ProfitProtectionControl
            connectedBrokers={connectedBrokers}
            ppEnabled={ppEnabled}
            onOpenProfitProtection={onOpenProfitProtection}
          />
          <div className="h-4 w-px bg-border" />
        </>
      )}

      {hasValidBroker && openCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="destructive"
              className="h-6 px-2 text-xs"
              onClick={onExitAll}
              disabled={acting === "all"}
            >
              <LogOut className="mr-1 size-3" />
              Exit All
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Exit all open positions [E]</p>
          </TooltipContent>
        </Tooltip>
      )}
```

(Leave the Refresh / Payoff / chain-toggle buttons below unchanged.)

- [ ] **Step 3: Verify it compiles**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: a type error at the `<StatsBar ... />` call site in `terminal-page.tsx` (missing `hasValidBroker`). Expected — fixed in Task 5. No errors inside the stats-bar files.

- [ ] **Step 4: Commit** (only if git authorized)

```bash
git add frontend/src/components/terminal/stats-bar/index.tsx frontend/src/components/terminal/stats-bar/stats-actions.tsx
git commit -m "feat(frontend): hide stats-bar broker actions when no broker"
```

---

### Task 5: Rewire the terminal page

Remove the full-page gate, always render the inner terminal, derive `hasValidBroker` reactively, thread it to the positions pane and stats bar, and hide the orders strip when no broker.

**Files:**
- Modify: `frontend/src/pages/terminal-page.tsx`

- [ ] **Step 1: Remove the full-page gate and the unused import**

Delete the `BrokerAuthRequired` import line (`import { BrokerAuthRequired } from "@/components/terminal/broker-auth-required";`) and replace the outer `TerminalPage` wrapper so it always renders the inner page:

```tsx
export function TerminalPage() {
  return <TerminalPageInner />;
}
```

(Delete the `credentials`/`brokerEntries`/`hasValid`/`hasExpired` computation and the `if (!hasValid) return <BrokerAuthRequired .../>` block that were in the outer `TerminalPage`.)

- [ ] **Step 2: Derive `hasValidBroker` inside `TerminalPageInner`**

The inner component already has `const credentials = useBrokerStore((s) => s.credentials);`. Right below it, add:

```tsx
  const hasValidBroker = Object.entries(credentials).some(
    ([id, c]) => !isBrokerTokenExpired(id, c?.accessToken),
  );
```

(`isBrokerTokenExpired` and `useBrokerStore` are already imported in this file.)

- [ ] **Step 3: Pass `hasValidBroker` to `StatsBar` and `PositionsPanel`**

In the JSX, add `hasValidBroker={hasValidBroker}` to the `<StatsBar ... />` element and to the `<PositionsPanel ... />` element.

- [ ] **Step 4: Hide the orders strip and its padding when no broker**

Change the positions container's `paddingBottom` and wrap the orders strip so it only renders with a broker. Replace:

```tsx
        <div className={cn("flex-1 overflow-hidden", !isDragging && "transition-[padding-bottom] duration-200 ease-in-out")} style={{ paddingBottom: ordersHeight }}>
```

with:

```tsx
        <div className={cn("flex-1 overflow-hidden", !isDragging && "transition-[padding-bottom] duration-200 ease-in-out")} style={{ paddingBottom: hasValidBroker ? ordersHeight : 0 }}>
```

and wrap the entire orders `<div className="absolute bottom-0 ...">...</div>` block in `{hasValidBroker && ( ... )}`.

- [ ] **Step 5: Verify it compiles**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: PASS — no type errors (Task 3 and Task 4 call sites now satisfied).

- [ ] **Step 6: Commit** (only if git authorized)

```bash
git add frontend/src/pages/terminal-page.tsx
git commit -m "feat(frontend): drop full-page broker gate, render terminal without broker"
```

---

### Task 6: Intercept order entry from chain and basket

Guard the two order-placement entry points with `ensureBrokerOrPrompt()`.

**Files:**
- Modify: `frontend/src/components/panels/option-chain-panel/option-chain-row.tsx`
- Modify: `frontend/src/components/layout/basket-dialog/index.tsx`

- [ ] **Step 1: Guard the chain row `triggerOrder`**

In `option-chain-row.tsx`, add the import:

```tsx
import { ensureBrokerOrPrompt } from "@/lib/broker-guard";
```

Then at the very top of `function triggerOrder(...)` (before reading `opt`/`ltp`/`key`), bail out when no broker:

```tsx
  function triggerOrder(side: "CE" | "PE", transactionType: "Buy" | "Sell") {
    if (!ensureBrokerOrPrompt()) return;
    const opt = side === "CE" ? entry.callOptions : entry.putOptions;
```

This covers both basket-add and direct order-ticket paths (both go through `triggerOrder`).

- [ ] **Step 2: Guard the basket execute**

In `basket-dialog/index.tsx`, add the import:

```tsx
import { ensureBrokerOrPrompt } from "@/lib/broker-guard";
```

Then at the top of `async function handlePlace()` (before `const toPlace = ...`), add:

```tsx
  async function handlePlace() {
    if (!ensureBrokerOrPrompt()) return;
    const toPlace = someSelected ? items.filter((i) => selectedIds.has(i.id)) : items;
```

- [ ] **Step 3: Verify it compiles**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: PASS — no type errors.

- [ ] **Step 4: Commit** (only if git authorized)

```bash
git add frontend/src/components/panels/option-chain-panel/option-chain-row.tsx frontend/src/components/layout/basket-dialog/index.tsx
git commit -m "feat(frontend): prompt to connect broker on order entry without broker"
```

---

### Task 7: Remove dead code and verify end-to-end

**Files:**
- Delete: `frontend/src/components/terminal/broker-auth-required.tsx`

- [ ] **Step 1: Confirm `BrokerAuthRequired` is unused**

Run (from `frontend/`): `grep -rn "broker-auth-required\|BrokerAuthRequired" src`
Expected: no matches (the only importer, `terminal-page.tsx`, was changed in Task 5).

- [ ] **Step 2: Delete the now-unused full-page gate component**

```bash
rm frontend/src/components/terminal/broker-auth-required.tsx
```

- [ ] **Step 3: Full production build**

Run (from `frontend/`): `npm run build`
Expected: PASS — TypeScript check clean, Vite build succeeds, no unresolved imports.

- [ ] **Step 4: Manual verification matrix**

Run `npm run dev` (from `frontend/`) and verify each case:

1. **Logged in, no broker connected** — terminal renders; option chain + index ticker + analytics are live; positions pane shows the "Connect a broker to see positions & trade" prompt with a working Connect Broker link; stats bar shows no Profit Protection / Exit All; orders bottom strip is hidden; clicking a chain Buy/Sell shows the "Connect a broker to place orders" toast with a working Connect action; basket execute shows the same toast.
2. **Broker connected (valid token)** — terminal behaves exactly as before: positions table, orders strip, Profit Protection, Exit All, and order entry (chain + basket) all work.
3. **Token expired (had broker, now expired)** — same as case 1.
4. **Partial auth (one valid, one expired)** — trading and positions work for the valid broker, as today.

- [ ] **Step 5: Commit** (only if git authorized)

```bash
git add -A
git commit -m "chore(frontend): remove unused full-page broker gate component"
```

---

## Self-Review Notes

- **Spec coverage:** Core change (Task 5) ✓; positions pane prompt (Tasks 2–3) ✓; stats bar hide actions + orders hidden (Tasks 4–5) ✓; chain/basket order-entry intercept via toast (Tasks 1, 6) ✓; partial-auth unchanged (Task 5 derives `hasValidBroker` = any valid broker) ✓; untouched broker-agnostic feeds (no tasks touch them) ✓.
- **Type consistency:** `hasValidBroker: boolean` prop name is identical across `PositionsPanel`, `StatsBar`, `StatsActions`; guard fns `hasValidBrokerNow()` / `ensureBrokerOrPrompt()` named consistently between Task 1 and Task 6.
- **Decisions honored:** actionable toast (not modal) for chain intercept; option chain default-open state unchanged.
