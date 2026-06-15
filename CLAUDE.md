# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Z.Design is an AI-powered visual design platform that generates professional designs from natural language descriptions. Users chat with the AI to create designs, then manipulate elements through direct canvas interaction. The platform features multi-provider AI support, real-time collaboration, and comprehensive design system management.

### Core Architecture

The application follows a **chat-to-design pipeline**:
- User input → ChatPanel → AI processing → JSON tree structure → Recursive React rendering
- Three-tier fallback system: direct parse → JSON repair → contextual templates
- Real-time collaboration via Socket.IO on port 3003
- Reverse proxy through Caddy on port 81

### Technology Stack

- **Framework**: Next.js 16.1.1 (App Router)
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **State**: Zustand 5.0.6
- **Database**: Prisma 6.11.1 + SQLite
- **AI**: z-ai-web-dev-sdk 0.0.18 (currently only Z.ai active)
- **Real-time**: Socket.IO 4.8.3
- **Runtime**: Bun

## Development Commands

```bash
# Start development server (port 3000)
bun run dev

# Build for production
bun run build

# Start production server
bun run start

# Lint code
bun run lint

# Database operations
bun run db:push      # Push schema changes
bun run db:generate   # Generate Prisma client
bun run db:migrate    # Run migrations
bun run db:reset      # Reset database
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Single route (ZDesignApp)
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   └── api/                  # 26 API routes
├── components/
│   ├── zdesign/              # 27 main components
│   ├── zdesign/canvas/       # 8 canvas components
│   └── ui/                   # 45+ shadcn/ui primitives
├── stores/
│   └── zdesign-store.ts      # Zustand store (507 lines)
├── hooks/                    # 4 custom hooks
├── i18n/                     # EN + DE translations
├── lib/                      # Utilities, AI prompts (829 lines)
├── types/
│   └── design.ts             # 374 lines type definitions
mini-services/
└── collab-service/           # Socket.IO server (port 3003)
```

## Critical Code Patterns

### DesignNode Updates (NEVER mutate directly)

```typescript
// ❌ WRONG: Direct mutation
selectedNode.style.fontSize = '16px'

// ✅ CORRECT: Use updateNode with style spread
updateNode(selectedNodeId, { 
  style: { ...currentNode.style, fontSize: '16px' } 
})
```

**Important**: `updateNode()` does shallow merge at node level. Always spread style objects to avoid deleting other style properties.

### API Communication with Caddy Proxy

```typescript
// ✅ CORRECT: Relative path with port transform
fetch('/api/test?XTransformPort=3030')

// ❌ WRONG: Direct URL
fetch('http://localhost:3030/api/test')
```

### Socket.IO Connection

```typescript
// ✅ CORRECT: With port transform
io("/?XTransformPort=3003")

// ❌ WRONG: Direct URL
io("http://localhost:3003")
```

### AI SDK Usage (Backend Only)

```typescript
// ✅ CORRECT: Only in API routes
import ZAI from 'z-ai-web-dev-sdk';
const zai = await ZAI.create();
const result = await zai.chat({ messages: [...] });

// ❌ WRONG: Never use in client components
```

### Persistence Flows

**Page Load:**
1. `GET /api/projects` → projectId
2. `GET /api/projects/[id]` → designJSON → `loadDesignTree()` (no undo history)
3. `GET /api/chat?projectId=...` → chatMessages → `setChatMessages()`

**Auto-Save (5s debounce):**
- designTree + isDirty → `PATCH /api/projects/[id]` → `{ designJSON: JSON.stringify(tree) }`

**Chat → Design:**
- `POST /api/chat` → Z.ai LLM → parsed.design → `setDesignTree()` (WITH undo history)
- → db.project.update({ designJSON }) → db.chatMessage.create()

## Key Architectural Decisions

### Design Engine Pipeline

```
User Input → ChatPanel → POST /api/chat → Z.ai LLM → JSON Response
    ↓
parseAIResponse() → repairLLMJson() → Fallback-Templates
    ↓
designJSON → Prisma DB + Zustand Store
    ↓
DesignRenderer → Recursive React Rendering
```

