import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { requireCurrentUser } from '../../../lib/session';
import { errorInfo } from '../../../lib/errors';

const VALID_TIERS = ['HEAVY', 'MEDIUM', 'LIGHT'];
const VALID_SET_TYPES = ['WARMUP', 'WORKING', 'RECOVERY'];

type TemplateBlockInput = { tier: 'HEAVY' | 'MEDIUM' | 'LIGHT'; setType: 'WARMUP' | 'WORKING' | 'RECOVERY'; count: number };

export async function GET(request: NextRequest) {
  try {
    const exerciseTypeId = request.nextUrl.searchParams.get('exerciseTypeId');
    const templates = await prisma.workoutTemplate.findMany({
      where: exerciseTypeId ? { exerciseTypeId } : undefined,
      include: { blocks: { orderBy: { order: 'asc' } }, exerciseType: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Erreur GET /api/templates', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des séances préenregistrées' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireCurrentUser();

    const body = await request.json();
    const exerciseTypeId = typeof body.exerciseTypeId === 'string' ? body.exerciseTypeId : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const heavyWeight = Number(body.heavyWeight);
    const mediumWeight = body.mediumWeight === null || body.mediumWeight === undefined || body.mediumWeight === ''
      ? null
      : Number(body.mediumWeight);
    const lightWeight = body.lightWeight === null || body.lightWeight === undefined || body.lightWeight === ''
      ? null
      : Number(body.lightWeight);
    const blocks: TemplateBlockInput[] = Array.isArray(body.blocks) ? body.blocks : [];

    if (!exerciseTypeId || !name) {
      return NextResponse.json({ error: 'Type de séance et nom requis' }, { status: 400 });
    }
    if (!Number.isFinite(heavyWeight)) {
      return NextResponse.json({ error: 'Le leste/poids le plus lourd est requis' }, { status: 400 });
    }
    if (blocks.length === 0) {
      return NextResponse.json({ error: 'Ajoute au moins une série au modèle' }, { status: 400 });
    }
    for (const block of blocks) {
      if (!VALID_TIERS.includes(block.tier) || !VALID_SET_TYPES.includes(block.setType) || !Number.isInteger(block.count) || block.count < 1) {
        return NextResponse.json({ error: 'Bloc de séries invalide' }, { status: 400 });
      }
    }

    const template = await prisma.workoutTemplate.create({
      data: {
        exerciseTypeId,
        name,
        heavyWeight,
        mediumWeight,
        lightWeight,
        blocks: {
          create: blocks.map((b, idx) => ({
            order: idx,
            tier: b.tier,
            setType: b.setType,
            count: b.count,
          })),
        },
      },
      include: { blocks: { orderBy: { order: 'asc' } } },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    const { message, code } = errorInfo(error);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    if (code === 'P2002') {
      return NextResponse.json({ error: 'Une séance préenregistrée avec ce nom existe déjà pour ce type' }, { status: 409 });
    }
    console.error('Erreur POST /api/templates', error);
    return NextResponse.json({ error: 'Erreur lors de la création de la séance préenregistrée' }, { status: 500 });
  }
}
