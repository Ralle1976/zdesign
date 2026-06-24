# Task 6: Template & Source Ingestion

## Summary
Built the Design Import API and updated the TemplateHub Import tab to support importing designs from URLs, JSON, and Figma.

## Files Created
- `/home/z/my-project/src/app/api/design/import/route.ts` — Design Import API with support for url, json, figma, image sources

## Files Modified
- `/home/z/my-project/src/components/zdesign/TemplateHub.tsx` — Updated import tab with new import handlers and redesigned UI
- `/home/z/my-project/worklog.md` — Appended work log entry

## Key Design Decisions
- Import API is a single POST endpoint at `/api/design/import` with `source` field routing to different import strategies
- URL import extracts title, meta description, colors, and headings from HTML to build a design tree
- JSON import has smart detection for Z.Design format, Figma export format, and wrapped designs
- Figma URL import creates a dark-themed placeholder design since Figma API requires authentication
- Image import returns a placeholder with guidance to use VLM chat (no VLM call in import API to keep it fast)
- `importing` state changed from boolean to string to track which import type is active and show correct loading indicator
- All import buttons disabled while any import is in progress to prevent concurrent requests
- DB update for projectId is non-blocking — won't fail the import if DB write fails

## API Endpoint
- `POST /api/design/import` — Accepts `{ source: 'url'|'json'|'figma'|'image', data: string, projectId?: string }`
  - Returns `{ design: object, source: string, title?: string, ... }` on success
  - Returns `{ error: string, details?: string }` on failure
