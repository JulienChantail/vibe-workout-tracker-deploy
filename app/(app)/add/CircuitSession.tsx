'use client';

import { useState } from 'react';
import { ChevronLeft, Check, Minus, Plus } from 'lucide-react';
import { circuitSummary, formatScore, repsPerRound, totalsByExercise, type CircuitExercise } from '../../../lib/circuit';
import { formatClock, formatDuration, maxObjective } from '../../../lib/timer';
import TimerClock from './TimerClock';
import { useIntervalTimer } from './useIntervalTimer';
import { FullScreen, KeepAliveOption, RoundButton, TimerTopBar, useKeepAliveSetting } from './TimerShared';

export type CircuitType = { id: string; name: string; timeCapMinutes: number | null; circuit: CircuitExercise[] };

const ORANGE = '#ff9f43';

// setup : choix de l'objectif ; timer : chrono ; confirm : confirmation du mode libre ;
// score : vérification du score puis enregistrement
type View = 'setup' | 'timer' | 'confirm' | 'score';

function plural(n: number, word: string) {
  return `${n} ${word}${n > 1 ? 's' : ''}`;
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
  const minutes = exerciseType.timeCapMinutes ?? 20;
  const totalMs = minutes * 60_000;
  const maxObj = maxObjective(totalMs);
  const perRound = repsPerRound(exerciseType.circuit);

  const [view, setView] = useState<View>('setup');
  const [objectiveInput, setObjectiveInput] = useState<number | ''>(Math.min(10, maxObj));
  const [withObjective, setWithObjective] = useState(true);
  const [keepAlive, setKeepAlive] = useKeepAliveSetting();
  // Mode libre : on compte soi-même (toujours le cas sans objectif)
  const [freeMode, setFreeMode] = useState(false);
  const [manualCount, setManualCount] = useState(0);
  const [usedTimer, setUsedTimer] = useState(false);
  const [finishHandled, setFinishHandled] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [extraReps, setExtraReps] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const objectiveValid = objectiveInput !== '' && objectiveInput >= 1 && objectiveInput <= maxObj;
  const objective = withObjective && objectiveValid ? Number(objectiveInput) : null;
  const timer = useIntervalTimer({ totalMs, intervals: objective ?? 1, keepAliveInBackground: keepAlive });

  const manual = freeMode || objective === null;
  const count = manual ? manualCount : timer.departures;
  const inCountdown = timer.phase === 'countdown';

  // Fin du temps : on passe à l'écran du score avec les tours comptés
  if (timer.phase === 'finished' && !finishHandled) {
    setFinishHandled(true);
    setRounds(count);
    setExtraReps(0);
    setView('score');
  }

  const startTimer = () => {
    setUsedTimer(true);
    setFreeMode(false);
    setManualCount(0);
    setFinishHandled(false);
    timer.start();
    setView('timer');
  };

  const cancelCountdown = () => {
    timer.stop();
    setView('setup');
  };

  const finishEarly = () => {
    timer.pause();
    setRounds(count);
    setExtraReps(0);
    setView('score');
  };

  const confirmFreeMode = () => {
    // Le compteur reprend les tours déjà comptés aux bips ; on ajuste ensuite avec − / +
    setManualCount(timer.departures);
    setFreeMode(true);
    setView('timer');
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseTypeId: exerciseType.id,
          date,
          rounds,
          extraReps,
          objective: usedTimer ? objective : null,
          sets: [],
        }),
      });
      if (res.ok) {
        timer.stop();
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

  // Libellés de l'horloge
  const isLastInterval = timer.index >= (objective ?? 1) - 1;
  const clockLabel = inCountdown
    ? 'départ dans'
    : objective === null || isLastInterval
      ? 'avant la fin'
      : freeMode
        ? 'avant le prochain bip'
        : `avant le départ du tour ${timer.index + 2}`;
  const clockBig = inCountdown
    ? String(Math.max(1, Math.ceil(timer.countdownRemaining / 1000)))
    : formatClock(objective === null ? timer.remaining : timer.intervalRemaining);
  const clockProgress = inCountdown ? 0 : timer.intervalElapsed / timer.intervalMs;
  const behind = objective !== null ? manualCount - timer.departures : 0;

  return (
    <div className="space-y-6">
      {view === 'setup' && (
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
          <button onClick={onBack} className="text-gray-400 hover:text-white mb-4 flex items-center gap-1 text-sm">
            <ChevronLeft size={16} /> Retour
          </button>
          <h2 className="text-2xl font-bold tracking-[0.15em] uppercase text-center" style={{ color: ORANGE }}>
            {exerciseType.name}
          </h2>
          <p className="text-center text-gray-400 mt-2 text-sm">
            Le plus de tours possible en {minutes} minutes
            <br />
            {circuitSummary(exerciseType.circuit)}
          </p>

          <div className={`mt-8 transition-opacity ${withObjective ? '' : 'opacity-40'}`}>
            <p className="text-center text-xs tracking-[0.15em] text-gray-300">OBJECTIF (NOMBRE DE TOURS)</p>
            <div className="mt-3 flex items-center justify-center gap-5">
              <RoundButton
                label="Moins"
                color={ORANGE}
                disabled={!withObjective}
                onClick={() => setObjectiveInput((v) => Math.max(1, (v === '' ? 1 : v) - 1))}
              >
                <Minus size={24} />
              </RoundButton>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={maxObj}
                aria-label="Objectif en nombre de tours"
                value={objectiveInput}
                disabled={!withObjective}
                onChange={(e) => setObjectiveInput(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                className="w-28 h-24 rounded-2xl border-2 bg-transparent text-center text-6xl font-extralight outline-none [font-variant-numeric:tabular-nums]"
                style={{ borderColor: ORANGE, color: ORANGE }}
              />
              <RoundButton
                label="Plus"
                color={ORANGE}
                disabled={!withObjective}
                onClick={() => setObjectiveInput((v) => Math.min(maxObj, (v === '' ? 0 : v) + 1))}
              >
                <Plus size={24} />
              </RoundButton>
            </div>
            <p className="text-center mt-4 text-lg">
              {objectiveValid ? (
                <>
                  un départ toutes les{' '}
                  <strong style={{ color: ORANGE }}>{formatDuration(totalMs / Number(objectiveInput))}</strong>
                </>
              ) : (
                <span className="text-red-300 text-sm">Entre 1 et {maxObj} tours (un départ toutes les 10 s au plus).</span>
              )}
            </p>
          </div>

          <div className="flex justify-center mt-4">
            <button
              type="button"
              onClick={() => setWithObjective((w) => !w)}
              className={`px-4 py-2 rounded-full text-sm border transition-all ${
                withObjective ? 'border-white/20 text-gray-400' : 'border-orange-300 text-orange-200 bg-orange-400/10'
              }`}
            >
              Sans objectif (je compte mes tours)
            </button>
          </div>

          <button
            onClick={startTimer}
            disabled={withObjective && !objectiveValid}
            className="w-full mt-8 py-4 rounded-full font-bold tracking-wide text-[#111] disabled:opacity-40"
            style={{ backgroundColor: ORANGE }}
          >
            LANCER LE CHRONO
          </button>
          <div className="mt-4">
            <KeepAliveOption value={keepAlive} onChange={setKeepAlive} />
          </div>
          <button
            onClick={() => {
              setUsedTimer(false);
              setView('score');
            }}
            className="w-full mt-4 text-sm text-gray-500 hover:text-gray-300"
          >
            Saisir un score sans chrono
          </button>
        </div>
      )}

      {view === 'timer' && (
        <FullScreen>
          <TimerTopBar
            label={objective === null ? 'Sans objectif' : freeMode ? 'Mode libre' : 'Objectif · comptage auto'}
            paused={timer.phase === 'paused'}
            disabled={inCountdown}
            onPause={timer.pause}
            onResume={timer.resume}
          />
          <h1 className="mt-4 text-2xl font-bold tracking-[0.15em] uppercase text-center" style={{ color: ORANGE }}>
            {exerciseType.name}
          </h1>
          <p className="text-center text-gray-400 mt-1">
            {objective === null ? (
              <>Sans objectif · {minutes} min</>
            ) : freeMode ? (
              <>
                Objectif <strong className="text-white">{objective}</strong> · départ toutes les{' '}
                <strong className="text-white">{formatDuration(timer.intervalMs)}</strong>
              </>
            ) : (
              <>
                Objectif <strong className="text-white">{objective}</strong> · tour{' '}
                <strong className="text-white">{Math.min(objective, timer.index + 1)}</strong> en cours
              </>
            )}
          </p>
          <p className="text-center text-xs text-gray-500 mt-1">{circuitSummary(exerciseType.circuit)}</p>

          <div className="mt-6">
            <TimerClock
              color={ORANGE}
              progress={clockProgress}
              segments={objective ?? 1}
              segmentsDone={inCountdown ? 0 : timer.index}
              big={clockBig}
              label={clockLabel}
              total={formatClock(timer.remaining)}
            />
          </div>
          {timer.phase === 'paused' && <p className="text-center text-amber-300 font-semibold mt-2">En pause</p>}

          {manual ? (
            <div className="mt-6 flex flex-col items-center">
              {objective !== null && (
                <span
                  className={`text-xs px-3 py-1 rounded-full ${
                    behind > 0 ? 'bg-emerald-500/15 text-emerald-300' : behind < 0 ? 'bg-orange-400/15 text-orange-200' : 'bg-white/10 text-gray-300'
                  }`}
                >
                  {behind > 0
                    ? `${plural(behind, 'tour')} d'avance sur l'objectif`
                    : behind < 0
                      ? `${plural(-behind, 'tour')} de retard sur l'objectif`
                      : "Dans les temps sur l'objectif"}
                </span>
              )}
              <div className="mt-4 flex items-center gap-6">
                <RoundButton label="Un tour de moins" color={ORANGE} disabled={manualCount === 0} onClick={() => setManualCount((c) => Math.max(0, c - 1))}>
                  <Minus size={26} />
                </RoundButton>
                <div className="text-center min-w-[80px]">
                  <div className="text-6xl font-extralight [font-variant-numeric:tabular-nums]">{manualCount}</div>
                  <div className="text-xs text-gray-400">tours faits</div>
                </div>
                <RoundButton label="Un tour de plus" color={ORANGE} primary disabled={inCountdown} onClick={() => setManualCount((c) => c + 1)}>
                  <Plus size={26} />
                </RoundButton>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center">
              <div className="text-6xl font-extralight [font-variant-numeric:tabular-nums]">{count}</div>
              <div className="text-xs text-gray-400">tours faits (auto)</div>
              <button
                type="button"
                onClick={() => setView('confirm')}
                disabled={inCountdown}
                className="mt-5 px-8 py-3 rounded-full border font-semibold disabled:opacity-40"
                style={{ borderColor: ORANGE, color: ORANGE }}
              >
                Mode libre
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={inCountdown ? cancelCountdown : finishEarly}
            className="mt-auto pt-10 text-sm text-gray-500 hover:text-gray-300 self-center"
          >
            {inCountdown ? 'Annuler' : 'Terminer'}
          </button>
        </FullScreen>
      )}

      {view === 'confirm' && (
        <FullScreen>
          <div className="mt-4 rounded-full border border-[#2c2c34] bg-[#141418] px-5 py-3 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: ORANGE }} />
            <div>
              <div className="text-gray-100 [font-variant-numeric:tabular-nums]">
                {formatClock(timer.intervalRemaining)} {clockLabel}
              </div>
              <div className="text-xs text-gray-500 [font-variant-numeric:tabular-nums]">
                {formatClock(timer.remaining)} restantes · {timer.phase === 'paused' ? 'en pause' : 'le chrono tourne'}
              </div>
            </div>
          </div>

          <h2 className="mt-14 text-2xl font-semibold text-center">Passer en mode libre ?</h2>
          <p className="mt-5 text-center text-gray-300 leading-relaxed">
            Tu comptes toi-même tes tours avec − et +, à ton rythme.
            <br />
            Les bips continuent comme repère d&apos;allure, mais le compteur n&apos;avance plus tout seul.
          </p>
          <div className="mt-8 rounded-2xl border border-orange-400/35 bg-orange-400/10 px-5 py-4 text-center">
            <div className="text-sm text-orange-200">Le compteur partira de</div>
            <div className="text-xl font-semibold" style={{ color: ORANGE }}>
              {plural(timer.departures, 'tour')} {timer.departures > 1 ? 'faits' : 'fait'}
            </div>
          </div>

          <div className="mt-auto pt-10 space-y-3">
            <button onClick={confirmFreeMode} className="w-full py-4 rounded-full font-bold tracking-wide text-[#111]" style={{ backgroundColor: ORANGE }}>
              PASSER EN MODE LIBRE
            </button>
            <button onClick={() => setView('timer')} className="w-full py-3.5 rounded-full border border-[#3a3a44] text-gray-200 font-semibold">
              Revenir au chrono
            </button>
          </div>
        </FullScreen>
      )}

      {view === 'score' && (
        <div className="space-y-6">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 space-y-5">
            {timer.phase === 'finished' ? (
              <p className="text-center text-2xl font-black text-amber-300">Temps écoulé ! Bravo 💪</p>
            ) : usedTimer && timer.phase === 'paused' ? (
              <button onClick={() => setView('timer')} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm">
                <ChevronLeft size={16} /> Revenir au chrono (en pause)
              </button>
            ) : (
              <button onClick={() => setView('setup')} className="text-gray-400 hover:text-white flex items-center gap-1 text-sm">
                <ChevronLeft size={16} /> Retour
              </button>
            )}
            {usedTimer && objective !== null && (
              <p className="text-center text-sm text-gray-400">
                Objectif : <strong className="text-white">{objective} tours</strong>
              </p>
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
                {extraReps > 0
                  ? `= ${totalsByExercise(0, extraReps, exerciseType.circuit)
                      .filter((t) => t.reps > 0)
                      .map((t) => `${t.reps} ${t.name}`)
                      .join(' + ')}`
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
