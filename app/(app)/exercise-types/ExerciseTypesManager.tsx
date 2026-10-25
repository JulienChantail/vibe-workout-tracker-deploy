'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Dumbbell, Weight, Timer, X, Repeat, Pencil } from 'lucide-react';
import { circuitSummary, type CircuitExercise } from '../../../lib/circuit';

type ExerciseType = {
  id: string;
  name: string;
  category: 'BODYWEIGHT_LESTE' | 'EXTERNAL_WEIGHT' | 'CIRCUIT' | 'EMOM';
  weightLabel: string;
  quickWeights: number[];
  weightStep: number;
  timeCapMinutes: number | null;
  circuit: CircuitExercise[];
  exerciseOptions: string[];
};

const DEFAULT_EMOM_EXERCISES = ['Dips', 'Tractions', 'Pompes'];

/** Liste de noms d'exercices modifiable (exercices proposés pour un EMOM). */
function ExerciseNamesEditor({ names, onChange }: { names: string[]; onChange: (names: string[]) => void }) {
  return (
    <div>
      <div className="space-y-2">
        {names.map((value, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              aria-label={`Exercice ${idx + 1}`}
              value={value}
              placeholder="ex : Squats"
              onChange={(e) => onChange(names.map((n, i) => (i === idx ? e.target.value : n)))}
              className="flex-1 min-w-0 px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-cyan-400 outline-none"
            />
            <button
              type="button"
              onClick={() => onChange(names.filter((_, i) => i !== idx))}
              disabled={names.length === 1}
              className="p-2 bg-red-600/80 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg transition-all"
              title="Retirer cet exercice"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...names, ''])}
        className="mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-gray-200 rounded-lg text-sm font-semibold transition-all"
      >
        + Ajouter un exercice
      </button>
    </div>
  );
}

const cleanNames = (names: string[]) => [...new Set(names.map((n) => n.trim()).filter(Boolean))];

type CircuitRow = { name: string; reps: number | '' };

const CATEGORY_PRESETS: Record<ExerciseType['category'], { label: string; quickWeights: number[]; step: number }> = {
  BODYWEIGHT_LESTE: {
    label: 'Leste (kg)',
    quickWeights: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
    step: 5,
  },
  EXTERNAL_WEIGHT: {
    label: 'Poids (kg)',
    quickWeights: [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 140],
    step: 2.5,
  },
  // Un circuit ou un EMOM se fait au poids du corps : pas de champ poids
  CIRCUIT: {
    label: 'Poids du corps',
    quickWeights: [],
    step: 5,
  },
  EMOM: {
    label: 'Poids du corps',
    quickWeights: [],
    step: 5,
  },
};

// Proposé par défaut : "Cindy" (le défi Tom Holland), 20 minutes
const DEFAULT_CIRCUIT: CircuitRow[] = [
  { name: 'Tractions', reps: 5 },
  { name: 'Pompes', reps: 10 },
  { name: 'Squats', reps: 15 },
];

const CATEGORY_LABELS: Record<ExerciseType['category'], string> = {
  BODYWEIGHT_LESTE: 'Poids du corps + leste',
  EXTERNAL_WEIGHT: 'Poids externe',
  CIRCUIT: 'Circuit chronométré',
  EMOM: 'EMOM',
};

