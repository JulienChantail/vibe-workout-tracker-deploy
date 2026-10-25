import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { requireCurrentUser } from '../../../lib/session';
import { errorInfo } from '../../../lib/errors';
import { parseCircuit, repsPerRound } from '../../../lib/circuit';
import { parseExerciseOptions } from '../../../lib/emom';

const VALID_SET_TYPES = ['WARMUP', 'WORKING', 'RECOVERY'];

type SetInput = { setType: 'WARMUP' | 'WORKING' | 'RECOVERY'; weight: number; reps: number };

// SQL Server ne gère pas le type Json : circuit et exercices d'EMOM sont renvoyés décodés
function withParsedCircuit<T extends { exerciseType: { circuit: string | null; exerciseOptions: string | null } }>(entry: T) {
  return {
    ...entry,
    exerciseType: {
      ...entry.exerciseType,
      circuit: parseCircuit(entry.exerciseType.circuit),
      exerciseOptions: parseExerciseOptions(entry.exerciseType.exerciseOptions),
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const exerciseTypeId = params.get('exerciseTypeId');
    const userId = params.get('userId');
    const from = params.get('from');
    const to = params.get('to');

    const entries = await prisma.workoutEntry.findMany({
      where: {
        ...(exerciseTypeId ? { exerciseTypeId } : {}),
        ...(userId ? { userId } : {}),
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      include: {
        user: { select: { id: true, username: true } },
        exerciseType: true,
        template: { select: { id: true, name: true } },
        sets: { orderBy: { order: 'asc' } },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(entries.map(withParsedCircuit));
  } catch (error) {
    console.error('Erreur GET /api/workouts', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des séances' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCurrentUser();

    const body = await request.json();
    const exerciseTypeId = typeof body.exerciseTypeId === 'string' ? body.exerciseTypeId : '';
    const templateId = typeof body.templateId === 'string' && body.templateId ? body.templateId : null;
    const date = typeof body.date === 'string' ? body.date : '';
    const sets: SetInput[] = Array.isArray(body.sets) ? body.sets : [];

    if (!exerciseTypeId || !date) {
      return NextResponse.json({ error: 'Type de séance et date requis' }, { status: 400 });
    }

    const exerciseType = await prisma.exerciseType.findUnique({
      where: { id: exerciseTypeId },
      select: { category: true, circuit: true },
    });
    if (!exerciseType) {
      return NextResponse.json({ error: 'Type de séance introuvable' }, { status: 400 });
    }
    const isCircuit = exerciseType.category === 'CIRCUIT';
    const isEmom = exerciseType.category === 'EMOM';

    // Circuit : un score (tours complets + répétitions du tour commencé), pas de séries
    const rounds = Number(body.rounds);
    const extraReps = Number(body.extraReps ?? 0);
    const objective = body.objective === null || body.objective === undefined ? null : Number(body.objective);
    // EMOM : exercice, moyenne de répétitions par minute et durée, pas de séries
    const exercise = typeof body.exercise === 'string' ? body.exercise.trim() : '';
    const repsPerMinute = Number(body.repsPerMinute);
    const durationMinutes = Number(body.durationMinutes);
    if (isEmom) {
      if (!exercise || exercise.length > 100) {
        return NextResponse.json({ error: 'Choisis un exercice' }, { status: 400 });
      }
      if (!Number.isFinite(repsPerMinute) || repsPerMinute <= 0 || repsPerMinute > 200) {
        return NextResponse.json({ error: 'Nombre de répétitions par minute invalide' }, { status: 400 });
      }
      if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 60) {
        return NextResponse.json({ error: 'La durée doit être comprise entre 1 et 60 minutes' }, { status: 400 });
      }
    } else if (isCircuit) {
      if (objective !== null && (!Number.isInteger(objective) || objective < 1 || objective > 1000)) {
        return NextResponse.json({ error: 'Objectif invalide' }, { status: 400 });
      }
      const perRound = repsPerRound(parseCircuit(exerciseType.circuit));
      if (!Number.isInteger(rounds) || rounds < 0 || !Number.isInteger(extraReps) || extraReps < 0) {
        return NextResponse.json({ error: 'Score invalide' }, { status: 400 });
      }
      if (perRound > 0 && extraReps >= perRound) {
        return NextResponse.json(
          { error: `Les répétitions en plus doivent être inférieures à un tour (${perRound})` },
          { status: 400 }
        );
      }
      if (rounds === 0 && extraReps === 0) {
        return NextResponse.json({ error: 'Le score est vide' }, { status: 400 });
      }
    } else {
      if (sets.length === 0) {
        return NextResponse.json({ error: 'Ajoute au moins une série' }, { status: 400 });
      }
      for (const s of sets) {
        if (
          !VALID_SET_TYPES.includes(s.setType) ||
          !Number.isFinite(Number(s.weight)) ||
          !Number.isInteger(Number(s.reps)) ||
          Number(s.reps) < 1
        ) {
          return NextResponse.json({ error: 'Série invalide' }, { status: 400 });
        }
      }
    }

    const entry = await prisma.workoutEntry.create({
      data: {
        userId: user.id,
        exerciseTypeId,
        templateId: isCircuit || isEmom ? null : templateId,
        date: new Date(date),
        rounds: isCircuit ? rounds : null,
        extraReps: isCircuit ? extraReps : null,
        objective: isCircuit ? objective : null,
        exercise: isEmom ? exercise : null,
        repsPerMinute: isEmom ? Math.round(repsPerMinute * 10) / 10 : null,
        durationMinutes: isEmom ? durationMinutes : null,
        sets: {
          create: (isCircuit || isEmom ? [] : sets).map((s, idx) => ({
            order: idx,
            setType: s.setType,
            weight: Number(s.weight),
            reps: Number(s.reps),
          })),
        },
      },
      include: {
        user: { select: { id: true, username: true } },
        exerciseType: true,
        template: { select: { id: true, name: true } },
        sets: { orderBy: { order: 'asc' } },
      },
    });

    return NextResponse.json(withParsedCircuit(entry), { status: 201 });
  } catch (error) {
    const { message } = errorInfo(error);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Erreur POST /api/workouts', error);
    return NextResponse.json({ error: "Erreur lors de l'ajout de la séance" }, { status: 500 });
  }
}
