'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Minus, X, ChevronLeft, Check, Sparkles, ListChecks } from 'lucide-react';
import { SET_TYPE_LABELS } from '../../components/setTypeLabels';

type ExerciseType = {
  id: string;
  name: string;
  category: 'BODYWEIGHT_LESTE' | 'EXTERNAL_WEIGHT';
  weightLabel: string;
  quickWeights: number[];
  weightStep: number;
};

type TemplateBlock = {
  order: number;
  tier: 'HEAVY' | 'MEDIUM' | 'LIGHT';
  setType: 'WARMUP' | 'WORKING' | 'RECOVERY';
  count: number;
};

type WorkoutTemplate = {
  id: string;
  name: string;
  heavyWeight: number;
  mediumWeight: number | null;
  lightWeight: number | null;
  blocks: TemplateBlock[];
};

type SetType = 'WARMUP' | 'WORKING' | 'RECOVERY';
type SetRow = { setType: SetType; weight: number; reps: number | '' };

function tierWeight(template: WorkoutTemplate, tier: TemplateBlock['tier']): number {
  if (tier === 'HEAVY') return template.heavyWeight;
  if (tier === 'MEDIUM') return template.mediumWeight ?? template.heavyWeight / 2;
  return template.lightWeight ?? 0;
}

function templateSummary(template: WorkoutTemplate): string {
  return template.blocks
    .map((b) => `${b.count}× ${SET_TYPE_LABELS[b.setType]} (${tierWeight(template, b.tier)}kg)`)
    .join(' · ');
}

