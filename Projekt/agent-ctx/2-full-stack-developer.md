# Task 2 - Fix Chat Panel Issues and Polish UI

## Agent: full-stack-developer
## Date: Thu Jun 12 2026

## Summary

Fixed all 5 problems from the task spec:

### Problem 1: Example prompts stale closure
- **Root cause**: `sendMessage` used `useCallback` with `projectId`, `chatMessages`, `designTree`, `designSystem` in its dependency array. When `handleExampleClick` was called from the welcome screen, `projectId` could be null in the closure.
- **Fix**: Refactored to use refs for all mutable state. `sendMessage` now reads `projectIdRef.current`, `chatMessagesRef.current`, etc. The callback has `[]` dependencies, so it's always stable and always reads the latest values.

### Problem 2: Hydration mismatches
- **Root cause**: Three sources: ThemeProvider rendering different classes on server/client, `toLocaleTimeString()` producing different strings, and `isSupported` in useVoiceInput using `typeof window` check synchronously.
- **Fix**: 
  1. Wrapped ThemeProvider with `<div suppressHydrationWarning>`
  2. Added `mounted` state to MessageBubble, only render timestamps after mount
  3. Changed `isSupported` from synchronous check to `useState(false)` + `useEffect` in useVoiceInput

### Problem 3: Design system prompt color mismatch
- **Root cause**: Both system prompts used indigo (#6366f1) as primary color, inconsistent with Z.Design's emerald branding.
- **Fix**: Updated all indigo references to emerald in both DESIGN_ASSISTANT_SYSTEM_PROMPT and DESIGN_GENERATION_SYSTEM_PROMPT, including placeholder URLs and default design templates.

### Problem 4: Voice input circular dependency
- **Root cause**: `handleVoiceTranscript` depended on `chatMessages`, `designTree`, `designSystem` (through `sendMessage`).
- **Fix**: The ref pattern from Problem 1 also fixes this. `handleVoiceTranscript` now only depends on `[sendMessage]`, and `sendMessage` is stable.

### Problem 5: New Project dialog
- **Root cause**: App auto-created "Untitled Project" with no user input.
- **Fix**: Created NewProjectDialog component with project name input and type selection (8 types matching i18n). Modified ZDesignApp to show the dialog when no project exists, instead of auto-creating one.

## Files Modified
- `src/components/zdesign/ChatPanel.tsx` — refs pattern, mounted timestamp
- `src/app/page.tsx` — suppressHydrationWarning wrapper
- `src/hooks/useVoiceInput.ts` — deferred isSupported, simplified window access
- `src/lib/ai-prompts.ts` — emerald colors throughout
- `src/components/zdesign/ZDesignApp.tsx` — NewProjectDialog integration
- `src/types/speech-recognition.d.ts` — new file, Web Speech API types
- `src/components/zdesign/NewProjectDialog.tsx` — new file, onboarding dialog