export default function ExerciseTypesManager() {
  const [types, setTypes] = useState<ExerciseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseType['category']>('BODYWEIGHT_LESTE');
  const [weightLabel, setWeightLabel] = useState(CATEGORY_PRESETS.BODYWEIGHT_LESTE.label);
  const [quickWeightsText, setQuickWeightsText] = useState(CATEGORY_PRESETS.BODYWEIGHT_LESTE.quickWeights.join(', '));
  const [weightStep, setWeightStep] = useState(CATEGORY_PRESETS.BODYWEIGHT_LESTE.step);
  const [timeCapMinutes, setTimeCapMinutes] = useState<number | ''>(20);
  const [circuitRows, setCircuitRows] = useState<CircuitRow[]>(DEFAULT_CIRCUIT);
  const [emomNames, setEmomNames] = useState<string[]>(DEFAULT_EMOM_EXERCISES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Modification d'un EMOM existant (exercices proposés et durée par défaut)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNames, setEditNames] = useState<string[]>([]);
  const [editMinutes, setEditMinutes] = useState<number | ''>(10);
  const [editError, setEditError] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/exercise-types')
      .then((r) => r.json())
      .then(setTypes)
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag is meant to flip synchronously so the spinner shows on mount
  useEffect(load, []);

  const handleCategoryChange = (cat: ExerciseType['category']) => {
    setCategory(cat);
    const preset = CATEGORY_PRESETS[cat];
    setWeightLabel(preset.label);
    setQuickWeightsText(preset.quickWeights.join(', '));
    setWeightStep(preset.step);
    if (cat === 'CIRCUIT') setTimeCapMinutes(20);
    if (cat === 'EMOM') setTimeCapMinutes(10);
  };

  const updateCircuitRow = (idx: number, patch: Partial<CircuitRow>) => {
    setCircuitRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const isCircuit = category === 'CIRCUIT';
  const circuit = circuitRows
    .map((r) => ({ name: r.name.trim(), reps: Number(r.reps) }))
    .filter((r) => r.name && Number.isInteger(r.reps) && r.reps >= 1);
  const isEmom = category === 'EMOM';
  const emomOptions = cleanNames(emomNames);
  const circuitValid =
    (!isCircuit || (circuit.length > 0 && Number(timeCapMinutes) >= 1)) &&
    (!isEmom || (emomOptions.length > 0 && Number(timeCapMinutes) >= 1 && Number(timeCapMinutes) <= 60));

  const startEdit = (t: ExerciseType) => {
    setEditingId(t.id);
    setEditNames(t.exerciseOptions.length > 0 ? t.exerciseOptions : DEFAULT_EMOM_EXERCISES);
    setEditMinutes(t.timeCapMinutes ?? 10);
    setEditError('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setEditError('');
    const res = await fetch(`/api/exercise-types/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exerciseOptions: cleanNames(editNames), timeCapMinutes: Number(editMinutes) }),
    }).catch(() => null);
    if (res?.ok) {
      setEditingId(null);
      load();
    } else {
      const data = await res?.json().catch(() => ({}));
      setEditError(data?.error || "Erreur lors de l'enregistrement");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !circuitValid) return;
    setSubmitting(true);
    setError('');
    const quickWeights = quickWeightsText
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));

    try {
      const res = await fetch('/api/exercise-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          weightLabel,
          quickWeights,
          weightStep,
          ...(isCircuit ? { timeCapMinutes: Number(timeCapMinutes), circuit } : {}),
          ...(isEmom ? { timeCapMinutes: Number(timeCapMinutes), exerciseOptions: emomOptions } : {}),
        }),
      });
      if (res.ok) {
        setName('');
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Erreur lors de la création');
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce type de séance ? Cette action est irréversible.')) return;
    const res = await fetch(`/api/exercise-types/${id}`, { method: 'DELETE' });
    if (res.ok) {
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 space-y-5">
        <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
          <Plus size={20} className="text-cyan-400" /> Nouveau type de séance
        </h2>

        <div>
          <label htmlFor="et-name" className="block text-sm font-semibold text-gray-200 mb-2">Nom</label>
          <input
            id="et-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex : Développé couché"
            className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Catégorie</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleCategoryChange('BODYWEIGHT_LESTE')}
              className={`px-4 py-3 rounded-xl border-2 font-medium flex items-center gap-2 transition-all ${
                category === 'BODYWEIGHT_LESTE'
                  ? 'bg-blue-600/30 border-blue-400 text-white'
                  : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
              }`}
            >
              <Dumbbell size={18} />
              Poids du corps + leste
            </button>
            <button
              type="button"
              onClick={() => handleCategoryChange('EXTERNAL_WEIGHT')}
              className={`px-4 py-3 rounded-xl border-2 font-medium flex items-center gap-2 transition-all ${
                category === 'EXTERNAL_WEIGHT'
                  ? 'bg-purple-600/30 border-purple-400 text-white'
                  : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
              }`}
            >
              <Weight size={18} />
              Poids externe (barre...)
            </button>
            <button
              type="button"
              onClick={() => handleCategoryChange('CIRCUIT')}
              className={`px-4 py-3 rounded-xl border-2 font-medium flex items-center gap-2 transition-all ${
                category === 'CIRCUIT'
                  ? 'bg-cyan-600/30 border-cyan-400 text-white'
                  : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
              }`}
            >
              <Timer size={18} />
              Circuit chronométré
            </button>
            <button
              type="button"
              onClick={() => handleCategoryChange('EMOM')}
              className={`px-4 py-3 rounded-xl border-2 font-medium flex items-center gap-2 transition-all ${
                category === 'EMOM'
                  ? 'bg-fuchsia-600/30 border-fuchsia-400 text-white'
                  : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
              }`}
            >
              <Repeat size={18} />
              EMOM
            </button>
          </div>
        </div>

        {isEmom ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Every minute on the minute : le même nombre de répétitions au début de chaque minute. On choisit l&apos;exercice
              au moment de la séance.
            </p>
            <div>
              <label htmlFor="et-emom-minutes" className="block text-sm font-semibold text-gray-200 mb-2">Durée par défaut (minutes)</label>
              <input
                id="et-emom-minutes"
                type="number"
                min={1}
                max={60}
                value={timeCapMinutes}
                onChange={(e) => setTimeCapMinutes(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full sm:w-40 px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">Exercices proposés</label>
              <ExerciseNamesEditor names={emomNames} onChange={setEmomNames} />
            </div>
          </div>
        ) : isCircuit ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Au poids du corps : le plus de tours possible dans le temps imparti (ex : défi Tom Holland / « Cindy »).
            </p>
            <div>
              <label htmlFor="et-time-cap" className="block text-sm font-semibold text-gray-200 mb-2">Durée (minutes)</label>
              <input
                id="et-time-cap"
                type="number"
                min={1}
                max={180}
                value={timeCapMinutes}
                onChange={(e) => setTimeCapMinutes(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full sm:w-40 px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">Exercices d&apos;un tour (dans l&apos;ordre)</label>
              <div className="space-y-2">
                {circuitRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      aria-label={`Répétitions de l'exercice ${idx + 1}`}
                      value={row.reps}
                      onChange={(e) =>
                        updateCircuitRow(idx, { reps: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1) })
                      }
                      className="w-20 px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-center text-white focus:ring-2 focus:ring-cyan-400 outline-none"
                    />
                    <input
                      type="text"
                      aria-label={`Nom de l'exercice ${idx + 1}`}
                      value={row.name}
                      placeholder="ex : Pompes"
                      onChange={(e) => updateCircuitRow(idx, { name: e.target.value })}
                      className="flex-1 min-w-0 px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-cyan-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setCircuitRows((rows) => rows.filter((_, i) => i !== idx))}
                      disabled={circuitRows.length === 1}
                      className="p-2 bg-red-600/80 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg transition-all"
                      title="Retirer cet exercice"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setCircuitRows((rows) => [...rows, { name: '', reps: 10 }])}
                className="mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-gray-200 rounded-lg text-sm font-semibold transition-all"
              >
                + Ajouter un exercice
              </button>
            </div>
          </div>
        ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="et-weight-label" className="block text-sm font-semibold text-gray-200 mb-2">Label du champ poids</label>
            <input
              id="et-weight-label"
              type="text"
              value={weightLabel}
              onChange={(e) => setWeightLabel(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 outline-none"
            />
          </div>
          <div>
            <label htmlFor="et-weight-step" className="block text-sm font-semibold text-gray-200 mb-2">Pas +/- (kg)</label>
            <input
              id="et-weight-step"
              type="number"
              step="0.25"
              value={weightStep}
              onChange={(e) => setWeightStep(Number(e.target.value))}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="et-quick-weights" className="block text-sm font-semibold text-gray-200 mb-2">Boutons rapides (kg, séparés par des virgules)</label>
          <input
            id="et-quick-weights"
            type="text"
            value={quickWeightsText}
            onChange={(e) => setQuickWeightsText(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 outline-none"
          />
        </div>
        </>
        )}

        {error && <p className="text-red-300 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !name.trim() || !circuitValid}
          className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all"
        >
          {submitting ? 'Création...' : 'Créer le type de séance'}
        </button>
      </form>

      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-gray-100 mb-4">Types existants</h2>
        {loading ? (
          <p className="text-gray-400">Chargement...</p>
        ) : (
          <div className="space-y-2">
            {types.map((t) => (
              <div key={t.id} className="bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {t.category === 'CIRCUIT'
                        ? `${CATEGORY_LABELS.CIRCUIT} · ${t.timeCapMinutes ?? '?'} min · ${circuitSummary(t.circuit)}`
                        : t.category === 'EMOM'
                          ? `EMOM · ${t.timeCapMinutes ?? 10} min par défaut · ${t.exerciseOptions.join(', ')}`
                          : `${CATEGORY_LABELS[t.category]} · ${t.weightLabel} · pas ${t.weightStep}kg`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {t.category === 'EMOM' && editingId !== t.id && (
                      <button
                        onClick={() => startEdit(t)}
                        className="p-2 bg-white/10 hover:bg-white/20 text-gray-200 rounded-lg transition-all"
                        title="Modifier les exercices"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-2 bg-red-600/80 hover:bg-red-700 text-white rounded-lg transition-all"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {editingId === t.id && (
                  <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                    <div>
                      <label htmlFor={`edit-minutes-${t.id}`} className="block text-sm font-semibold text-gray-200 mb-2">Durée par défaut (minutes)</label>
                      <input
                        id={`edit-minutes-${t.id}`}
                        type="number"
                        min={1}
                        max={60}
                        value={editMinutes}
                        onChange={(e) => setEditMinutes(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full sm:w-40 px-4 py-2 bg-white/5 border border-white/20 rounded-xl text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-200 mb-2">Exercices proposés</label>
                      <ExerciseNamesEditor names={editNames} onChange={setEditNames} />
                    </div>
                    {editError && <p className="text-red-300 text-sm">{editError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={cleanNames(editNames).length === 0 || !(Number(editMinutes) >= 1 && Number(editMinutes) <= 60)}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg font-semibold"
                      >
                        Enregistrer
                      </button>
                      <button onClick={() => setEditingId(null)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-200 rounded-lg">
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
