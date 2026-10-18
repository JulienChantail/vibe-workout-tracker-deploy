import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { requireCurrentUser } from '../../../../lib/session';
import { errorInfo } from '../../../../lib/errors';

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireCurrentUser();
    const { id } = await context.params;
    await prisma.workoutTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message } = errorInfo(error);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }
    console.error('Erreur DELETE /api/templates/[id]', error);
    return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
  }
}
