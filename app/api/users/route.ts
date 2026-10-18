import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true },
      orderBy: { username: 'asc' },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error('Erreur GET /api/users', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des profils' }, { status: 500 });
  }
}
