import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { requireCurrentUser } from '../../../../lib/session';
import { errorInfo } from '../../../../lib/errors';

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;

    const entry = await prisma.workoutEntry.findUnique({ where: { id }, select: { userId: true } });
    if (!entry) {
      return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 });
    }
    if (entry.userId !== user.id) {
      return NextResponse.json({ error: 'Tu ne peux supprimer que tes propres séances' }, { status: 403 });
    }

    await prisma.workoutEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message } = errorInfo(error);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Erreur DELETE /api/workouts/[id]', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
  }
}
