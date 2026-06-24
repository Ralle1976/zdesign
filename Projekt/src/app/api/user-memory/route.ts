/**
 * /api/user-memory — M1: GET/POST the user-memory.md file.
 *
 * GET  → { content: string }   (content is "" if the file is missing)
 * POST → { ok: true }          (body: { content: string })
 *
 * Delegates all disk logic to src/lib/ai/memory/user-memory.ts so the cache
 * and the "never throw" guarantees live in one place.
 */

import { NextRequest, NextResponse } from "next/server";
import { loadUserMemory, saveUserMemory } from "@/lib/ai/memory/user-memory";

export async function GET() {
  try {
    const content = await loadUserMemory();
    return NextResponse.json({ content });
  } catch (error) {
    console.error("[User Memory API] GET Error:", error);
    return NextResponse.json(
      { content: "", error: "Failed to load user memory" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const content =
      typeof body?.content === "string" ? body.content : String(body?.content ?? "");

    await saveUserMemory(content);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[User Memory API] POST Error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to save user memory" },
      { status: 500 },
    );
  }
}
