import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { requireCurrentUser } from '../../../lib/session';
import { errorInfo } from '../../../lib/errors';
import { normalizeCircuit, parseCircuit } from '../../../lib/circuit';
import { normalizeExerciseOptions, parseExerciseOptions } from '../../../lib/emom';

const VALID_CATEGORIES = ['BODYWEIGHT_LESTE', 'EXTERNAL_WEIGHT', 'CIRCUIT', 'EMOM'];

// SQL Server ne gère pas les tableaux : quickWeights, circuit et exerciseOptions sont stockés en JSON texte
function withParsedQuickWeights<T extends { quickWeights: string; circuit: string | null; exerciseOptions: string | null }>(
  exerciseType: T
) {
  return {
    ...exerciseType,
    quickWeights: JSON.parse(exerciseType.quickWeights) as number[],
    circuit: parseCircuit(exerciseType.circuit),
    exerciseOptions: parseExerciseOptions(exerciseType.exerciseOptions),
  };
}

export async function GET() {
  try {
    const exerciseTypes = await prisma.exerciseType.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json(exerciseTypes.map(withParsedQuickWeights));
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
    const category = VALID_CATEGORIES.includes(body.category) ? body.category : 'BODYWEIGHT_LESTE';
    const isCircuit = category === 'CIRCUIT';
    const isEmom = category === 'EMOM';
    // Circuit et EMOM se font au poids du corps : pas de leste ni de boutons de poids
    const isTimed = isCircuit || isEmom;
    const weightLabel =
      typeof body.weightLabel === 'string' && body.weightLabel.trim()
        ? body.weightLabel.trim()
        : category === 'EXTERNAL_WEIGHT'
          ? 'Poids (kg)'
          : isTimed
            ? 'Poids du corps'
            : 'Leste (kg)';
    const quickWeights =
      !isTimed && Array.isArray(body.quickWeights)
        ? body.quickWeights.map(Number).filter((n: number) => Number.isFinite(n)).sort((a: number, b: number) => a - b)
        : [];
    const weightStep = Number.isFinite(Number(body.weightStep)) ? Number(body.weightStep) : 5;
    const timeCapMinutes = Number(body.timeCapMinutes);
    const circuit = Array.isArray(body.circuit) ? normalizeCircuit(body.circuit) : [];
    const exerciseOptions = Array.isArray(body.exerciseOptions) ? normalizeExerciseOptions(body.exerciseOptions) : [];

    if (!name) {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 });
    }
    if (isCircuit && (!Number.isInteger(timeCapMinutes) || timeCapMinutes < 1 || timeCapMinutes > 180)) {
      return NextResponse.json({ error: 'La durée du circuit doit être comprise entre 1 et 180 minutes' }, { status: 400 });
    }
    if (isCircuit && circuit.length === 0) {
      return NextResponse.json({ error: 'Ajoute au moins un exercice au circuit' }, { status: 400 });
    }
    if (isEmom && (!Number.isInteger(timeCapMinutes) || timeCapMinutes < 1 || timeCapMinutes > 60)) {
      return NextResponse.json({ error: "La durée de l'EMOM doit être comprise entre 1 et 60 minutes" }, { status: 400 });
    }
    if (isEmom && exerciseOptions.length === 0) {
      return NextResponse.json({ error: "Ajoute au moins un exercice à l'EMOM" }, { status: 400 });
    }

    const exerciseType = await prisma.exerciseType.create({
      data: {
        name,
        category,
        weightLabel,
        quickWeights: JSON.stringify(quickWeights),
        weightStep,
        timeCapMinutes: isTimed ? timeCapMinutes : null,
        circuit: isCircuit ? JSON.stringify(circuit) : null,
        exerciseOptions: isEmom ? JSON.stringify(exerciseOptions) : null,
      },
    });

    return NextResponse.json(withParsedQuickWeights(exerciseType), { status: 201 });
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
