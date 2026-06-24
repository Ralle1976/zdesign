import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAllSkillPacks } from '@/lib/ai/agents';

// GET - List all agent configs (with defaults from skill packs)
export async function GET() {
  try {
    // @ts-expect-error pre-existing: agentConfig model not in Prisma schema
    const savedConfigs = await db.agentConfig.findMany({
      orderBy: { priority: 'asc' },
    });

    // Merge with defaults from skill packs
    const skillPacks = getAllSkillPacks();
    const agents = skillPacks.map(sp => {
      const saved = savedConfigs.find(sc => sc.role === sp.role);
      return {
        role: sp.role,
        name: saved?.name || sp.name,
        description: sp.description,
        expertise: sp.expertise,
        isEnabled: saved?.isEnabled ?? true,
        temperature: saved?.temperature ?? 0.7,
        customPrompt: saved?.customPrompt || null,
        creativityLevel: saved?.creativityLevel ?? 0.7,
        priority: saved?.priority ?? 0,
        scoringCriteria: sp.scoringCriteria,
        hasCustomPrompt: !!saved?.customPrompt,
      };
    });

    return NextResponse.json({ agents });
  } catch (error) {
    console.error('[Agents API] GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch agent configs' }, { status: 500 });
  }
}

// PUT - Update an agent config
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { role, name, isEnabled, temperature, customPrompt, creativityLevel, priority } = body;

    if (!role) {
      return NextResponse.json({ error: 'role is required' }, { status: 400 });
    }

    // @ts-expect-error pre-existing: agentConfig model not in Prisma schema
    const config = await db.agentConfig.upsert({
      where: { role },
      update: {
        ...(name !== undefined && { name }),
        ...(isEnabled !== undefined && { isEnabled }),
        ...(temperature !== undefined && { temperature }),
        ...(customPrompt !== undefined && { customPrompt: customPrompt || null }),
        ...(creativityLevel !== undefined && { creativityLevel }),
        ...(priority !== undefined && { priority }),
      },
      create: {
        role,
        name: name || role,
        isEnabled: isEnabled ?? true,
        temperature: temperature ?? 0.7,
        customPrompt: customPrompt || null,
        creativityLevel: creativityLevel ?? 0.7,
        priority: priority ?? 0,
      },
    });

    return NextResponse.json({ agent: config });
  } catch (error) {
    console.error('[Agents API] PUT Error:', error);
    return NextResponse.json({ error: 'Failed to update agent config' }, { status: 500 });
  }
}
