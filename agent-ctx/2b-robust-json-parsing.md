# Task 2b: Robust JSON Parsing & Parse Failure UX

## Summary
Improved LLM JSON parsing robustness and added parse failure handling in the UI.

## Changes Made

### 1. `/src/lib/ai-prompts.ts` — Robust JSON Repair
- **New `repairLLMJson()` function**: Aggressively repairs malformed JSON from LLM output
  - Handles markdown wrappers, JS comments, key="value" (equals), unquoted keys, trailing commas, single quotes, missing commas, bracket balancing, progressive truncation
- **Updated `tryParseJSON()`**: Uses repair-first strategy with 7+ targeted fixes
- **Updated `parseAIResponse()`**: Returns `parseFailed?: boolean`, uses repair function, adds loose JSON matching

### 2. `/src/app/api/chat/route.ts` — Stronger JSON Emphasis
- Added CRITICAL rule as first rule in system prompt about valid JSON syntax
- Added `parseFailed` field to API response JSON

### 3. `/src/components/zdesign/ChatPanel.tsx` — Parse Failure UX
- Added `AlertTriangle`, `RefreshCw` icon imports
- Updated `MessageBubble` with `onRetryParse` prop and amber warning banner for parse failures
- Added `handleRetryParse` callback for retry functionality
- System message with `parseFailedRetryText` triggers warning with Retry button

### 4. `/src/types/design.ts` — Extended Types
- Added `usedFallback?: boolean` and `parseFailedRetryText?: string` to `ChatMessageMeta`

## Verification
- ESLint: passes cleanly
- Dev server: compiles without errors
- Page load: HTTP 200
