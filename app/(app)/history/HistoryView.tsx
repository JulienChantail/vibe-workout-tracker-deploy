'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, List, Trash2 } from 'lucide-react';
import Calendar, { toKey } from './Calendar';
import { SET_TYPE_LABELS } from '../../components/setTypeLabels';

type SetEntry = { id: string; order: number; setType: string; weight: number; reps: number };
type ExerciseType = { id: string; name: string; weightLabel: string };
type User = { id: string; username: string };
type WorkoutEntry = {
  id: string;
  date: string;
  user: User;
  exerciseType: ExerciseType;
  template: { id: string; name: string } | null;
  sets: SetEntry[];
};

const PALETTE = [
  'bg-cyan-400', 'bg-purple-400', 'bg-amber-400', 'bg-pink-400',
  'bg-emerald-400', 'bg-blue-400', 'bg-red-400', 'bg-lime-400',
];

export default function HistoryView({ currentUserId }: { currentUserId: string }) {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [exerciseTypes, setExerciseTypes] = useState<ExerciseType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [exerciseTypeFilter, setExerciseTypeFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/exercise-types').then((r) => r.json()).then(setExerciseTypes);
    fetch('/api/users').then((r) => r.json()).then(setUsers);
  }, []);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (exerciseTypeFilter) params.set('exerciseTypeId', exerciseTypeFilter);
    if (userFilter) params.set('userId', userFilter);
    fetch(`/api/workouts?${params.toString()}`)
      .then((r) => r.json())
      .then(setEntries)
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag is meant to flip synchronously so the spinner shows immediately on filter change
  useEffect(load, [exerciseTypeFilter, userFilter]);

  const colorFor = (exerciseTypeId: string) => {
    const idx = exerciseTypes.findIndex((t) => t.id === exerciseTypeId);
    return PALETTE[idx >= 0 ? idx % PALETTE.length : 0];
  };

  const entriesByDay = useMemo(() => {
    const map = new Map<string, { id: string; exerciseTypeName: string; colorClass: string }[]>();
    for (const entry of entries) {
      const key = toKey(new Date(entry.date));
      const list = map.get(key) ?? [];
      list.push({ id: entry.id, exerciseTypeName: entry.exerciseType.name, colorClass: colorFor(entry.exerciseType.id) });
      map.set(key, list);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, exerciseTypes]);

  const visibleEntries = useMemo(() => {
    if (view === 'calendar' && selectedDay) {
      return entries.filter((e) => toKey(new Date(e.date)) === selectedDay);
    }
    return entries;
  }, [entries, view, selectedDay]);

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette séance ?')) return;
    const res = await fetch(`/api/workouts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="history-type-filter" className="block text-xs text-gray-400 mb-1">Type de séance</label>
          <select
            id="history-type-filter"
            value={exerciseTypeFilter}
            onChange={(e) => setExerciseTypeFilter(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white outline-none"
          >
            <option value="" className="bg-slate-800">Tous les types</option>
            {exerciseTypes.map((t) => (
              <option key={t.id} value={t.id} className="bg-slate-800">
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="history-user-filter" className="block text-xs text-gray-400 mb-1">Utilisateur</label>
          <select
            id="history-user-filter"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white outline-none"
          >
            <option value="" className="bg-slate-800">Tout le monde</option>
            {users.map((u) => (
              <option key={u.id} value={u.id} className="bg-slate-800">
                {u.id === currentUserId ? `${u.username} (moi)` : u.username}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setView('list')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
              view === 'list' ? 'bg-cyan-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            <List size={16} /> Liste
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
              view === 'calendar' ? 'bg-cyan-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            <CalendarDays size={16} /> Agenda
          </button>
        </div>
      </div>

      {view === 'calendar' && (
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
          <Calendar
            month={month}
            onMonthChange={setMonth}
            entriesByDay={entriesByDay}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        </div>
      )}

      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-100 mb-4">
          {view === 'calendar' && selectedDay
            ? `Séances du ${new Date(selectedDay).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
            : 'Séances'}
        </h2>

        {loading ? (
          <p className="text-gray-400">Chargement...</p>
        ) : visibleEntries.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucune séance pour ce filtre.</p>
        ) : (
          <div className="space-y-3">
            {visibleEntries.map((entry) => (
              <div key={entry.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${colorFor(entry.exerciseType.id)}`} />
                      <span className="font-bold text-white">{entry.exerciseType.name}</span>
                      {entry.template && (
                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-gray-300">{entry.template.name}</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      {' · '}
                      <span className="text-cyan-300">{entry.user.username}</span>
                    </div>
                  </div>
                  {entry.user.id === currentUserId && (
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-2 bg-red-600/80 hover:bg-red-700 text-white rounded-lg transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {entry.sets.map((s) => (
                    <span key={s.id} className="text-xs bg-white/10 px-2.5 py-1 rounded-full text-gray-300">
                      {SET_TYPE_LABELS[s.setType]} · {s.weight}kg × {s.reps}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
