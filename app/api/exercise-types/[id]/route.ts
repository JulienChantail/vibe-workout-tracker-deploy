import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { requireCurrentUser } from '../../../../lib/session';
import { errorInfo } from '../../../../lib/errors';

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
