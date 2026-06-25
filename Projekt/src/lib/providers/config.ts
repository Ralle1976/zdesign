// Z.Design — Provider Config (active selection + persistence)
//
// Resolves WHICH provider is currently active for each modality and persists
// user overrides to `data/provider-config.json`. The precedence is:
//
//   1. data/provider-config.json   (explicit user choice from the settings UI)
//   2. process.env fallback         (ZAI_API_KEY → text=zai; MINIMAX_API_KEY →
//                                    image=minimax-image)
//   3. registry default             (the provider flagged `active: true` in
//                                    ./registry.ts)
//
// This is the read/write companion to ./registry.ts (read-only catalogue) and
// the source of truth for getActiveTextProvider()/getActiveImageProvider() used
// across the app.
//
// No external dependencies. Server-side only (touches the filesystem).

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ProviderConfig } from "./registry";
import { getProviderRegistry } from "./registry";

/** Path to the persisted override file (relative to project root). */
const CONFIG_FILE = path.join(process.cwd(), "data", "provider-config.json");

/** Shape of the persisted override file. */
interface PersistedProviderConfig {
  /** Selected text provider id, e.g. "zai". */
  text?: string;
  /** Selected image provider id, e.g. "minimax-image". */
  image?: string;
  /** Per-provider selected model overrides, keyed by provider id. */
  selectedModels?: Record<string, string>;
  /** Per-provider enabled flags, keyed by provider id. */
  enabled?: Record<string, boolean>;
}

// In-process cache so repeated reads within one request don't hit disk.
let cachedOverrides: PersistedProviderConfig | null = null;
let cacheLoaded = false;

/**
 * Read the persisted overrides from disk (best-effort). Returns {} on any error
 * or when the file is absent — never throws.
 */
async function loadOverrides(): Promise<PersistedProviderConfig> {
  if (cacheLoaded) return cachedOverrides ?? {};
  cacheLoaded = true;
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf8");
    cachedOverrides = JSON.parse(raw) as PersistedProviderConfig;
    return cachedOverrides;
  } catch {
    // Missing file or invalid JSON → treat as no overrides.
    cachedOverrides = {};
    return cachedOverrides;
  }
}

/**
 * Resolve the active text provider id.
 *
 * Precedence: persisted override → env hint (ZAI_API_KEY present → "zai") →
 * registry default (first text provider flagged `active`).
 */
export async function getActiveTextProvider(): Promise<string> {
  const overrides = await loadOverrides();
  if (overrides.text) return overrides.text;

  // Env fallback: Z.ai key present → it's the default text path (proven).
  if (process.env.ZAI_API_KEY) return "zai";

  // Registry default.
  const def = getProviderRegistry().find((p) => p.type === "text" && p.active);
  return def?.id ?? "zai";
}

/**
 * Resolve the active image provider id.
 *
 * Precedence: persisted override → env hint (MINIMAX_API_KEY → "minimax-image";
 * REPLICATE_API_TOKEN → "replicate") → registry default.
 */
export async function getActiveImageProvider(): Promise<string> {
  const overrides = await loadOverrides();
  if (overrides.image) return overrides.image;

  if (process.env.MINIMAX_API_KEY) return "minimax-image";
  if (process.env.REPLICATE_API_TOKEN) return "replicate";

  const def = getProviderRegistry().find((p) => p.type === "image" && p.active);
  return def?.id ?? "minimax-image";
}

/**
 * Full provider config snapshot for the settings UI.
 *
 * - `text` / `image`: the currently active provider id for each modality.
 * - `configured`: every provider whose credentials are present (status
 *   "connected"), i.e. the ones the user can actually select.
 */
export async function getProviderConfig(): Promise<{
  text: string;
  image: string;
  configured: ProviderConfig[];
}> {
  const [text, image] = await Promise.all([
    getActiveTextProvider(),
    getActiveImageProvider(),
  ]);
  const configured = getProviderRegistry().filter((p) => p.status === "connected");
  return { text, image, configured };
}

/**
 * Persist a config update to `data/provider-config.json`.
 *
 * Accepts a partial override object — only the supplied keys are overwritten;
 * existing keys are preserved. Merges into the on-disk state and rewrites the
 * whole file. Never throws: on write failure the error is logged and swallowed
 * (the in-memory cache is still updated so the current request sees the change).
 *
 * Recognised keys: `text`, `image`, `selectedModels`, `enabled`.
 */
export async function setProviderConfig(
  updates: Record<string, unknown>,
): Promise<void> {
  const current = await loadOverrides();
  const next: PersistedProviderConfig = {
    text: typeof updates.text === "string" ? (updates.text as string) : current.text,
    image:
      typeof updates.image === "string" ? (updates.image as string) : current.image,
    selectedModels: {
      ...current.selectedModels,
      ...(updates.selectedModels && typeof updates.selectedModels === "object"
        ? (updates.selectedModels as Record<string, string>)
        : {}),
    },
    enabled: {
      ...current.enabled,
      ...(updates.enabled && typeof updates.enabled === "object"
        ? (updates.enabled as Record<string, boolean>)
        : {}),
    },
  };

  cachedOverrides = next;
  cacheLoaded = true;

  try {
    await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(next, null, 2), "utf8");
  } catch (e) {
    console.error(
      "[providers/config] failed to persist provider-config.json:",
      e instanceof Error ? e.message : e,
    );
  }
}
