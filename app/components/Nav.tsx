'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Dumbbell, Zap, ListChecks, LayoutList, TrendingUp, LogOut, Settings2, Scale } from 'lucide-react';

const LINKS = [
  { href: '/add', label: 'Ajouter', icon: Zap },
  { href: '/history', label: 'Historique', icon: LayoutList },
  { href: '/progress', label: 'Progression', icon: TrendingUp },
  { href: '/body-weight', label: 'Poids du corps', icon: Scale },
  { href: '/exercise-types', label: 'Types de séance', icon: Settings2 },
  { href: '/templates', label: 'Séances préenregistrées', icon: ListChecks },
];

export default function Nav({ username }: { username: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="relative z-10 bg-gradient-to-r from-purple-600/80 via-purple-700/80 to-cyan-600/80 backdrop-blur-xl text-white border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <Link href="/add" className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-lg">
              <Dumbbell size={26} className="text-cyan-300" />
            </div>
            <span className="text-xl font-bold tracking-tight">Vibe Workout Tracker</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-purple-100 hidden sm:inline">{username}</span>
            <button
              onClick={handleLogout}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all"
              title="Se déconnecter"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
        <nav className="flex gap-1 flex-wrap">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center gap-2 text-sm ${
                  active
                    ? 'bg-white/15 text-cyan-300'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
