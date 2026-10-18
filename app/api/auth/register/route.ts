import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { hashPassword } from '../../../../lib/auth';
import { createSession } from '../../../../lib/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (username.length < 2) {
      return NextResponse.json({ error: "Le nom de profil doit faire au moins 2 caractères" }, { status: 400 });
    }
    if (password.length < 4) {
      return NextResponse.json({ error: 'Le mot de passe doit faire au moins 4 caractères' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: 'Ce profil existe déjà' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { username, passwordHash },
      select: { id: true, username: true },
    });

    await createSession(user.id);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /api/auth/register', error);
    return NextResponse.json({ error: 'Erreur lors de la création du profil' }, { status: 500 });
  }
}
