'use client';

import { useEffect, useState } from 'react';
import { Scale, Save, Dumbbell } from 'lucide-react';

type OneRepMaxEntry = { exerciseTypeId: string; exerciseTypeName: string; oneRepMax: number };
type BodyWeightData = { bodyWeightKg: number | null; oneRepMaxes: OneRepMaxEntry[] };

export default function BodyWeightView() {
  const [data, setData] = useState<BodyWeightData | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/body-weight')
      .then((r) => r.json())
      .then((d: BodyWeightData) => {
        setData(d);
        setWeightInput(d.bodyWeightKg !== null ? String(d.bodyWeightKg) : '');
      })
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag is meant to flip synchronously so the spinner shows on mount
  useEffect(load, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bodyWeightKg = Number(weightInput);
    if (!Number.isFinite(bodyWeightKg) || bodyWeightKg <= 0) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/body-weight', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bodyWeightKg }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Poids du corps enregistré.' });
        load();
        setTimeout(() => setMessage(null), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: data.error || "Erreur lors de l'enregistrement" });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-100 mb-2 flex items-center gap-2">
          <Scale size={20} className="text-cyan-400" /> Mon poids du corps
        </h2>
        <p className="text-sm text-gray-400 mb-5">
          Utilisé uniquement pour calculer ton 1RM sur les exercices lestés (dips, tractions...), où le poids
          soulevé est ton poids de corps + le leste. Privé : personne d&apos;autre ne peut le voir.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="body-weight-input" className="block text-xs text-gray-400 mb-1">Poids (kg)</label>
            <input
              id="body-weight-input"
              type="number"
              min={1}
              max={400}
              step="0.1"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="ex : 75"
              className="w-32 px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !weightInput}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all flex items-center gap-2"
          >
            <Save size={18} />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>

        {message && (
          <p className={`mt-4 text-sm font-semibold ${message.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>
            {message.text}
          </p>
        )}
      </div>

      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-100 mb-1 flex items-center gap-2">
          <Dumbbell size={20} className="text-cyan-400" /> 1RM actuels — exercices lestés
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Meilleure estimation (Epley) toutes séances confondues, en équivalent leste (poids du corps déduit du 1RM total).
        </p>

        {loading ? (
          <p className="text-gray-400">Chargement...</p>
        ) : !data?.bodyWeightKg ? (
          <p className="text-gray-300">
            Renseigne ton poids du corps ci-dessus pour voir apparaître tes 1RM.
          </p>
        ) : data.oneRepMaxes.length === 0 ? (
          <p className="text-gray-300">
            Aucune séance enregistrée pour un exercice lesté (poids du corps + leste) pour l&apos;instant.
          </p>
        ) : (
          <div className="space-y-2">
            {data.oneRepMaxes.map((entry) => (
              <div
                key={entry.exerciseTypeId}
                className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10"
              >
                <span className="font-semibold text-white">{entry.exerciseTypeName}</span>
                <span className="text-xl font-bold text-cyan-400">
                  {Math.round(entry.oneRepMax * 10) / 10} kg
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
