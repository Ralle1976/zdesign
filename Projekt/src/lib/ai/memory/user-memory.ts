/**
 * user-memory.ts — M1: Persistente Nutzerpraeferenzen.
 *
 * A tiny, dependency-free store for user-wide design preferences. The content
 * lives in data/user-memory.md (plain markdown) and is meant to be injected
 * into every design-generation prompt so the agent respects learned taste
 * (liked styles, brand constraints, things to avoid).
 *
 * Contract:
 *   - loadUserMemory() never throws — missing/unreadable file → "".
 *   - The file is cached per process (module-level) for the session; the first
 *     read hits disk, subsequent reads return the cached string.
 *   - saveUserMemory() writes the file AND updates the cache so later loads
 *     in the same process see the new content.
 *   - userMemoryToPromptBlock() formats the memory into a clearly-delimited
 *     German prompt section; empty memory → "" (so callers can blindly concat).
 *
 * No external dependencies. Pure fs + path.
 */

import { promises as fs } from "fs";
import path from "path";

/** Absolute path to the memory file. Resolved from the project root. */
const MEMORY_PATH = path.join(
  process.cwd(),
  "data",
  "user-memory.md",
);

/** Session cache. Populated on first load and refreshed on every save. */
let cached: string | null = null;

/**
 * Read the user-memory file. Returns "" when the file is missing or unreadable
 * (never throws). Result is cached for the lifetime of the process.
 */
export async function loadUserMemory(): Promise<string> {
  if (cached !== null) return cached;

  try {
    const content = await fs.readFile(MEMORY_PATH, "utf8");
    cached = content;
    return content;
  } catch {
    // ENOENT, permission errors, etc. — treat as empty memory.
    cached = "";
    return "";
  }
}

/**
 * Overwrite the user-memory file with `content` and refresh the session cache.
 */
export async function saveUserMemory(content: string): Promise<void> {
  // Ensure the data/ directory exists (mkdir -p). Safe if it already does.
  await fs.mkdir(path.dirname(MEMORY_PATH), { recursive: true });
  await fs.writeFile(MEMORY_PATH, content, "utf8");
  cached = content;
}

/**
 * Format raw memory markdown into a clearly-delimited prompt section. Returns
 * "" for empty/whitespace-only memory so callers can concat unconditionally.
 *
 * The header is German and instructs the model to always honor the block.
 */
export function userMemoryToPromptBlock(memory: string): string {
  if (!memory || !memory.trim()) return "";
  return (
    "=== NUTZER-PRAEFERENZEN (immer beruecksichtigen) ===\n" + memory
  );
}
