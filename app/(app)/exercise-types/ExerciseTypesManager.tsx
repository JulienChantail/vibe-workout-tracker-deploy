'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Dumbbell, Weight } from 'lucide-react';

type ExerciseType = {
  id: string;
  name: string;
  category: 'BODYWEIGHT_LESTE' | 'EXTERNAL_WEIGHT';
  weightLabel: string;
  quickWeights: number[];
  weightStep: number;
};

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
};

export default function ExerciseTypesManager() {
  const [types, setTypes] = useState<ExerciseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseType['category']>('BODYWEIGHT_LESTE');
  const [weightLabel, setWeightLabel] = useState(CATEGORY_PRESETS.BODYWEIGHT_LESTE.label);
  const [quickWeightsText, setQuickWeightsText] = useState(CATEGORY_PRESETS.BODYWEIGHT_LESTE.quickWeights.join(', '));
  const [weightStep, setWeightStep] = useState(CATEGORY_PRESETS.BODYWEIGHT_LESTE.step);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
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
        body: JSON.stringify({ name: name.trim(), category, weightLabel, quickWeights, weightStep }),
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
          <div className="grid grid-cols-2 gap-3">
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
          </div>
        </div>

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

        {error && <p className="text-red-300 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !name.trim()}
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
              <div key={t.id} className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
                <div>
                  <div className="font-semibold text-white">{t.name}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {t.category === 'BODYWEIGHT_LESTE' ? 'Poids du corps + leste' : 'Poids externe'} · {t.weightLabel} · pas {t.weightStep}kg
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-2 bg-red-600/80 hover:bg-red-700 text-white rounded-lg transition-all"
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
