---
Task ID: 3
Agent: Full-Stack Developer - Critical Bug Fixes
Task: Fix design/chat persistence on reload, add auto-save, add undo/redo, add setChatMessages

## Files Modified

1. **`/src/stores/zdesign-store.ts`** — Added setChatMessages, isDirty/setIsDirty, undo/redo system, loadDesignTree
2. **`/src/components/zdesign/ZDesignApp.tsx`** — Persistence loading, auto-save, keyboard shortcuts
3. **`/src/components/zdesign/StatusBar.tsx`** — Save status indicator

## Changes Summary

### Fix 1: Design + Chat persistence on page reload
- Added `useEffect` that watches `projectId` and fetches full project + chat messages
- Uses `loadDesignTree()` (new silent setter) to avoid recording initial load in undo history
- Normalizes chat messages from DB to match `ChatMessage` interface

### Fix 2: setChatMessages in store
- Added `setChatMessages: (messages: ChatMessage[]) => void`
- Replaces `chatMessages` entirely for bulk loading from DB

### Fix 3: Auto-save mechanism
- `useDebouncedCallback` hook with 5000ms debounce
- Watches `designTree` + `isDirty`, triggers `PATCH /api/projects/${projectId}`
- "Saving..." / "Unsaved" / "Saved" indicator in StatusBar

### Fix 4: Undo/Redo system
- `history[]` + `future[]` arrays (max 50 entries each)
- `undo()` / `redo()` / `canUndo()` / `canRedo()`
- `setDesignTree`, `updateNode`, `deleteNode` all push to history before mutating
- `loadDesignTree` for silent initial loads (no history recording)
- Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Shift+Z / Ctrl+Y (redo)

### isDirty tracking
- All design mutations set `isDirty: true`
- Auto-save clears `isDirty` after successful save
- StatusBar shows visual state based on `isDirty` + `isSaving`
