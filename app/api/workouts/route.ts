import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { requireCurrentUser } from '../../../lib/session';
import { errorInfo } from '../../../lib/errors';

const VALID_SET_TYPES = ['WARMUP', 'WORKING', 'RECOVERY'];

type SetInput = { setType: 'WARMUP' | 'WORKING' | 'RECOVERY'; weight: number; reps: number };

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

    return NextResponse.json(entries);
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

    const entry = await prisma.workoutEntry.create({
      data: {
        userId: user.id,
        exerciseTypeId,
        templateId,
        date: new Date(date),
        sets: {
          create: sets.map((s, idx) => ({
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

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    const { message } = errorInfo(error);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Erreur POST /api/workouts', error);
    return NextResponse.json({ error: "Erreur lors de l'ajout de la séance" }, { status: 500 });
  }
}
