'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Table2, LineChart as LineChartIcon } from 'lucide-react';

type ExerciseType = { id: string; name: string; weightLabel: string };
type User = { id: string; username: string };
type ProgressPoint = {
  id: string;
  date: string;
  userId: string;
  username: string;
  exerciseTypeId: string;
  exerciseTypeName: string;
  oneRepMax: number;
};

// Palette catégorielle validée (mode sombre) — ordre fixe, jamais recyclé par rang.
const SERIES_COLORS = [
  '#3987e5', // bleu
  '#d95926', // orange
  '#199e70', // aqua
  '#c98500', // jaune
  '#d55181', // magenta
  '#008300', // vert
  '#9085e9', // violet
  '#e66767', // rouge
];

function formatDateShort(ts: number) {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatDateLong(ts: number) {
  return new Date(ts).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ProgressView({ currentUserId }: { currentUserId: string }) {
  const [exerciseTypes, setExerciseTypes] = useState<ExerciseType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [exerciseTypeId, setExerciseTypeId] = useState('');
  const [userFilter, setUserFilter] = useState(''); // '' = tous les utilisateurs
  const [points, setPoints] = useState<ProgressPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    fetch('/api/exercise-types')
      .then((r) => r.json())
      .then((data: ExerciseType[]) => {
        setExerciseTypes(data);
        if (data.length > 0) setExerciseTypeId(data[0].id);
      });
    fetch('/api/users').then((r) => r.json()).then(setUsers);
  }, []);

  const loadProgress = () => {
    if (!exerciseTypeId) return;
    setLoading(true);
    const params = new URLSearchParams({ exerciseTypeId });
    if (userFilter) params.set('userId', userFilter);
    fetch(`/api/progress?${params.toString()}`)
      .then((r) => r.json())
      .then(setPoints)
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag is meant to flip synchronously so the spinner shows immediately on filter change
  useEffect(loadProgress, [exerciseTypeId, userFilter]);

  const selectedType = exerciseTypes.find((t) => t.id === exerciseTypeId);

  // Ordre fixe des utilisateurs (alphabétique) -> couleur stable par identité, jamais par rang de filtrage.
  const userColor = useMemo(() => {
    const sorted = [...users].sort((a, b) => a.username.localeCompare(b.username));
    const map = new Map<string, string>();
    sorted.forEach((u, idx) => map.set(u.id, SERIES_COLORS[idx % SERIES_COLORS.length]));
    return map;
  }, [users]);

  const series = useMemo(() => {
    const byUser = new Map<string, { userId: string; username: string; points: { date: number; oneRepMax: number }[] }>();
    for (const p of points) {
      const entry = byUser.get(p.userId) ?? { userId: p.userId, username: p.username, points: [] };
      entry.points.push({ date: new Date(p.date).getTime(), oneRepMax: Math.round(p.oneRepMax * 10) / 10 });
      byUser.set(p.userId, entry);
    }
    return Array.from(byUser.values())
      .map((s) => ({ ...s, points: s.points.sort((a, b) => a.date - b.date) }))
      .sort((a, b) => a.username.localeCompare(b.username));
  }, [points]);

  const isMultiSeries = series.length > 1;

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="progress-type-filter" className="block text-xs text-gray-400 mb-1">Type de séance</label>
          <select
            id="progress-type-filter"
            value={exerciseTypeId}
            onChange={(e) => setExerciseTypeId(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white outline-none"
          >
            {exerciseTypes.map((t) => (
              <option key={t.id} value={t.id} className="bg-slate-800">
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="progress-user-filter" className="block text-xs text-gray-400 mb-1">Utilisateur</label>
          <select
            id="progress-user-filter"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white outline-none"
          >
            <option value="" className="bg-slate-800">Tout le monde (comparer)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id} className="bg-slate-800">
                {u.id === currentUserId ? `${u.username} (moi)` : u.username}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowTable(false)}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
              !showTable ? 'bg-cyan-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            <LineChartIcon size={16} /> Courbe
          </button>
          <button
            onClick={() => setShowTable(true)}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all ${
              showTable ? 'bg-cyan-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            <Table2 size={16} /> Tableau
          </button>
        </div>
      </div>

      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
          <TrendingUp size={24} className="text-cyan-400" />
          1RM estimé — {selectedType?.name ?? '...'}
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Estimation (formule d&apos;Epley) à partir de la meilleure série de travail de chaque séance.
        </p>

        {loading ? (
          <p className="text-gray-400">Chargement...</p>
        ) : series.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-300 font-semibold text-lg">Aucune donnée pour ce filtre</p>
            <p className="text-gray-500 mt-2">Ajoute des séances pour voir apparaître ta progression.</p>
          </div>
        ) : showTable ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-white/10">
                  <th className="py-2 pr-4">Date</th>
                  {isMultiSeries && <th className="py-2 pr-4">Utilisateur</th>}
                  <th className="py-2 pr-4">1RM estimé</th>
                </tr>
              </thead>
              <tbody className="[font-variant-numeric:tabular-nums]">
                {points
                  .slice()
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((p) => (
                    <tr key={p.id} className="border-b border-white/5 text-gray-200">
                      <td className="py-2 pr-4">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                      {isMultiSeries && (
                        <td className="py-2 pr-4 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: userColor.get(p.userId) }} />
                          {p.username}
                        </td>
                      )}
                      <td className="py-2 pr-4 font-semibold">{Math.round(p.oneRepMax * 10) / 10} kg</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="bg-black/20 rounded-xl p-4">
              <ResponsiveContainer width="100%" height={380}>
                <LineChart margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2a" vertical={false} />
                  <XAxis
                    dataKey="date"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={formatDateShort}
                    stroke="#898781"
                    tick={{ fill: '#c3c2b7', fontSize: 12 }}
                  />
                  <YAxis
                    stroke="#898781"
                    tick={{ fill: '#c3c2b7', fontSize: 12 }}
                    unit="kg"
                    width={55}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const p = payload[0].payload as { date: number; oneRepMax: number };
                      return (
                        <div className="bg-slate-900/95 border border-white/20 rounded-lg px-3 py-2 text-sm">
                          <div className="text-gray-300 mb-1">{formatDateLong(p.date)}</div>
                          {(payload as unknown as { name?: string; value?: number; color?: string }[]).map((entry) => (
                            <div key={entry.name} className="flex items-center gap-2 text-white font-semibold">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                              {isMultiSeries ? `${entry.name} — ` : ''}
                              {entry.value} kg
                            </div>
                          ))}
                        </div>
                      );
                    }}
                    cursor={{ stroke: '#c3c2b7', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  {isMultiSeries && <Legend wrapperStyle={{ paddingTop: '16px', color: '#c3c2b7' }} />}
                  {series.map((s) => (
                    <Line
                      key={s.userId}
                      data={s.points}
                      dataKey="oneRepMax"
                      name={s.username}
                      stroke={userColor.get(s.userId)}
                      strokeWidth={2}
                      dot={{ fill: userColor.get(s.userId), r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
