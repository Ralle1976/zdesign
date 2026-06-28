// Z.Design — WebApp emit (Plan Stage 0): wire the dead-code emitter.
//
// POST /api/webapp/emit { brief }
//   → buildArtBrief (deterministic art-direction as the emitter's artHint)
//   → emitNextGen (Gemini) → typed NextGenEmission (VerticalTemplateRegistryEntry + moduleContent)
//   → persist each module's content as a ModuleRecord row (moduleId = emit:<webappId>:<moduleKey>)
//   → returns { webappId, template, moduleContentCount, moduleRecordRows }
//
// This is the foundation wiring: proves the emitter is live + ModuleRecord is the content store.
// (WebappProject manifest persistence arrives in Stage 1.)
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { emitNextGen } from '@/lib/ai/nextgen/emitter';
import { buildArtBrief } from '@/lib/ai/skills/art-direction';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const brief = typeof body?.brief === 'string' ? body.brief.trim() : '';
    if (!brief) return NextResponse.json({ error: 'brief (string) required' }, { status: 400 });

    const art = buildArtBrief(brief);
    const artHint = `${art.domain} · ${art.mood} · Akzent ${art.palette.accent} · Display ${art.fonts.display}`;
    const { emission, reason } = await emitNextGen(brief, artHint);
    if (!emission) return NextResponse.json({ error: reason || 'emission failed' }, { status: 502 });

    const webappId = randomUUID();
    let rows = 0;
    for (const mc of emission.moduleContent) {
      try {
        await db.moduleRecord.create({
          data: { moduleId: `emit:${webappId}:${mc.moduleKey}`, data: JSON.stringify(mc.records ?? []) },
        });
        rows++;
      } catch (e) {
        console.warn('[webapp/emit] moduleRecord write failed for', mc.moduleKey, e instanceof Error ? e.message : e);
      }
    }

    return NextResponse.json({
      webappId,
      template: {
        key: emission.template.key,
        name: emission.template.name,
        verticalKey: emission.template.verticalKey,
        requiredModules: emission.template.requiredModules,
        callsToAction: emission.template.callsToAction.length,
        designFamilies: emission.template.designFamilies.length,
      },
      moduleContentCount: emission.moduleContent.length,
      moduleRecordRows: rows,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'emit failed';
    console.error('[webapp/emit] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
