import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { requireCurrentUser } from '../../../lib/session';
import { sessionOneRepMax } from '../../../lib/oneRepMax';
import { errorInfo } from '../../../lib/errors';

export async function GET() {
  try {
    const currentUser = await requireCurrentUser();

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: currentUser.id },
      select: { bodyWeightKg: true },
    });

    const entries = await prisma.workoutEntry.findMany({
      where: {
        userId: currentUser.id,
        exerciseType: { category: 'BODYWEIGHT_LESTE' },
      },
      include: {
        exerciseType: { select: { id: true, name: true } },
        sets: true,
      },
    });

    const bestByType = new Map<string, { exerciseTypeId: string; exerciseTypeName: string; oneRepMax: number }>();
    for (const entry of entries) {
      const oneRepMax = sessionOneRepMax(entry.sets, user.bodyWeightKg ?? 0);
      if (oneRepMax === null) continue;
      const existing = bestByType.get(entry.exerciseType.id);
      if (!existing || oneRepMax > existing.oneRepMax) {
        bestByType.set(entry.exerciseType.id, {
          exerciseTypeId: entry.exerciseType.id,
          exerciseTypeName: entry.exerciseType.name,
          oneRepMax,
        });
      }
    }

    return NextResponse.json({
      bodyWeightKg: user.bodyWeightKg,
      oneRepMaxes: Array.from(bestByType.values()).sort((a, b) =>
        a.exerciseTypeName.localeCompare(b.exerciseTypeName)
      ),
    });
  } catch (error) {
    const { message } = errorInfo(error);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Erreur GET /api/body-weight', error);
    return NextResponse.json({ error: 'Erreur lors du chargement du poids du corps' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser();

    const body = await request.json();
    const bodyWeightKg = Number(body.bodyWeightKg);
    if (!Number.isFinite(bodyWeightKg) || bodyWeightKg <= 0 || bodyWeightKg > 400) {
      return NextResponse.json({ error: 'Poids du corps invalide' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: currentUser.id },
      data: { bodyWeightKg },
    });

    return NextResponse.json({ bodyWeightKg });
  } catch (error) {
    const { message } = errorInfo(error);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Erreur PUT /api/body-weight', error);
    return NextResponse.json({ error: 'Erreur lors de la sauvegarde du poids du corps' }, { status: 500 });
  }
}
