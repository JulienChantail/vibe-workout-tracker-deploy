import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { requireCurrentUser } from '../../../../lib/session';
import { errorInfo } from '../../../../lib/errors';
import { normalizeExerciseOptions } from '../../../../lib/emom';

// Modifie un EMOM : exercices proposés et durée par défaut
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCurrentUser();
    const { id } = await context.params;
    const body = await request.json();
    const exerciseOptions = Array.isArray(body.exerciseOptions) ? normalizeExerciseOptions(body.exerciseOptions) : [];
    const timeCapMinutes = Number(body.timeCapMinutes);

    const existing = await prisma.exerciseType.findUnique({ where: { id }, select: { category: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Type de séance introuvable' }, { status: 404 });
    }
    if (existing.category !== 'EMOM') {
      return NextResponse.json({ error: 'Seuls les EMOM peuvent être modifiés' }, { status: 400 });
    }
    if (exerciseOptions.length === 0) {
      return NextResponse.json({ error: 'Garde au moins un exercice' }, { status: 400 });
    }
    if (!Number.isInteger(timeCapMinutes) || timeCapMinutes < 1 || timeCapMinutes > 60) {
      return NextResponse.json({ error: 'La durée doit être comprise entre 1 et 60 minutes' }, { status: 400 });
    }

    await prisma.exerciseType.update({
      where: { id },
      data: { exerciseOptions: JSON.stringify(exerciseOptions), timeCapMinutes },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message } = errorInfo(error);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Erreur PATCH /api/exercise-types/[id]', error);
    return NextResponse.json({ error: 'Erreur lors de la modification' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCurrentUser();
    const { id } = await context.params;
    await prisma.exerciseType.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, code } = errorInfo(error);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    if (code === 'P2003' || code === 'P2014') {
      return NextResponse.json(
        { error: 'Impossible de supprimer : des séances ou séances préenregistrées utilisent ce type' },
        { status: 409 }
      );
    }
    console.error('Erreur DELETE /api/exercise-types/[id]', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
  }
}