export default function AddWorkoutWizard() {
  const [step, setStep] = useState<'type' | 'mode' | 'sets'>('type');
  const [exerciseTypes, setExerciseTypes] = useState<ExerciseType[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedType, setSelectedType] = useState<ExerciseType | null>(null);
  const [mode, setMode] = useState<'custom' | 'template' | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [builder, setBuilder] = useState<{ setType: SetType; weight: number; reps: number }>({
    setType: 'WORKING',
    weight: 0,
    reps: 1,
  });
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/exercise-types')
      .then((r) => r.json())
      .then((data) => setExerciseTypes(data))
      .finally(() => setLoadingTypes(false));
  }, []);

  const chooseType = (type: ExerciseType) => {
    setSelectedType(type);
    setMode(null);
    setSelectedTemplate(null);
    setSets([]);
    setBuilder({ setType: 'WORKING', weight: type.quickWeights[0] ?? 0, reps: 1 });
    setStep('mode');
    setLoadingTemplates(true);
    fetch(`/api/templates?exerciseTypeId=${type.id}`)
      .then((r) => r.json())
      .then((data) => setTemplates(data))
      .finally(() => setLoadingTemplates(false));
  };

  const chooseCustom = () => {
    setMode('custom');
    setSets([]);
    setStep('sets');
  };

  const chooseTemplate = (template: WorkoutTemplate) => {
    setMode('template');
    setSelectedTemplate(template);
    const expanded: SetRow[] = [];
    for (const block of [...template.blocks].sort((a, b) => a.order - b.order)) {
      for (let i = 0; i < block.count; i++) {
        expanded.push({ setType: block.setType, weight: tierWeight(template, block.tier), reps: '' });
      }
    }
    setSets(expanded);
    setStep('sets');
  };

  const addCustomSet = () => {
    setSets((prev) => [...prev, { setType: builder.setType, weight: builder.weight, reps: builder.reps }]);
  };

  const removeSet = (idx: number) => {
    setSets((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSet = (idx: number, patch: Partial<SetRow>) => {
    setSets((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const canSubmit = useMemo(() => {
    if (!selectedType || sets.length === 0) return false;
    return sets.every((s) => s.reps !== '' && Number(s.reps) > 0);
  }, [selectedType, sets]);

  const handleSubmit = async () => {
    if (!selectedType || !canSubmit) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseTypeId: selectedType.id,
          templateId: selectedTemplate?.id ?? null,
          date,
          sets: sets.map((s) => ({ setType: s.setType, weight: s.weight, reps: Number(s.reps) })),
        }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Séance enregistrée avec succès !' });
        setSets([]);
        setStep('type');
        setSelectedType(null);
        setMode(null);
        setSelectedTemplate(null);
        setTimeout(() => setMessage(null), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: 'error', text: data.error || "Erreur lors de l'ajout" });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Fil d'ariane */}
      <div className="flex items-center gap-2 text-sm text-gray-300">
        <span className={step === 'type' ? 'text-cyan-300 font-semibold' : ''}>1. Type</span>
        <span>›</span>
        <span className={step === 'mode' ? 'text-cyan-300 font-semibold' : ''}>2. Détail</span>
        <span>›</span>
        <span className={step === 'sets' ? 'text-cyan-300 font-semibold' : ''}>3. Séries</span>
      </div>

      {/* Étape 1 : type de séance */}
      {step === 'type' && (
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-gray-100 mb-4">Quel type de séance ?</h2>
          {loadingTypes ? (
            <p className="text-gray-400">Chargement...</p>
          ) : exerciseTypes.length === 0 ? (
            <p className="text-gray-400">
              Aucun type de séance. Crée-en un dans « Types de séance ».
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {exerciseTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => chooseType(type)}
                  className="px-6 py-5 rounded-xl font-semibold border-2 bg-white/5 border-white/20 text-gray-200 hover:bg-white/15 hover:border-cyan-400/60 transition-all text-center"
                >
                  {type.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Étape 2 : personnalisé ou template */}
      {step === 'mode' && selectedType && (
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
          <button onClick={() => setStep('type')} className="text-gray-400 hover:text-white mb-4 flex items-center gap-1 text-sm">
            <ChevronLeft size={16} /> Retour
          </button>
          <h2 className="text-lg font-bold text-gray-100 mb-4">{selectedType.name} — détail de la séance</h2>

          <button
            onClick={chooseCustom}
            className="w-full mb-4 px-5 py-4 rounded-xl font-semibold border-2 bg-white/5 border-white/20 text-gray-200 hover:bg-white/15 hover:border-cyan-400/60 transition-all flex items-center gap-3"
          >
            <Sparkles size={20} className="text-cyan-400" />
            <span>
              Personnalisée
              <span className="block text-xs font-normal text-gray-400">Je détaille chaque série moi-même</span>
            </span>
          </button>

          {loadingTemplates ? (
            <p className="text-gray-400">Chargement des séances préenregistrées...</p>
          ) : templates.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-400 flex items-center gap-2">
                <ListChecks size={16} /> Ou choisis une séance préenregistrée
              </p>
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => chooseTemplate(template)}
                  className="w-full text-left px-5 py-4 rounded-xl border-2 bg-white/5 border-white/20 text-gray-200 hover:bg-white/15 hover:border-purple-400/60 transition-all"
                >
                  <div className="font-semibold text-white">{template.name}</div>
                  <div className="text-xs text-gray-400 mt-1">{templateSummary(template)}</div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Aucune séance préenregistrée pour {selectedType.name}. Tu peux en créer dans « Séances préenregistrées ».
            </p>
          )}
        </div>
      )}

      {/* Étape 3 : séries + date + submit */}
      {step === 'sets' && selectedType && (
        <div className="space-y-6">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
            <button onClick={() => setStep('mode')} className="text-gray-400 hover:text-white mb-4 flex items-center gap-1 text-sm">
              <ChevronLeft size={16} /> Retour
            </button>
            <label htmlFor="workout-date" className="block text-sm font-semibold text-gray-200 mb-3">Date de l&apos;entraînement</label>
            <input
              id="workout-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 outline-none"
            />
          </div>

          {mode === 'custom' && (
            <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 backdrop-blur-xl border border-green-400/30 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-green-300 mb-6 flex items-center gap-2">
                <Plus size={20} /> Ajouter une série
              </h3>

              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-200 mb-2">Type de série</label>
                <div className="flex gap-2">
                  {(['WARMUP', 'WORKING', 'RECOVERY'] as SetType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setBuilder((b) => ({ ...b, setType: t }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all border ${
                        builder.setType === t
                          ? 'bg-cyan-600 border-cyan-400 text-white'
                          : 'bg-white/5 border-white/20 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {SET_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-sm font-semibold text-gray-200 mb-3">
                  Répétitions: <span className="text-2xl font-bold text-cyan-400">{builder.reps}</span>
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setBuilder((b) => ({ ...b, reps: Math.max(1, b.reps - 1) }))}
                    className="p-3 bg-red-600/80 hover:bg-red-700 text-white rounded-xl transition-all"
                  >
                    <Minus size={20} />
                  </button>
                  <input
                    type="number"
                    value={builder.reps}
                    onChange={(e) => setBuilder((b) => ({ ...b, reps: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-center text-white font-semibold focus:ring-2 focus:ring-cyan-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setBuilder((b) => ({ ...b, reps: b.reps + 1 }))}
                    className="p-3 bg-green-600/80 hover:bg-green-700 text-white rounded-xl transition-all"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-200 mb-3">
                  {selectedType.weightLabel}: <span className="text-2xl font-bold text-yellow-400">{builder.weight}</span>
                </label>
                <div className="flex gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setBuilder((b) => ({ ...b, weight: Math.max(0, b.weight - selectedType.weightStep) }))}
                    className="p-3 bg-red-600/80 hover:bg-red-700 text-white rounded-xl transition-all"
                  >
                    <Minus size={20} />
                  </button>
                  <div className="flex-1 grid grid-cols-4 gap-2">
                    {selectedType.quickWeights.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setBuilder((b) => ({ ...b, weight: w }))}
                        className={`py-2 rounded-lg text-sm font-bold transition-all ${
                          builder.weight === w
                            ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20 border border-white/20'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setBuilder((b) => ({ ...b, weight: b.weight + selectedType.weightStep }))}
                    className="p-3 bg-green-600/80 hover:bg-green-700 text-white rounded-xl transition-all"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={addCustomSet}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold transition-all"
              >
                ➕ Ajouter la série
              </button>
            </div>
          )}

          {sets.length > 0 && (
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
              <h4 className="font-bold text-xl mb-4 text-gray-100">
                {mode === 'template' ? 'Renseigne les répétitions de chaque série' : 'Séries ajoutées'}
                <span className="ml-2 text-sm bg-white/10 px-3 py-1 rounded-full text-cyan-400">{sets.length} séries</span>
              </h4>
              <div className="space-y-2">
                {sets.map((s, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white/10 p-4 rounded-xl border border-white/10">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-cyan-400 font-bold w-6">{idx + 1}</span>
                      <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-300 whitespace-nowrap">
                        {SET_TYPE_LABELS[s.setType]}
                      </span>
                      <span className="text-gray-300 font-semibold whitespace-nowrap">
                        {s.weight} {selectedType.category === 'EXTERNAL_WEIGHT' ? 'kg' : 'kg leste'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          placeholder="reps"
                          value={s.reps}
                          onChange={(e) =>
                            updateSet(idx, { reps: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1) })
                          }
                          className="w-20 px-2 py-1.5 bg-white/10 border border-white/20 rounded-lg text-center text-white focus:ring-2 focus:ring-cyan-400 outline-none"
                        />
                        <span className="text-gray-400 text-sm">reps</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSet(idx)}
                        className="p-2 bg-red-600/80 hover:bg-red-700 text-white rounded-lg transition-all"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check size={20} />
            {submitting ? 'Enregistrement...' : 'Enregistrer la séance'}
          </button>
        </div>
      )}

      {message && (
        <div
          className={`p-4 rounded-xl font-semibold text-center border-2 animate-slide-up ${
            message.type === 'success'
              ? 'bg-green-600/20 border-green-400/50 text-green-300'
              : 'bg-red-600/20 border-red-400/50 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
