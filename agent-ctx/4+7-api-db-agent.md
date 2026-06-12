# Task 4+7: Update Prisma Schema + API Routes for Rate Limits and Model Loading

## Agent: API & DB Agent

## Work Completed

### 1. Prisma Schema Update
- Updated `AIProvider` model with rate limit tracking fields:
  - `requestsUsed`, `requestsLimit`, `requestsResetAt` — Request-level rate limits
  - `tokensUsed`, `tokensLimit`, `tokensResetAt` — Token-level rate limits
  - `isRateLimited`, `lastError`, `lastUsedAt` — Auto-rotation support
- Added `openrouter` and `minimax` to provider type comment
- Ran `db:push` successfully

### 2. Dynamic Model Loading API (`/api/providers/models`)
- Supports 6 provider types: openrouter, minimax, openai, anthropic, google, stability
- OpenRouter: Live fetch from `https://openrouter.ai/api/v1/models` (no auth)
- Minimax: Static curated model list
- OpenAI: Live fetch from `{baseUrl}/models` (auth required)
- Anthropic/Google/Stability: Static curated model lists
- Returns `DynamicModelInfo[]` with capabilities, context lengths, pricing, isFree flag

### 3. Rate Limits API (`/api/providers/rate-limits`)
- GET: Returns rate limit status for all active providers with calculated `requestsRemaining`/`tokensRemaining`
- POST: Updates rate limit fields for a specific provider by ID
- Auto-resets rate limit flag when reset time has passed

### 4. Updated Providers API (`/api/providers`)
- GET handler now includes rate limit info in response
- POST handler supports `requestsLimit` and `tokensLimit` on creation
- PUT handler supports all rate limit fields for updating
- PUT handler guards against activating rate-limited providers (returns 409)
- Provider type cast updated to include `openrouter` | `minimax`

## Files Modified
- `prisma/schema.prisma`
- `src/app/api/providers/route.ts`

## Files Created
- `src/app/api/providers/models/route.ts`
- `src/app/api/providers/rate-limits/route.ts`
