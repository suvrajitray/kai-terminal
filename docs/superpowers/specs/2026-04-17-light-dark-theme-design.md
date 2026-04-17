# Light/Dark Theme — Design Spec

**Date:** 2026-04-17  
**Scope:** Web frontend only (`frontend/`). Mobile PWA (`/m/*`) excluded.

---

## Summary

Add a user-controlled light/dark theme toggle to the web app. Default is dark. Preference persists across sessions and survives logout.

---

## Decisions

| Question | Decision |
|----------|----------|
| Toggle placement | Icon button in header toolbar, left of the avatar |
| Toggle style | Single icon: ☀️ in dark mode (click → light), 🌙 in light mode (click → dark) |
| State management | Zustand store with `persist` middleware |
| Default theme | Dark |
| System preference | Not supported — simple two-state toggle only |
| Survives logout | Yes — theme key restored after `localStorage.clear()` |

---

## Section 1 — State & Persistence

**New file: `frontend/src/stores/theme-store.ts`**
- Zustand store with `persist` middleware, localStorage key `"theme-store"`
- State: `theme: "dark" | "light"`, default `"dark"`
- Action: `setTheme(theme)` or `toggleTheme()`

**Modified: `frontend/src/lib/logout.ts`**
- Before `localStorage.clear()`: read and save the theme value
- After `localStorage.clear()`: write the saved theme value back
- This ensures theme preference is not cleared on logout

**Modified: `frontend/index.html`**
- Add an inline `<script>` in `<head>` (before any JS bundle loads) that reads `localStorage["theme-store"]`, parses the Zustand persist JSON (`{"state":{"theme":"dark"}}`), and sets/removes `class="dark"` on `<html>` before React mounts
- Prevents flash-of-wrong-theme on page load
- The existing `class="dark"` on `<html>` acts as the fallback for first-time visitors (no stored preference yet)

---

## Section 2 — Applying the Theme

**Modified: `frontend/src/App.tsx`**
- Add a `useEffect` that subscribes to the theme store
- On theme change: toggle `document.documentElement.classList` — add `"dark"` for dark, remove for light
- No changes to `frontend/src/index.css` — both `:root` (light) and `.dark` CSS variable sets are already fully defined

---

## Section 3 — Toggle Button UI

**New file: `frontend/src/components/layout/theme-toggle.tsx`**
- Reads theme from the theme store
- Renders a shadcn `<Button variant="ghost" size="icon">`
- Icon: `Sun` (lucide-react) when in dark mode, `Moon` when in light mode
- On click: calls `toggleTheme()` on the store

**Modified: `frontend/src/components/layout/header.tsx`**
- Import `ThemeToggle`
- Place `<ThemeToggle />` in the right-side flex group, immediately before `<UserMenu />`

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/stores/theme-store.ts` | New — Zustand persisted store |
| `frontend/src/components/layout/theme-toggle.tsx` | New — toggle button component |
| `frontend/src/lib/logout.ts` | Modified — preserve theme around localStorage.clear() |
| `frontend/src/App.tsx` | Modified — useEffect to sync theme to DOM |
| `frontend/index.html` | Modified — inline script to prevent theme flash |
| `frontend/src/components/layout/header.tsx` | Modified — add ThemeToggle |
