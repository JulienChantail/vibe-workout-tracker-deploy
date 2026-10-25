'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { ChevronLeft, Check, Pause, Play, Plus, Minus, Flag, Timer, PenLine } from 'lucide-react';
import { circuitSummary, formatScore, repsPerRound, totalsByExercise, type CircuitExercise } from '../../../lib/circuit';

export type CircuitType = { id: string; name: string; timeCapMinutes: number | null; circuit: CircuitExercise[] };

// choose : choix chrono / saisie ; countdown : décompte avant le départ ; running / paused : chrono ;
// score : vérification du score puis enregistrement
type Phase = 'choose' | 'countdown' | 'running' | 'paused' | 'score';

const LEAD_IN_MS = 5000;

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function beep(ctx: AudioContext | null, frequency: number, seconds: number) {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = frequency;
    gain.gain.value = 0.2;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  } catch {
    // pas de son disponible : tant pis
  }
}

// Garde l'écran allumé pendant le chrono (Screen Wake Lock), si le navigateur le permet
async function keepScreenOn(lock: RefObject<WakeLockSentinel | null>) {
  try {
    lock.current = (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    // navigateur sans Wake Lock ou batterie faible : l'écran pourra se mettre en veille
  }
}

function releaseScreen(lock: RefObject<WakeLockSentinel | null>) {
  lock.current?.release().catch(() => {});
  lock.current = null;
}

export default function CircuitSession({
  exerciseType,
  onBack,
  onSaved,
}: {
  exerciseType: CircuitType;
  onBack: () => void;
  onSaved: () => void;
}) {
  const durationMs = (exerciseType.timeCapMinutes ?? 20) * 60_000;
  const perRound = repsPerRound(exerciseType.circuit);

  const [phase, setPhase] = useState<Phase>('choose');
  const [usedTimer, setUsedTimer] = useState(false);
  const [timeUp, setTimeUp] = useState(false);
  // Le temps écoulé est recalculé à partir de l'horloge (et pas en comptant les
  // ticks) pour rester juste même si le téléphone ralentit l'onglet.
  const [now, setNow] = useState(0);
  const [countdownEndsAt, setCountdownEndsAt] = useState(0);
  const [runningSince, setRunningSince] = useState(0);
  const [elapsedBefore, setElapsedBefore] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [splits, setSplits] = useState<number[]>([]); // temps écoulé (ms) à la fin de chaque tour
  const [extraReps, setExtraReps] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const audio = useRef<AudioContext | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const elapsed = phase === 'running' ? elapsedBefore + (now - runningSince) : elapsedBefore;
  const remaining = durationMs - elapsed;
  const timerActive = phase === 'countdown' || phase === 'running' || phase === 'paused';

  // Tic du chrono (et passage automatique : décompte -> départ -> fin du temps)
  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'running') return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (phase === 'countdown' && t >= countdownEndsAt) {
        setRunningSince(t);
        setPhase('running');
        beep(audio.current, 880, 0.4);
      } else if (phase === 'running' && elapsedBefore + (t - runningSince) >= durationMs) {
        setElapsedBefore(durationMs);
        setTimeUp(true);
        setPhase('score');
        beep(audio.current, 660, 1.2);
        navigator.vibrate?.([400, 150, 400, 150, 400]);
        releaseScreen(wakeLock);
      }
    }, 200);
    return () => clearInterval(id);
  }, [phase, countdownEndsAt, runningSince, elapsedBefore, durationMs]);

  // Le verrou "écran allumé" saute quand on change d'appli : on le reprend au retour
  useEffect(() => {
    if (!timerActive) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') keepScreenOn(wakeLock);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [timerActive]);

  // Évite de perdre la séance en quittant la page par erreur pendant le chrono
  useEffect(() => {
    if (!timerActive) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [timerActive]);

  useEffect(() => () => releaseScreen(wakeLock), []);

  const startTimer = () => {
    // Le son doit être "débloqué" par un clic : on crée le contexte audio ici
    audio.current ??= new AudioContext();
    const t = Date.now();
    setUsedTimer(true);
    setTimeUp(false);
    setRounds(0);
    setSplits([]);
    setExtraReps(0);
    setElapsedBefore(0);
    setNow(t);
    setCountdownEndsAt(t + LEAD_IN_MS);
    setPhase('countdown');
    keepScreenOn(wakeLock);
  };

  const pause = () => {
    const t = Date.now();
    setElapsedBefore((e) => e + (t - runningSince));
    setNow(t);
    setPhase('paused');
  };

  const resume = () => {
    const t = Date.now();
    setRunningSince(t);
    setNow(t);
    setPhase('running');
  };

  const addRound = () => {
    const t = Date.now();
    setRounds((r) => r + 1);
    setSplits((s) => [...s, elapsedBefore + (phase === 'running' ? t - runningSince : 0)]);
  };

  const removeRound = () => {
    setRounds((r) => Math.max(0, r - 1));
    setSplits((s) => s.slice(0, -1));
  };

  const finishEarly = () => {
    if (phase === 'running') pause();
    setPhase('score');
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exerciseTypeId: exerciseType.id, date, rounds, extraReps, sets: [] }),
      });
      if (res.ok) {
        releaseScreen(wakeLock);
        onSaved();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erreur lors de l'enregistrement");
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  const lastSplit = splits.length > 0 ? splits[splits.length - 1] - (splits[splits.length - 2] ?? 0) : null;
  const unfinishedRound = totalsByExercise(0, extraReps, exerciseType.circuit).filter((t) => t.reps > 0);

  return (
    <div className="space-y-6">
      {phase === 'choose' && (
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
          <button onClick={onBack} className="text-gray-400 hover:text-white mb-4 flex items-center gap-1 text-sm">
            <ChevronLeft size={16} /> Retour
          </button>
          <h2 className="text-lg font-bold text-gray-100">{exerciseType.name}</h2>
          <p className="text-gray-300 mt-2">
            Le plus de tours possible en <strong className="text-white">{exerciseType.timeCapMinutes ?? 20} minutes</strong> :
          </p>
          <p className="text-cyan-300 font-semibold text-lg mt-1">{circuitSummary(exerciseType.circuit)}</p>
          <p className="text-sm text-gray-400 mt-1">Au poids du corps, sans leste.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
            <button
              onClick={startTimer}
              className="px-5 py-4 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white transition-all flex items-center gap-3"
            >
              <Timer size={22} />
              <span className="text-left">
                Lancer le chrono
                <span className="block text-xs font-normal text-cyan-100">Je compte mes tours en direct</span>
              </span>
            </button>
            <button
              onClick={() => {
                setUsedTimer(false);
                setTimeUp(false);
                setPhase('score');
              }}
              className="px-5 py-4 rounded-xl font-semibold border-2 bg-white/5 border-white/20 text-gray-200 hover:bg-white/15 hover:border-cyan-400/60 transition-all flex items-center gap-3"
            >
              <PenLine size={22} className="text-cyan-400" />
              <span className="text-left">
                Saisir mon score
                <span className="block text-xs font-normal text-gray-400">Séance déjà faite</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {timerActive && (
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 text-center space-y-6">
          {phase === 'countdown' ? (
            <div>
              <p className="text-gray-300 text-lg">Prêt ? Départ dans</p>
              <p className="text-8xl font-black text-cyan-300 [font-variant-numeric:tabular-nums]">
                {Math.max(1, Math.ceil((countdownEndsAt - now) / 1000))}
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className={`text-7xl sm:text-8xl font-black [font-variant-numeric:tabular-nums] ${remaining <= 60_000 ? 'text-amber-300' : 'text-white'}`}>
                  {formatClock(remaining)}
                </p>
                {phase === 'paused' && <p className="text-amber-300 font-semibold mt-1">En pause</p>}
              </div>

              <div>
                <p className="text-gray-400 text-sm">Tours terminés</p>
                <p className="text-6xl font-black text-cyan-300 [font-variant-numeric:tabular-nums]">{rounds}</p>
                {lastSplit !== null && (
                  <p className="text-xs text-gray-400 mt-1">Dernier tour en {formatClock(lastSplit)}</p>
                )}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Tour {rounds + 1}</p>
                <p className="text-lg font-semibold text-white">{circuitSummary(exerciseType.circuit)}</p>
              </div>

              <button
                onClick={addRound}
                disabled={phase !== 'running'}
                className="w-full py-8 rounded-2xl text-3xl font-black bg-gradient-to-r from-green-500 to-emerald-600 active:scale-[0.98] disabled:opacity-40 text-white transition-all flex items-center justify-center gap-3"
              >
                <Plus size={32} /> 1 tour
              </button>

              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={removeRound}
                  disabled={rounds === 0}
                  className="py-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-gray-200 font-semibold flex items-center justify-center gap-1"
                >
                  <Minus size={18} /> 1 tour
                </button>
                {phase === 'running' ? (
                  <button onClick={pause} className="py-3 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 font-semibold flex items-center justify-center gap-1">
                    <Pause size={18} /> Pause
                  </button>
                ) : (
                  <button onClick={resume} className="py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-semibold flex items-center justify-center gap-1">
                    <Play size={18} /> Reprendre
                  </button>
                )}
                <button onClick={finishEarly} className="py-3 rounded-xl bg-red-600/80 hover:bg-red-700 text-white font-semibold flex items-center justify-center gap-1">
                  <Flag size={18} /> Terminer
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {phase === 'score' && (
        <div className="space-y-6">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 space-y-5">
            {timeUp ? (
              <p className="text-center text-2xl font-black text-amber-300">Temps écoulé ! Bravo 💪</p>
            ) : usedTimer ? (
              <button onClick={() => setPhase('paused')} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm">
                <ChevronLeft size={16} /> Revenir au chrono
              </button>
            ) : (
              <button onClick={() => setPhase('choose')} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm">
                <ChevronLeft size={16} /> Retour
              </button>
            )}

            <div>
              <label htmlFor="circuit-date" className="block text-sm font-semibold text-gray-200 mb-2">Date de l&apos;entraînement</label>
              <input
                id="circuit-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-2">
                Tours complets : <span className="text-2xl font-bold text-cyan-400">{rounds}</span>
              </label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setRounds((r) => Math.max(0, r - 1))} className="p-3 bg-red-600/80 hover:bg-red-700 text-white rounded-xl">
                  <Minus size={20} />
                </button>
                <input
                  type="number"
                  min={0}
                  aria-label="Tours complets"
                  value={rounds}
                  onChange={(e) => setRounds(Math.max(0, parseInt(e.target.value) || 0))}
                  className="flex-1 min-w-0 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-center text-white font-semibold focus:ring-2 focus:ring-cyan-400 outline-none"
                />
                <button type="button" onClick={() => setRounds((r) => r + 1)} className="p-3 bg-green-600/80 hover:bg-green-700 text-white rounded-xl">
                  <Plus size={20} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-200 mb-1">
                Répétitions du tour inachevé : <span className="text-2xl font-bold text-yellow-400">{extraReps}</span>
              </label>
              <p className="text-xs text-gray-400 mb-2">
                {unfinishedRound.length > 0
                  ? `= ${unfinishedRound.map((t) => `${t.reps} ${t.name}`).join(' + ')}`
                  : `Ce que tu as fait du tour suivant quand le temps s'est arrêté (0 à ${Math.max(0, perRound - 1)}).`}
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setExtraReps((r) => Math.max(0, r - 1))} className="p-3 bg-red-600/80 hover:bg-red-700 text-white rounded-xl">
                  <Minus size={20} />
                </button>
                <input
                  type="number"
                  min={0}
                  max={Math.max(0, perRound - 1)}
                  aria-label="Répétitions du tour inachevé"
                  value={extraReps}
                  onChange={(e) => setExtraReps(Math.min(Math.max(0, perRound - 1), Math.max(0, parseInt(e.target.value) || 0)))}
                  className="flex-1 min-w-0 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-center text-white font-semibold focus:ring-2 focus:ring-cyan-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setExtraReps((r) => Math.min(Math.max(0, perRound - 1), r + 1))}
                  className="p-3 bg-green-600/80 hover:bg-green-700 text-white rounded-xl"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            <div className="bg-cyan-500/10 border border-cyan-400/30 rounded-xl p-4 text-center">
              <p className="text-2xl font-black text-white">{formatScore(rounds, extraReps)}</p>
              <p className="text-sm text-gray-300 mt-1">
                {totalsByExercise(rounds, extraReps, exerciseType.circuit)
                  .map((t) => `${t.reps} ${t.name}`)
                  .join(' · ')}
              </p>
            </div>

            {error && <p className="text-red-300 text-sm text-center">{error}</p>}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || (rounds === 0 && extraReps === 0)}
            className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check size={20} />
            {submitting ? 'Enregistrement...' : 'Enregistrer la séance'}
          </button>
        </div>
      )}
    </div>
  );
}
