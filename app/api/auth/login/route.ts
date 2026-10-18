import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { verifyPassword } from '../../../../lib/auth';
import { createSession } from '../../../../lib/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!userId || !password) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'Profil introuvable' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 });
    }

    await createSession(user.id);
    return NextResponse.json({ id: user.id, username: user.username });
  } catch (error) {
    console.error('Erreur POST /api/auth/login', error);
    return NextResponse.json({ error: 'Erreur lors de la connexion' }, { status: 500 });
  }
}
