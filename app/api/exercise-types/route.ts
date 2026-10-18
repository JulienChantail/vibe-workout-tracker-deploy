import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { requireCurrentUser } from '../../../lib/session';
import { errorInfo } from '../../../lib/errors';

export async function GET() {
  try {
    const exerciseTypes = await prisma.exerciseType.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json(exerciseTypes);
  } catch (error) {
    console.error('Erreur GET /api/exercise-types', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des types de séance' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireCurrentUser();

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const category = body.category === 'EXTERNAL_WEIGHT' ? 'EXTERNAL_WEIGHT' : 'BODYWEIGHT_LESTE';
    const weightLabel =
      typeof body.weightLabel === 'string' && body.weightLabel.trim()
        ? body.weightLabel.trim()
        : category === 'EXTERNAL_WEIGHT'
          ? 'Poids (kg)'
          : 'Leste (kg)';
    const quickWeights = Array.isArray(body.quickWeights)
      ? body.quickWeights.map(Number).filter((n: number) => Number.isFinite(n)).sort((a: number, b: number) => a - b)
      : [];
    const weightStep = Number.isFinite(Number(body.weightStep)) ? Number(body.weightStep) : 5;

    if (!name) {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 });
    }

    const exerciseType = await prisma.exerciseType.create({
      data: { name, category, weightLabel, quickWeights, weightStep },
    });

    return NextResponse.json(exerciseType, { status: 201 });
  } catch (error) {
    const { message, code } = errorInfo(error);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    if (code === 'P2002') {
      return NextResponse.json({ error: 'Un type de séance avec ce nom existe déjà' }, { status: 409 });
    }
    console.error('Erreur POST /api/exercise-types', error);
    return NextResponse.json({ error: 'Erreur lors de la création du type de séance' }, { status: 500 });
  }
}
