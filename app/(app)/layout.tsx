import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/session';
import Nav from '../components/Nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      <Nav username={user.username} />

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        <div className="animate-fade-in">{children}</div>
      </main>

      <footer className="relative z-10 bg-gradient-to-t from-black/40 to-transparent border-t border-white/10 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-gray-400">© 2026 Vibe Workout Tracker - Repousse tes limites 💪</p>
        </div>
      </footer>
    </div>
  );
}
