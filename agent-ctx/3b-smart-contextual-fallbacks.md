# Task 3b: Smart Contextual Fallbacks for Broken LLM JSON

## Summary
Implemented smart contextual fallbacks so that when the LLM generates a response but JSON parsing fails (even after repairLLMJson), users still get a high-quality, topic-aware design instead of seeing nothing or a partial design.

## Changes Made

### `/src/app/api/chat/route.ts`
- Added `TOPIC_TEMPLATES` array with 8 topic-aware templates (Fitness, Restaurant, Crypto, Education, E-Commerce, Blog, Portfolio, Travel)
- Added `generateContextualFallback(userMessage, llmMessage, creativeMode)` function
- Updated POST handler: after repairLLMJson fails, extracts LLM message text and generates contextual fallback
- Added `templateUsed` boolean to API response
- Changed `parseFailed` to `!parsed.design`

### `/src/types/design.ts`
- Added `templateUsed?: boolean` to `ChatMessageMeta` interface

### `/src/components/zdesign/ChatPanel.tsx`
- Removed `onRetryParse` prop, `handleRetryParse` callback, `AlertTriangle`/`RefreshCw` imports
- Added `isTemplateUsed` detection in MessageBubble
- Shows blue info text: "✨ AI-guided template — You can customize this design by telling me what to change!"
- Changed parse failure and fallback warnings to positive framing
- Removed Retry button for parse failures

## Verification
- ESLint passes cleanly
- All changes backward-compatible
