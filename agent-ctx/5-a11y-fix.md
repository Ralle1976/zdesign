# Task 5: A11y Score Discrepancy Fix

## Summary
Fixed the critical discrepancy where the A11y score in the chat quality evaluation showed 100 while the Props Panel badge showed 0.

## Files Modified
1. `/src/lib/accessibility.ts` - Rewrote scoring algorithm, fixed heading detection, large text detection, image alt check
2. `/src/app/api/design/evaluate/route.ts` - Rewrote server-side accessibility evaluation with proper WCAG contrast calculation
3. `/src/types/design.ts` - Added `alt`, `role`, `ariaLabel` to DesignNodeMeta
4. `/src/components/zdesign/canvas/DesignRenderer.tsx` - Added a11y attribute rendering (role, aria-label, alt)
5. `/src/app/api/chat/route.ts` - Added ariaLabel/role/alt to all fallback designs
6. `/src/components/zdesign/AccessibilityScanner.tsx` - Minor cleanup

## Key Changes
- Scoring: Per-category weighted scoring instead of flat penalty accumulation
- Scanner: Fixed heading level detection (uses tag, not just componentRef), fixed WCAG large text logic
- Server: Full WCAG contrast ratio calculation instead of hardcoded color patterns
- Renderer: Now renders role, aria-label, and alt from meta
- Fallbacks: All nav/footer/section elements have ariaLabel and role; images have alt text

## Expected Result
Fallback designs should now score 55-80 on both client and server, instead of 0/100.
