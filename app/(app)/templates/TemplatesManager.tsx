'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Minus, Trash2, ArrowUp, ArrowDown, ListChecks } from 'lucide-react';
import { SET_TYPE_LABELS, TIER_LABELS } from '../../components/setTypeLabels';

type ExerciseType = { id: string; name: string; weightLabel: string };
type Tier = 'HEAVY' | 'MEDIUM' | 'LIGHT';
type SetType = 'WARMUP' | 'WORKING' | 'RECOVERY';
type Block = { tier: Tier; setType: SetType; count: number };
type Template = {
  id: string;
  name: string;
  heavyWeight: number;
  mediumWeight: number | null;
  lightWeight: number | null;
  blocks: (Block & { order: number })[];
};

function resolvedTierWeight(t: { heavyWeight: number; mediumWeight: number | null; lightWeight: number | null }, tier: Tier): number {
  if (tier === 'HEAVY') return t.heavyWeight;
  if (tier === 'MEDIUM') return t.mediumWeight ?? t.heavyWeight / 2;
  return t.lightWeight ?? 0;
}

export default function TemplatesManager() {
  const [exerciseTypes, setExerciseTypes] = useState<ExerciseType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [heavyWeight, setHeavyWeight] = useState<number | ''>('');
  const [mediumWeight, setMediumWeight] = useState<number | ''>('');
  const [lightWeight, setLightWeight] = useState<number | ''>('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blockDraft, setBlockDraft] = useState<Block>({ tier: 'HEAVY', setType: 'WORKING', count: 1 });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/exercise-types')
      .then((r) => r.json())
      .then((data: ExerciseType[]) => {
        setExerciseTypes(data);
        if (data.length > 0) setSelectedTypeId(data[0].id);
      });
  }, []);

  const loadTemplates = () => {
    if (!selectedTypeId) return;
    setLoading(true);
    fetch(`/api/templates?exerciseTypeId=${selectedTypeId}`)
      .then((r) => r.json())
      .then(setTemplates)
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag is meant to flip synchronously so the spinner shows immediately on type change
  useEffect(loadTemplates, [selectedTypeId]);

  const selectedType = exerciseTypes.find((t) => t.id === selectedTypeId);

  const previewWeights = useMemo(
    () => ({
      HEAVY: typeof heavyWeight === 'number' ? heavyWeight : 0,
      MEDIUM: typeof mediumWeight === 'number' ? mediumWeight : (typeof heavyWeight === 'number' ? heavyWeight / 2 : 0),
      LIGHT: typeof lightWeight === 'number' ? lightWeight : 0,
    }),
    [heavyWeight, mediumWeight, lightWeight]
  );

  const addBlock = () => {
    setBlocks((prev) => [...prev, { ...blockDraft }]);
  };

  const removeBlock = (idx: number) => setBlocks((prev) => prev.filter((_, i) => i !== idx));

  const moveBlock = (idx: number, dir: -1 | 1) => {
    setBlocks((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const resetForm = () => {
    setName('');
    setHeavyWeight('');
    setMediumWeight('');
    setLightWeight('');
    setBlocks([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTypeId || !name.trim() || heavyWeight === '' || blocks.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseTypeId: selectedTypeId,
          name: name.trim(),
          heavyWeight,
          mediumWeight: mediumWeight === '' ? null : mediumWeight,
          lightWeight: lightWeight === '' ? null : lightWeight,
          blocks,
        }),
      });
      if (res.ok) {
        resetForm();
        fetch(`/api/templates?exerciseTypeId=${selectedTypeId}`)
          .then((r) => r.json())
          .then(setTemplates);
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
    if (!confirm('Supprimer cette séance préenregistrée ?')) return;
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
        <label className="block text-sm font-semibold text-gray-200 mb-3">Type de séance concerné</label>
        <div className="flex flex-wrap gap-2">
          {exerciseTypes.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTypeId(t.id)}
              className={`px-4 py-2 rounded-lg font-medium border transition-all ${
                selectedTypeId === t.id
                  ? 'bg-cyan-600 border-cyan-400 text-white'
                  : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {selectedType && (
        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            <Plus size={20} className="text-cyan-400" /> Nouvelle séance préenregistrée — {selectedType.name}
          </h2>

          <div>
            <label htmlFor="tpl-name" className="block text-sm font-semibold text-gray-200 mb-2">Nom de la séance</label>
            <input
              id="tpl-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex : Pyramide classique"
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="tpl-heavy" className="block text-sm font-semibold text-gray-200 mb-2">
                Lourd — {selectedType.weightLabel} <span className="text-red-400">*</span>
              </label>
              <input
                id="tpl-heavy"
                type="number"
                value={heavyWeight}
                onChange={(e) => setHeavyWeight(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 outline-none"
              />
            </div>
            <div>
              <label htmlFor="tpl-medium" className="block text-sm font-semibold text-gray-200 mb-2">
                Moyen <span className="text-gray-500 text-xs">(vide = lourd ÷ 2)</span>
              </label>
              <input
                id="tpl-medium"
                type="number"
                value={mediumWeight}
                placeholder={typeof heavyWeight === 'number' ? String(heavyWeight / 2) : ''}
                onChange={(e) => setMediumWeight(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 outline-none"
              />
            </div>
            <div>
              <label htmlFor="tpl-light" className="block text-sm font-semibold text-gray-200 mb-2">
                Léger <span className="text-gray-500 text-xs">(vide = 0)</span>
              </label>
              <input
                id="tpl-light"
                type="number"
                value={lightWeight}
                placeholder="0"
                onChange={(e) => setLightWeight(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 outline-none"
              />
            </div>
          </div>

          <div className="border-t border-white/10 pt-5">
            <h3 className="text-sm font-semibold text-gray-200 mb-3">Séquence de séries</h3>
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div>
                <label htmlFor="tpl-block-tier" className="block text-xs text-gray-400 mb-1">Palier</label>
                <select
                  id="tpl-block-tier"
                  value={blockDraft.tier}
                  onChange={(e) => setBlockDraft((b) => ({ ...b, tier: e.target.value as Tier }))}
                  className="px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white outline-none"
                >
                  {(['HEAVY', 'MEDIUM', 'LIGHT'] as Tier[]).map((tier) => (
                    <option key={tier} value={tier} className="bg-slate-800">
                      {TIER_LABELS[tier]} ({resolvedTierWeight({ heavyWeight: previewWeights.HEAVY, mediumWeight: mediumWeight === '' ? null : mediumWeight, lightWeight: lightWeight === '' ? null : lightWeight }, tier)}kg)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tpl-block-settype" className="block text-xs text-gray-400 mb-1">Type</label>
                <select
                  id="tpl-block-settype"
                  value={blockDraft.setType}
                  onChange={(e) => setBlockDraft((b) => ({ ...b, setType: e.target.value as SetType }))}
                  className="px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white outline-none"
                >
                  {(['WARMUP', 'WORKING', 'RECOVERY'] as SetType[]).map((st) => (
                    <option key={st} value={st} className="bg-slate-800">
                      {SET_TYPE_LABELS[st]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tpl-block-count" className="block text-xs text-gray-400 mb-1">Nombre de séries</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setBlockDraft((b) => ({ ...b, count: Math.max(1, b.count - 1) }))}
                    className="p-2 bg-red-600/80 hover:bg-red-700 text-white rounded-lg transition-all"
                    aria-label="Diminuer le nombre de séries"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    id="tpl-block-count"
                    type="number"
                    min={1}
                    value={blockDraft.count}
                    onChange={(e) => setBlockDraft((b) => ({ ...b, count: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-16 px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-center outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setBlockDraft((b) => ({ ...b, count: b.count + 1 }))}
                    className="p-2 bg-green-600/80 hover:bg-green-700 text-white rounded-lg transition-all"
                    aria-label="Augmenter le nombre de séries"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={addBlock}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all"
              >
                + Ajouter au modèle
              </button>
            </div>

            {blocks.length > 0 && (
              <div className="space-y-2">
                {blocks.map((b, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white/5 px-4 py-2.5 rounded-lg border border-white/10">
                    <span className="text-gray-200 text-sm">
                      <span className="font-bold text-cyan-400">{idx + 1}.</span> {b.count}× {SET_TYPE_LABELS[b.setType]} —{' '}
                      {TIER_LABELS[b.tier]} ({resolvedTierWeight({ heavyWeight: previewWeights.HEAVY, mediumWeight: mediumWeight === '' ? null : mediumWeight, lightWeight: lightWeight === '' ? null : lightWeight }, b.tier)}kg)
                    </span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => moveBlock(idx, -1)} className="p-1.5 text-gray-400 hover:text-white">
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" onClick={() => moveBlock(idx, 1)} className="p-1.5 text-gray-400 hover:text-white">
                        <ArrowDown size={14} />
                      </button>
                      <button type="button" onClick={() => removeBlock(idx)} className="p-1.5 text-red-400 hover:text-red-300">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-red-300 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !name.trim() || heavyWeight === '' || blocks.length === 0}
            className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all"
          >
            {submitting ? 'Création...' : 'Créer la séance préenregistrée'}
          </button>
        </form>
      )}

      {selectedType && (
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-gray-100 mb-4 flex items-center gap-2">
            <ListChecks size={20} /> Séances préenregistrées — {selectedType.name}
          </h2>
          {loading ? (
            <p className="text-gray-400">Chargement...</p>
          ) : templates.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucune séance préenregistrée pour ce type.</p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/10">
                  <div>
                    <div className="font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {t.blocks
                        .sort((a, b) => a.order - b.order)
                        .map((b) => `${b.count}× ${SET_TYPE_LABELS[b.setType]} (${resolvedTierWeight(t, b.tier)}kg)`)
                        .join(' · ')}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(t.id)} className="p-2 bg-red-600/80 hover:bg-red-700 text-white rounded-lg transition-all">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
