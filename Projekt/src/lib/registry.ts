/**
 * Auto-Discovery Registry (F2)
 * ---------------------------
 * Scans the project for file-based skills, design-systems, panelists, and
 * audits. This is the foundation layer: it is purely informational — it lists
 * what files exist on disk. The existing hardcoded arrays (systems.ts,
 * panelists.ts, anti-slop.ts) remain the active pipeline source; scanned
 * entries EXTEND that base (wiring of auto-loaded files into the active
 * pipeline comes in a later phase).
 *
 * Design choices:
 *  - Pure fs, sync, defensive. Missing directories → empty arrays, never throw.
 *  - Scans the canonical physical locations under src/lib/ where these
 *    resources live (and where new .md/.ts files for each category would be
 *    dropped). The category roots map to:
 *      skills         → src/lib/ai/skills/
 *      design-systems → src/lib/design-systems/
 *      panelists      → src/lib/ai/skills/   (panelists are co-located with skills;
 *                                             a file is a panelist if it mentions
 *                                             the panelist contract)
 *      audits         → src/lib/audit/
 *  - One file = one entry. A file may surface under multiple categories only
 *    when it lives in a shared directory (skills/panelists); we disambiguate
 *    panelists by a cheap content heuristic so the same file is not double-counted.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, basename, extname } from 'path';

export type RegistryType = 'skill' | 'design-system' | 'panelist' | 'audit';

export interface RegistryEntry {
  /** Stem of the filename, e.g. "art-direction" from "art-direction.ts". */
  name: string;
  /** Absolute path to the file on disk. */
  path: string;
  /** Category the file was discovered under. */
  type: RegistryType;
  /** File extension (".ts", ".md", ...). Useful for later loaders. */
  ext: string;
}

export interface RegistrySnapshot {
  skills: RegistryEntry[];
  designSystems: RegistryEntry[];
  panelists: RegistryEntry[];
  audits: RegistryEntry[];
}

/** Project root = three levels up from this file (src/lib/registry.ts → root). */
const PROJECT_ROOT = join(__dirname, '..', '..');

/** Physical scan roots, relative to PROJECT_ROOT. */
const ROOTS: Record<Exclude<RegistryType, 'panelist'>, string> = {
  skill: 'src/lib/ai/skills',
  'design-system': 'src/lib/design-systems',
  audit: 'src/lib/audit',
};

/** Extensions we treat as registry-discoverable resources. */
const SCAN_EXTS = new Set(['.ts', '.tsx', '.md', '.mdx', '.js', '.mjs']);

/** Files that are infrastructure, not user-facing skills/resources. */
const IGNORE_FILES = new Set([
  'registry.ts', // this file (self)
  'index.ts',
  'index.js',
]);

/**
 * Cheap heuristic: does this file define a panelist? Panelist files import or
 * declare the panelist contract (PanelistDef / PanelistRole). We read at most
 * the first 4KB to stay fast.
 */
function looksLikePanelist(filePath: string): boolean {
  try {
    const head = readFileSync(filePath, 'utf8').slice(0, 4096);
    return /PanelistDef|PanelistRole|PANELISTS\s*[:=]/.test(head);
  } catch {
    return false;
  }
}

/**
 * List resource files in a single directory (non-recursive).
 * Returns [] if the directory does not exist or cannot be read.
 */
function listDirectory(dirAbs: string): string[] {
  try {
    if (!existsSync(dirAbs)) return [];
    const st = statSync(dirAbs);
    if (!st.isDirectory()) return [];
    return readdirSync(dirAbs);
  } catch {
    return [];
  }
}

/** Build RegistryEntry[] for one category root. */
function scanCategory(type: RegistryType, rootRel: string): RegistryEntry[] {
  const dirAbs = join(PROJECT_ROOT, rootRel);
  const files = listDirectory(dirAbs);
  const entries: RegistryEntry[] = [];

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (!SCAN_EXTS.has(ext)) continue;
    if (IGNORE_FILES.has(file.toLowerCase())) continue;

    const abs = join(dirAbs, file);
    try {
      if (!statSync(abs).isFile()) continue;
    } catch {
      continue;
    }

    // Panelist disambiguation: a file in the skills dir counts as a panelist
    // only if it declares the panelist contract; otherwise it's a skill.
    if (type === 'skill' && ext === '.ts' && looksLikePanelist(abs)) {
      continue; // surfaced under panelists instead, not double-counted as a skill
    }

    entries.push({
      name: basename(file, ext),
      path: abs,
      type,
      ext,
    });
  }

  // Stable, human-friendly order.
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

/**
 * Scan the whole project and return a snapshot of all discovered resources.
 * Never throws; missing directories yield empty arrays.
 */
export function scanRegistry(): RegistrySnapshot {
  const skills = scanCategory('skill', ROOTS.skill);

  // Panelists share the skills dir; pick only the panelist-contract files.
  const skillsDirAbs = join(PROJECT_ROOT, ROOTS.skill);
  const panelists: RegistryEntry[] = listDirectory(skillsDirAbs)
    .filter((file) => {
      const ext = extname(file).toLowerCase();
      if (!SCAN_EXTS.has(ext)) return false;
      if (IGNORE_FILES.has(file.toLowerCase())) return false;
      return looksLikePanelist(join(skillsDirAbs, file));
    })
    .map((file) => {
      const ext = extname(file).toLowerCase();
      return {
        name: basename(file, ext),
        path: join(skillsDirAbs, file),
        type: 'panelist' as const,
        ext,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const designSystems = scanCategory('design-system', ROOTS['design-system']);
  const audits = scanCategory('audit', ROOTS.audit);

  return { skills, designSystems, panelists, audits };
}

/**
 * Convenience: list entries for a single category by type name.
 * Accepts the union type or any string (unknown → []).
 */
export function listAvailable(type: string): RegistryEntry[] {
  const snap = scanRegistry();
  switch (type) {
    case 'skill':
      return snap.skills;
    case 'design-system':
      return snap.designSystems;
    case 'panelist':
      return snap.panelists;
    case 'audit':
      return snap.audits;
    default:
      return [];
  }
}
