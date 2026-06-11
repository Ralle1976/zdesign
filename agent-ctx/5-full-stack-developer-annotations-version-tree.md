# Task 5 - Annotations & Version Tree
**Status:** ✅ Completed
**Date:** Thu Jun 11 2026
**Agent:** full-stack-developer (Annotations & Version Tree)

### Files Created

1. **`/src/app/api/projects/[id]/versions/route.ts`** — Versions list API endpoint
   - `GET` — List versions for a project with pagination, branch filtering, limit/offset
   - `POST` — Create a new version with label, changeSummary, branch, parentVersionId
   - Captures current project's designJSON as the version snapshot

2. **`/src/app/api/projects/[id]/versions/[versionId]/route.ts`** — Single Version API endpoint
   - `GET` — Get a specific version by ID (scoped to project)
   - `PATCH` — Update version label and changeSummary

3. **`/src/components/zdesign/AnnotationsPanel.tsx`** — Comments Panel
   - Header with comment count badge
   - Filter tabs: All / Open / Resolved with counts
   - Scrollable comment list with framer-motion animations
   - Each annotation shows: avatar with initials, username, relative timestamp, content
   - Color indicator bar (amber for open, gray for resolved)
   - Element reference badge (truncated element ID with Pin icon)
   - Resolve/Unresolve button on hover
   - Reply count display
   - Click to select/highlight element on canvas
   - Empty state with "No comments yet" message and Pin icon
   - Add Comment form at bottom with Input + Send button (Enter to submit)

4. **`/src/components/zdesign/VersionTree.tsx`** — Version History Panel
   - Header with "Save Version" button and "New Branch" button
   - Active branch indicator bar (shown when multiple branches exist)
   - Visual timeline with:
     - Timeline line and dots (green filled for current, hollow for others)
     - Editable version label (inline editing with Enter/Escape)
     - Relative timestamps using date-fns formatDistanceToNow
     - Branch name badges
     - Change summary text (2-line clamp)
     - Current version indicator badge (emerald)
     - Latest badge for most recent version on active branch
   - Actions per version (on hover):
     - Edit label (pencil icon)
     - Rollback (rotate-ccw icon) — loads designJSON from that version, updates store, shows toast
     - Create branch from here (git-fork icon)
   - "Save Version" dialog with label + summary inputs
   - "Create Branch" dialog with branch name input
   - Auto-fetches versions from API when projectId is set
   - Grouped display by branch when multiple branches exist
   - Empty state with "No versions saved yet" and quick save button
   - Tooltips on all action buttons
   - Framer Motion staggered entrance animations

5. **`/src/components/zdesign/PropsPanel.tsx`** — Updated with Tab Layout
   - Refactored to use shadcn/ui Tabs component
   - Three tabs: Properties (existing) | Comments (AnnotationsPanel) | Versions (VersionTree)
   - Tab triggers with icons and count badges
   - Responsive: icon-only on small screens, icon+text on larger
   - Properties content extracted to `PropertiesContent` inner component

### Files Modified

6. **`/src/stores/zdesign-store.ts`** — Added new store methods
   - Added `VersionData` to imports
   - `unresolveAnnotation(id)` — Reopens a resolved annotation
   - `setAnnotations(annotations)` — Bulk set annotations
   - `versions: VersionData[]` — Version list state
   - `setVersions(versions)` — Bulk set versions
   - `addVersion(version)` — Add version to front of list
   - `currentVersionId: string | null` — Track which version is current
   - `setCurrentVersionId(id)` — Set current version ID

7. **`/src/i18n/translations.ts`** — Extended i18n keys
   - English annotations: addComment, unresolve, open, all, reply, replies, submit, justNow, elementRef
   - English versions: rollbackConfirm, rollbackSuccess, label, summary, summaryPlaceholder, saveSuccess, createBranch, branchName, activeBranch, ago
   - German translations for all new keys

### Technical Decisions
- Used date-fns `formatDistanceToNow` for relative timestamps (already in package.json)
- Version tree uses grouped display by branch when multiple branches exist
- Annotations filter is client-side (no API call needed for filtering)
- Rollback loads designJSON from the version API and applies it to both the Zustand store and the project API
- Save Version first updates the project designJSON, then creates the version snapshot
- Inline label editing with blur/enter/escape handling
- All components use 'use client' directive

### Lint Status
✅ All lint checks pass with zero errors (1 unrelated warning in useCollaboration.ts)
