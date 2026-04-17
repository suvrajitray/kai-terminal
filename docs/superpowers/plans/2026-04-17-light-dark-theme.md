# Light/Dark Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-controlled light/dark theme toggle to the web app with dark as default, persisted across sessions and logout.

**Architecture:** A Zustand persisted store holds `theme: "dark" | "light"`. `App.tsx` syncs it to `document.documentElement.classList`. An inline script in `index.html` applies the saved theme before React mounts to prevent flash. A `ThemeToggle` button in the header triggers the switch.

**Tech Stack:** React, Zustand (persist middleware), lucide-react (Sun/Moon icons), shadcn Button, Tailwind CSS `.dark` class variant.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `frontend/src/stores/theme-store.ts` | Create | Zustand persisted store for theme preference |
| `frontend/src/components/layout/theme-toggle.tsx` | Create | Icon button component (Sun/Moon) |
| `frontend/index.html` | Modify | Inline script to prevent theme flash on load |
| `frontend/src/App.tsx` | Modify | `useEffect` to sync store → DOM class |
| `frontend/src/components/layout/header.tsx` | Modify | Mount `<ThemeToggle />` before `<UserMenu />` |
| `frontend/src/lib/logout.ts` | Modify | Preserve theme around `localStorage.clear()` |

---

### Task 1: Create the theme store

**Files:**
- Create: `frontend/src/stores/theme-store.ts`

- [ ] **Step 1: Create the store**

```ts
// frontend/src/stores/theme-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeState {
  theme: "dark" | "light";
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    { name: "theme-store" },
  ),
);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/theme-store.ts
git commit -m "feat: add theme store with dark default"
```

---

### Task 2: Sync theme to DOM in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add the useEffect**

Add the following import at the top of `frontend/src/App.tsx`:

```ts
import { useEffect } from "react";
import { useThemeStore } from "@/stores/theme-store";
```

Add this hook call inside the `App` function body, before the `return`:

```ts
const theme = useThemeStore((s) => s.theme);

useEffect(() => {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}, [theme]);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: sync theme store to document dark class"
```

---

### Task 3: Prevent theme flash with inline script in index.html

**Files:**
- Modify: `frontend/index.html`

- [ ] **Step 1: Add the inline script**

In `frontend/index.html`, insert the following `<script>` block inside `<head>`, immediately after `<meta charset="UTF-8" />`:

```html
<script>
  (function () {
    try {
      var stored = localStorage.getItem("theme-store");
      if (stored) {
        var parsed = JSON.parse(stored);
        if (parsed && parsed.state && parsed.state.theme === "light") {
          document.documentElement.classList.remove("dark");
          return;
        }
      }
    } catch (_) {}
    document.documentElement.classList.add("dark");
  })();
</script>
```

The existing `class="dark"` on `<html>` can be removed since this script handles it — but leaving it causes no harm as a fallback for the brief moment before the script runs.

- [ ] **Step 2: Verify dev server starts without errors**

```bash
cd frontend && npm run dev
```
Expected: server starts on `:3000`, no console errors on page load

- [ ] **Step 3: Commit**

```bash
git add frontend/index.html
git commit -m "feat: prevent theme flash via inline script in index.html"
```

---

### Task 4: Create the ThemeToggle component

**Files:**
- Create: `frontend/src/components/layout/theme-toggle.tsx`

- [ ] **Step 1: Create the component**

```tsx
// frontend/src/components/layout/theme-toggle.tsx
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/stores/theme-store";

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return (
    <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/theme-toggle.tsx
git commit -m "feat: add ThemeToggle icon button component"
```

---

### Task 5: Mount ThemeToggle in the header

**Files:**
- Modify: `frontend/src/components/layout/header.tsx`

- [ ] **Step 1: Add the import**

Add to the imports at the top of `frontend/src/components/layout/header.tsx`:

```ts
import { ThemeToggle } from "./theme-toggle";
```

- [ ] **Step 2: Add the component before UserMenu**

In the right-side `flex` group (the `<div className="flex items-center gap-4">` block), add `<ThemeToggle />` immediately before `<UserMenu />`:

```tsx
<div className="flex items-center gap-4">
  <MarketStatus />
  {brokerAuthenticated && <IndexTicker />}
  <BrokerStatusChips />
  {brokerAuthenticated && <QuickTradeButton />}
  <ThemeToggle />
  <UserMenu />
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/header.tsx
git commit -m "feat: mount ThemeToggle in header toolbar"
```

---

### Task 6: Preserve theme preference across logout

**Files:**
- Modify: `frontend/src/lib/logout.ts`

- [ ] **Step 1: Update performLogout to save and restore theme**

Replace the body of `performLogout` in `frontend/src/lib/logout.ts`:

```ts
import { useAuthStore } from "@/stores/auth-store";
import { useBrokerStore } from "@/stores/broker-store";
import { useProfitProtectionStore } from "@/stores/profit-protection-store";
import { useRiskStateStore } from "@/stores/risk-state-store";
import { useUserTradingSettingsStore } from "@/stores/user-trading-settings-store";
import { useOptionContractsStore } from "@/stores/option-contracts-store";

export function performLogout() {
  const savedTheme = localStorage.getItem("theme-store");
  localStorage.clear();
  if (savedTheme) localStorage.setItem("theme-store", savedTheme);
  useAuthStore.getState().logout();
  useBrokerStore.getState().clearAll();
  useProfitProtectionStore.getState().reset();
  useRiskStateStore.getState().reset();
  useUserTradingSettingsStore.getState().reset();
  useOptionContractsStore.getState().clear();
  window.location.href = "/login";
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/logout.ts
git commit -m "feat: preserve theme preference across logout"
```

---

### Task 7: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Verify dark default**

Open `http://localhost:3000`. Page should load in dark mode. ☀️ Sun icon should be visible in the header.

- [ ] **Step 3: Verify toggle to light**

Click the ☀️ Sun icon. Page switches to light mode. Icon becomes 🌙 Moon.

- [ ] **Step 4: Verify persistence across reload**

With light mode active, reload the page. Light mode should still be active (no dark flash).

- [ ] **Step 5: Verify persistence across logout**

With light mode active, log out. Log back in. Light mode should still be active.

- [ ] **Step 6: Verify production build**

```bash
cd frontend && npm run build
```
Expected: build succeeds with no TypeScript errors.
