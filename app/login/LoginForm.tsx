'use client';

import { useState } from 'react';
import { Dumbbell, User, Lock, UserPlus, ArrowLeft } from 'lucide-react';

type Profile = { id: string; username: string };

export default function LoginForm({ users }: { users: Profile[] }) {
  const [mode, setMode] = useState<'select' | 'password' | 'create'>(
    users.length === 0 ? 'create' : 'select'
  );
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [password, setPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const redirectAfterAuth = () => {
    const params = new URLSearchParams(window.location.search);
    window.location.href = params.get('next') || '/add';
  };

  const handleSelectUser = (user: Profile) => {
    setSelectedUser(user);
    setPassword('');
    setError('');
    setMode('password');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, password }),
      });
      if (res.ok) {
        redirectAfterAuth();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Erreur de connexion');
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword }),
      });
      if (res.ok) {
        redirectAfterAuth();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Erreur lors de la création du profil');
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="p-4 bg-white/10 rounded-2xl">
            <Dumbbell size={40} className="text-cyan-300" />
          </div>
          <h1 className="text-3xl font-bold text-white text-center">Vibe Workout Tracker</h1>
          <p className="text-purple-200 text-center">Repousse tes limites 💪</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
          {mode === 'select' && (
            <>
              <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                <User size={20} className="text-cyan-400" />
                Choisis ton profil
              </h2>
              <div className="space-y-2 mb-4">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/15 border border-white/20 rounded-xl text-white font-medium transition-all flex items-center gap-3"
                  >
                    <span className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-sm font-bold">
                      {user.username.slice(0, 2).toUpperCase()}
                    </span>
                    {user.username}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setMode('create');
                  setError('');
                }}
                className="w-full px-4 py-3 border border-dashed border-white/30 text-gray-300 hover:text-white hover:border-white/50 rounded-xl transition-all flex items-center justify-center gap-2 font-medium"
              >
                <UserPlus size={18} />
                Créer un nouveau profil
              </button>
            </>
          )}

          {mode === 'password' && selectedUser && (
            <form onSubmit={handleLogin}>
              <button
                type="button"
                onClick={() => setMode('select')}
                className="text-gray-400 hover:text-white mb-4 flex items-center gap-1 text-sm"
              >
                <ArrowLeft size={16} />
                Retour
              </button>
              <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                <span className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-sm font-bold">
                  {selectedUser.username.slice(0, 2).toUpperCase()}
                </span>
                {selectedUser.username}
              </h2>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <Lock size={16} className="text-cyan-400" />
                Mot de passe
              </label>
              <input
                id="login-password"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none transition-all mb-4"
              />
              {error && <p className="text-red-300 text-sm mb-4">{error}</p>}
              <button
                type="submit"
                disabled={loading || !password}
                className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreate}>
              {users.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('select');
                    setError('');
                  }}
                  className="text-gray-400 hover:text-white mb-4 flex items-center gap-1 text-sm"
                >
                  <ArrowLeft size={16} />
                  Retour
                </button>
              )}
              <h2 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                <UserPlus size={20} className="text-cyan-400" />
                Nouveau profil
              </h2>
              <label htmlFor="new-username" className="block text-sm font-medium text-gray-300 mb-2">Nom</label>
              <input
                id="new-username"
                type="text"
                autoFocus
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none transition-all mb-4"
              />
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-300 mb-2">Mot de passe</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 focus:border-transparent outline-none transition-all mb-4"
              />
              {error && <p className="text-red-300 text-sm mb-4">{error}</p>}
              <button
                type="submit"
                disabled={loading || newUsername.length < 2 || newPassword.length < 4}
                className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all"
              >
                {loading ? 'Création...' : 'Créer mon profil et me connecter'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