### Three-Tier Fallback System

1. **Direct Parse** — Attempts to parse JSON directly
2. **JSON Repair** — 12+ repair steps for malformed LLM JSON
3. **Contextual Fallback** — 8 thematic templates (Fitness, Restaurant, Crypto, etc.)

### Database Schema Key Points

- **Project**: Core entity with designJSON, type, status
- **Version**: Branch-based versioning with parentVersionId
- **DesignSystem**: Tokens, components, styles as JSON
- **Comment**: Element-specific annotations with x, y coordinates
- **ChatMessage**: Full conversation history per project

## Known Issues & Technical Debt

### High Priority (P1)

- **O1**: PDF export is fake (HTML with .pdf extension) — needs Puppeteer/Playwright or jsPDF
- **O2**: ZIP export incomplete — missing CSS and assets
- **O3**: No LLM streaming — 60-90s wait without feedback
- **O4**: Chart nodes render empty — need Recharts integration
- **O5**: No pseudo-states (hover, focus, active)
- **O6**: No responsive breakpoints in schema
- **O7**: Collaboration not wired in UI

### Technical Debt

- **T1**: `typescript.ignoreBuildErrors: true` — type errors not caught
- **T2**: `reactStrictMode: false` — missing double renders in dev
- **T3**: SQLite doesn't scale — use PostgreSQL for production
- **T4**: No test setup (0 tests) — high refactoring risk
- **T5**: Chat API route is 1,205 lines — needs modularization
- **T6**: PropsPanel is 1,549 lines — needs component splitting
- **T7**: Store is 507 lines — needs slice separation
- **T8**: No error boundaries — crashes = white screen
- **T9**: No rate limiting on AI endpoints
- **T10**: Auto-save creates version for every save

## Important Files to Understand First

1. `/src/types/design.ts` — DesignNode schema (374 lines)
2. `/src/stores/zdesign-store.ts` — State management (507 lines)
3. `/src/app/api/chat/route.ts` — AI pipeline (1,205 lines)
4. `/src/components/zdesign/canvas/DesignRenderer.tsx` — Rendering logic
5. `/src/lib/ai-prompts.ts` — Prompt strategy (829 lines)

## Critical Rules

1. **NEVER** mutate DesignNode directly — always use `updateNode()`
2. **ALWAYS** spread style objects — `updateNode(id, { style: {...old, ...new} })`
3. **NEVER** use `z-ai-web-dev-sdk` in client — only in API routes
4. **ALWAYS** use `?XTransformPort=` for other ports — never direct URLs
5. **ALWAYS** use `loadDesignTree()` for initial load — `setDesignTree()` creates undo history
6. **NEVER** use `fetch('http://localhost:...')` — always relative paths
7. **LINT CHECK** with `bun run lint` before every commit

## Canvas Interaction Patterns

### Selection & Manipulation
- **SelectionOverlay**: Handles selection border, resize handles, drag-to-move
- **Drag-to-move**: Activate on selection border, calls `nudgeNode()`
- **Drag-to-resize**: 8 functional resize handles
- **Keyboard shortcuts**: Del, Esc, Ctrl+Z/Y, arrow keys
- **Canvas panning**: Space+Drag with transform: translate()

### Property Editing
PropsPanel includes 7 editors:
1. Content Editor
2. Layout Editor
3. Spacing Editor
4. Typography Editor
5. Background Editor
6. Border Editor
7. Effects Editor

## Multi-Language Support

