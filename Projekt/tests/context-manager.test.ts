/**
 * context-manager.test.ts — M3 sanity test.
 *
 * Run:  bun test tests/context-manager.test.ts
 *
 * Verifies buildContext trims a large history down to fit a tight budget while
 * always retaining the last MIN_RETAINED_TURNS, and that shouldTrim() flips once
 * the context crosses 80% of the budget.
 */

import { describe, expect, test } from "bun:test";
import {
  buildContext,
  shouldTrim,
  trimHistory,
  estimateTokens,
  formatForModel,
  MIN_RETAINED_TURNS,
  type ChatTurn,
} from "../src/lib/ai/memory/context-manager";

describe("estimateTokens", () => {
  test("chars/4 heuristic, min 1", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a")).toBe(1);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
  });
});

describe("trimHistory", () => {
  test("keeps everything when under budget", () => {
    const turns: ChatTurn[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hey" },
    ];
    expect(trimHistory(turns, 10_000, 1_000)).toHaveLength(2);
  });

  test("empty input returns empty", () => {
    expect(trimHistory([], 10_000, 1_000)).toHaveLength(0);
  });

  test("trims oldest turns to fit, keeps last MIN_RETAINED_TURNS", () => {
    // 50 turns, each ~100 tokens => ~5000 tokens. Budget forces aggressive trim.
    const big = "x".repeat(400); // ~100 tokens
    const turns: ChatTurn[] = Array.from({ length: 50 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `${i}:${big}`,
    }));

    const maxTokens = 1_000;
    const reserved = 200; // budget for history = 800 tokens => ~8 turns, but floor is 3
    const out = trimHistory(turns, maxTokens, reserved);

    expect(out.length).toBeGreaterThanOrEqual(MIN_RETAINED_TURNS);
    expect(out.length).toBeLessThan(turns.length);
    // Must be the MOST RECENT turns (indices 47,48,49 kept).
    expect(out[out.length - 1].content).toBe(turns[turns.length - 1].content);
    expect(out[0].content).toBe(
      turns[turns.length - out.length].content
    );
  });

  test("never drops below MIN_RETAINED_TURNS even if over budget", () => {
    const big = "y".repeat(4_000); // ~1000 tokens each
    const turns: ChatTurn[] = Array.from({ length: 10 }, () => ({
      role: "user",
      content: big,
    }));
    const out = trimHistory(turns, 500, 0); // impossible budget
    expect(out).toHaveLength(MIN_RETAINED_TURNS);
  });
});

describe("buildContext", () => {
  test("assembles fixed parts + trimmed history and reports total", () => {
    const system = "You are a design agent.";
    const volatile = "ArtBrief: asian-spa, emerald, serif.";
    const history: ChatTurn[] = Array.from({ length: 40 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: "z".repeat(400), // ~100 tokens each => ~4000 total
    }));

    const ctx = buildContext({
      system,
      volatile,
      history,
      maxTokens: 2_000,
    });

    // system + volatile are retained in full.
    expect(ctx.system).toBe(system);
    expect(ctx.volatile).toBe(volatile);
    expect(ctx.userPrefs).toBe("");

    // History had to be trimmed; total must be under the budget (headroom aside).
    expect(ctx.history.length).toBeLessThan(history.length);
    expect(ctx.history.length).toBeGreaterThanOrEqual(MIN_RETAINED_TURNS);
    expect(ctx.totalEstimated).toBeGreaterThan(0);
    // Should not massively exceed budget given aggressive trimming.
    expect(ctx.totalEstimated).toBeLessThan(ctx.maxTokens);
  });

  test("shouldTrim false when small, true when large", () => {
    const small = buildContext({
      system: "s",
      volatile: "v",
      history: [{ role: "user", content: "hi" }],
      maxTokens: 10_000,
    });
    expect(shouldTrim(small)).toBe(false);

    // Build something guaranteed to exceed 80%.
    const huge = "q".repeat(200_000); // ~50k tokens
    const big = buildContext({
      system: huge,
      volatile: "v",
      history: [],
      maxTokens: 50_000,
    });
    expect(shouldTrim(big)).toBe(true);
  });

  test("formatForModel concatenates all sections", () => {
    const ctx = buildContext({
      system: "SYS",
      userPrefs: "PREFS",
      volatile: "VOL",
      history: [
        { role: "user", content: "U1" },
        { role: "assistant", content: "A1" },
      ],
      maxTokens: 10_000,
    });
    const out = formatForModel(ctx);
    expect(out).toContain("SYS");
    expect(out).toContain("PREFS");
    expect(out).toContain("VOL");
    expect(out).toContain("user: U1");
    expect(out).toContain("assistant: A1");
  });
});
