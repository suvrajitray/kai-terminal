# Priority Broker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users set a default broker when multiple are connected, so the order dialog pre-selects it instead of always defaulting to Upstox.

**Architecture:** Add `brokerPriority: string[]` (persisted) to the Zustand broker store. Wherever active brokers are derived for order dialog pre-selection, sort by this array so the priority broker lands at index 0. Surface "Set as default" in the broker chip popover with a ★ badge on the chip when active.

**Tech Stack:** React, Zustand (`persist`), lucide-react, shadcn Button, Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/stores/broker-store.ts` | Add `brokerPriority: string[]` state + `setDefaultBroker(id)` action |
| `frontend/src/components/panels/order-dialog.tsx` | Sort `activeBrokers` by priority before taking `[0]` as default |
| `frontend/src/components/layout/broker-status-chips.tsx` | ★ on default chip + "Set as default" button in popover |

No backend changes. No new files.

---

## Task 1: Add `brokerPriority` to broker store

**Files:**
- Modify: `frontend/src/stores/broker-store.ts`

- [ ] **Step 1: Replace the file with the updated store**

Full replacement — adds `brokerPriority` field and `setDefaultBroker` action:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BrokerCredentials } from "@/types";

interface BrokerState {
  credentials: Record<string, BrokerCredentials>;
  brokerPriority: string[];
  saveCredentials: (brokerId: string, creds: BrokerCredentials) => void;
  setAccessToken: (brokerId: string, accessToken: string) => void;
  removeCredentials: (brokerId: string) => void;
  clearAll: () => void;
  isConnected: (brokerId: string) => boolean;
  isAuthenticated: (brokerId: string) => boolean;
  getCredentials: (brokerId: string) => BrokerCredentials | undefined;
  setDefaultBroker: (id: string) => void;
}

export const useBrokerStore = create<BrokerState>()(
  persist(
    (set, get) => ({
      credentials: {},
      brokerPriority: [],
      saveCredentials: (brokerId, creds) =>
        set((state) => ({
          credentials: { ...state.credentials, [brokerId]: creds },
        })),
      setAccessToken: (brokerId, accessToken) =>
        set((state) => {
          const existing = state.credentials[brokerId];
          if (!existing) return state;
          return {
            credentials: { ...state.credentials, [brokerId]: { ...existing, accessToken } },
          };
        }),
      removeCredentials: (brokerId) =>
        set((state) => {
          const next = { ...state.credentials };
          delete next[brokerId];
          return { credentials: next };
        }),
      clearAll: () => set({ credentials: {} }),
      isConnected: (brokerId) => brokerId in get().credentials,
      isAuthenticated: (brokerId) => !!get().credentials[brokerId]?.accessToken,
      getCredentials: (brokerId) => get().credentials[brokerId],
      setDefaultBroker: (id) =>
        set((state) => ({
          brokerPriority: [id, ...state.brokerPriority.filter((b) => b !== id)],
        })),
    }),
    { name: "kai-terminal-brokers" },
  ),
);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors referencing `broker-store.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/broker-store.ts
git commit -m "feat(broker-store): add brokerPriority and setDefaultBroker"
```

---

## Task 2: Sort active brokers by priority in the order dialog

**Files:**
- Modify: `frontend/src/components/panels/order-dialog.tsx`

- [ ] **Step 1: Add `sortByPriority` helper before the `OrderDialog` component**

Insert this function just above the `export interface OrderIntent` line (line 23):

```ts
function sortByPriority<T extends { id: string }>(items: T[], priority: string[]): T[] {
  if (priority.length === 0) return items;
  return [...items].sort((a, b) => {
    const ai = priority.indexOf(a.id);
    const bi = priority.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
```

- [ ] **Step 2: Read `brokerPriority` from the store inside the component**

The existing store read at line 57 is:
```ts
const credentials        = useBrokerStore((s) => s.credentials);
```

Add the priority selector on the next line:
```ts
const credentials        = useBrokerStore((s) => s.credentials);
const brokerPriority     = useBrokerStore((s) => s.brokerPriority);
```

- [ ] **Step 3: Wrap the `activeBrokers` filter with `sortByPriority`**

Current code (lines 60-62):
```ts
const activeBrokers = BROKERS.filter(
  (b) => (b.id === "upstox" || b.id === "zerodha") && !isBrokerTokenExpired(b.id, credentials[b.id]?.accessToken),
);
```

Replace with:
```ts
const activeBrokers = sortByPriority(
  BROKERS.filter(
    (b) => (b.id === "upstox" || b.id === "zerodha") && !isBrokerTokenExpired(b.id, credentials[b.id]?.accessToken),
  ),
  brokerPriority,
);
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/panels/order-dialog.tsx
git commit -m "feat(order-dialog): sort active brokers by user priority"
```

---

## Task 3: Show ★ on chip and "Set as default" in popover

**Files:**
- Modify: `frontend/src/components/layout/broker-status-chips.tsx`

- [ ] **Step 1: Add `Star` to the lucide import**

Current import (line 1):
```ts
import { KeyRound, ShieldCheck, Wallet } from "lucide-react";
```

Replace with:
```ts
import { KeyRound, ShieldCheck, Star, Wallet } from "lucide-react";
```

- [ ] **Step 2: Read `brokerPriority` and `setDefaultBroker` from the store**

Current store read (line 14):
```ts
const credentials = useBrokerStore((s) => s.credentials);
```

Replace with:
```ts
const credentials      = useBrokerStore((s) => s.credentials);
const brokerPriority   = useBrokerStore((s) => s.brokerPriority);
const setDefaultBroker = useBrokerStore((s) => s.setDefaultBroker);
```

- [ ] **Step 3: Derive `defaultBrokerId` just after `connectedBrokers`**

After the existing line:
```ts
const connectedBrokers = BROKERS.filter((b) => credentials[b.id]);
```

Add:
```ts
const defaultBrokerId =
  connectedBrokers.length > 1
    ? (brokerPriority.find((id) => connectedBrokers.some((b) => b.id === id)) ?? connectedBrokers[0]?.id)
    : null;
```

This picks the first priority entry that is actually connected, falling back to the first connected broker if no priority is set.

- [ ] **Step 4: Add ★ icon to the chip label**

Inside the `<PopoverTrigger>` button, after the status dot `<span>` and before `{broker.name}`:

Current:
```tsx
<span
  className={cn(
    "size-1.5 rounded-full",
    isAuthed ? "bg-green-500" : "bg-muted-foreground/50",
  )}
/>
{broker.name}
```

Replace with:
```tsx
<span
  className={cn(
    "size-1.5 rounded-full",
    isAuthed ? "bg-green-500" : "bg-muted-foreground/50",
  )}
/>
{broker.id === defaultBrokerId && (
  <Star className="size-2.5 fill-current" />
)}
{broker.name}
```

- [ ] **Step 5: Add "Set as default" button inside the popover**

Inside `<PopoverContent>`, find the actions `<div>` (currently wraps Profit Protection + auth button):

```tsx
<div className="flex items-center gap-1.5">
  <Button ...Profit Protection.../>
  {!isAuthed && <Tooltip>...</Tooltip>}
</div>
```

Add a "Set as default" button row **above** that `<div>`:

```tsx
{connectedBrokers.length > 1 && broker.id !== defaultBrokerId && (
  <Button
    size="sm"
    variant="outline"
    className="w-full h-7 text-xs border-border/50 text-muted-foreground hover:text-foreground"
    onClick={() => setDefaultBroker(broker.id)}
  >
    <Star className="mr-1.5 size-3" />
    Set as default
  </Button>
)}
<div className="flex items-center gap-1.5">
  ...existing buttons...
</div>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 7: Manual verification**

1. Start dev server: `cd frontend && npm run dev`
2. Connect both Upstox and Zerodha (or mock credentials in localStorage)
3. Open browser → header chips should show both brokers, Upstox chip has ★ by default (first in BROKERS array, no priority set yet)
4. Click Zerodha chip → popover shows "Set as default" button
5. Click "Set as default" → Zerodha chip now shows ★, Upstox chip loses ★
6. Open order dialog → pre-selected broker is Zerodha; "Route via" toggle shows Zerodha first
7. Reload page → Zerodha is still the default (persisted in localStorage)
8. With only one broker connected → no ★ shown, no "Set as default" button

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/layout/broker-status-chips.tsx
git commit -m "feat(broker-chips): show default broker star and set-as-default button"
```