- **i18n/**: EN + DE translations
- **next-intl**: Locale detection and routing
- **Default locale**: English (en)
- **Supported locales**: English (en), German (de)

## Export Functionality

### Supported Formats
- HTML: Static HTML export
- PDF: Currently fake (needs implementation)
- PPTX: PowerPoint export
- ZIP: Currently incomplete (missing CSS/assets)
- Next.js: Next.js project export
- React: React component export
- Figma: Figma format export

## Collaboration Architecture

```
Client → Socket.IO → mini-services/collab-service (Port 3003)
    ↕ Caddy Proxy with ?XTransformPort=3003
```

## Development Workflow

1. **Start development server**: `bun run dev`
2. **Database changes**: 
   - Modify `prisma/schema.prisma`
   - Run `bun run db:push`
3. **Code quality**: Run `bun run lint` before commits
4. **Test changes**: Use browser DevTools to verify functionality
5. **Check logs**: Monitor `dev.log` for server output

## Performance Considerations

- **Large designs**: Use recursive rendering with React.memo
- **AI responses**: Implement streaming for better UX (planned)
- **Database**: SQLite for development, PostgreSQL for production
- **State management**: Zustand for efficient re-renders
- **Canvas rendering**: Use transform for smooth panning/zooming

## Security Notes

- **AI endpoints**: Need rate limiting implementation
- **Authentication**: next-auth installed but not wired
- **File uploads**: Validate and sanitize user uploads
- **API keys**: Store in environment variables, never commit
- **Collaboration**: Implement proper user authorization

## Deployment Readiness

### Before Production Deployment
1. Implement real PDF export (Puppeteer/Playwright)
2. Complete ZIP export with CSS and assets
3. Add LLM streaming for better UX
4. Implement authentication system
5. Wire collaboration features in UI
6. Add error boundaries
7. Enable TypeScript strict mode
8. Implement rate limiting
9. Add comprehensive testing
10. Set up PostgreSQL database

### Deployment Architecture
- **Runtime**: Bun with Next.js standalone
- **Reverse proxy**: Caddy
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Collaboration**: Separate Socket.IO service
- **Static assets**: Served through Next.js

## Testing Strategy

### Current State
- **Unit tests**: None (0% coverage)
- **Integration tests**: None
- **E2E tests**: None

### Recommended Testing
1. **Unit tests**: Critical business logic (AI parsing, design tree operations)
2. **Integration tests**: API routes, database operations
3. **E2E tests**: Critical user flows (chat → design → export)
4. **Visual regression**: Design rendering consistency

## Quick Start Guide

### For New Developers

1. **Read in this order**:
   - `/src/types/design.ts` — Understand DesignNode schema
   - `/src/stores/zdesign-store.ts` — Understand state management
   - `/src/app/api/chat/route.ts` — Understand AI pipeline
   - `/src/components/zdesign/canvas/DesignRenderer.tsx` — Understand rendering
   - `/src/lib/ai-prompts.ts` — Understand prompt strategy

2. **Set up environment**:
   - Copy `.env.example` to `.env`
   - Configure DATABASE_URL
   - Add AI provider API keys

3. **Run development server**:
   ```bash
   bun run dev
   ```

4. **Make changes**:
   - Follow critical rules above
   - Test thoroughly
   - Run lint before commit

## Current Status

**Overall Quality Score: 6.5/10** (improved from 4.5)

- Persistence: 9/10 ✅
- Property Editing: 7/10 ✅
- Canvas Interaction: 7/10 ✅
- AI Prompt Quality: 7/10 ✅
- Node Rendering: 5/10 ⚠️
- CSS Support: 5/10 ⚠️
- Export Quality: 4/10 ❌
- Collaboration: 4/10 ❌
- Auth: 1/10 ❌

**Target: 8+/10**

### Priority Improvements Needed

1. Functional PDF/ZIP export
2. LLM streaming implementation
3. Pseudo-states + responsive breakpoints
4. Chart/icon/video rendering
5. Collaboration UI integration

## Additional Resources

- **Handover Document**: `/HANDOVER-DOCUMENT.md` — Comprehensive project documentation
- **Quality Report**: `/QUALITY-REPORT.md` — Current quality assessment
- **Worklog**: `/worklog.md` — Development history
- **Screenshots**: `/test-screenshots/` — Visual reference
- **Upload**: `/upload/` — Deployment documentation