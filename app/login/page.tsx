import prisma from '../../lib/prisma';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true },
    orderBy: { username: 'asc' },
  });

  return <LoginForm users={users} />;
}
