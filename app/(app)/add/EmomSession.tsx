'use client';

import { useState } from 'react';
import { ChevronLeft, Check, Minus, Pencil, Plus } from 'lucide-react';
import { formatClock } from '../../../lib/timer';
import { formatRepsPerMinute, parseRepsPerMinute, totalEmomReps } from '../../../lib/emom';
import TimerClock from './TimerClock';
import { useIntervalTimer } from './useIntervalTimer';
import { FullScreen, KeepAliveOption, TimerTopBar, useKeepAliveSetting } from './TimerShared';

export type EmomType = { id: string; name: string; timeCapMinutes: number | null; exerciseOptions: string[] };

const VIOLET = '#c56cf0';
const DEFAULT_EXERCISES = ['Dips', 'Tractions', 'Pompes'];

type View = 'setup' | 'timer' | 'score';

export default function EmomSession({
  exerciseType,
  onBack,
  onSaved,
}: {
  exerciseType: EmomType;
  onBack: () => void;
  onSaved: () => void;
}) {
  const exercises = exerciseType.exerciseOptions.length > 0 ? exerciseType.exerciseOptions : DEFAULT_EXERCISES;

  const [view, setView] = useState<View>('setup');
  const [exercise, setExercise] = useState(exercises[0]);
  const [minutes, setMinutes] = useState<number | ''>(exerciseType.timeCapMinutes ?? 10);
  const [editDuration, setEditDuration] = useState(false);
  const [keepAlive, setKeepAlive] = useKeepAliveSetting();
  const [usedTimer, setUsedTimer] = useState(false);
  const [finishHandled, setFinishHandled] = useState(false);
  const [repsInput, setRepsInput] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const minutesValid = minutes !== '' && minutes >= 1 && minutes <= 60;
  const duration = minutesValid ? Number(minutes) : 10;
  const timer = useIntervalTimer({ totalMs: duration * 60_000, intervals: duration, keepAliveInBackground: keepAlive });
  const inCountdown = timer.phase === 'countdown';

  const repsPerMinute = parseRepsPerMinute(repsInput);
  const repsValid = Number.isFinite(repsPerMinute) && repsPerMinute > 0 && repsPerMinute <= 200;

  // Fin du temps : on passe à la saisie des répétitions par minute
  if (timer.phase === 'finished' && !finishHandled) {
    setFinishHandled(true);
    setView('score');
  }

  const startTimer = () => {
    setUsedTimer(true);
    setFinishHandled(false);
    timer.start();
    setView('timer');
  };

  const stepReps = (delta: number) => {
    const current = Number.isFinite(repsPerMinute) ? repsPerMinute : 0;
    const next = Math.max(0.5, Math.round((current + delta) * 2) / 2);
    setRepsInput(formatRepsPerMinute(next));
  };

  const handleSubmit = async () => {
    if (!repsValid || !minutesValid) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseTypeId: exerciseType.id,
          date,
          exercise,
          repsPerMinute,
          durationMinutes: duration,
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

  const isLastMinute = timer.index >= duration - 1;

  return (
    <div className="space-y-6">
      {view === 'setup' && (
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6">
          <button onClick={onBack} className="text-gray-400 hover:text-white mb-4 flex items-center gap-1 text-sm">
            <ChevronLeft size={16} /> Retour
          </button>
          <h2 className="text-2xl font-bold tracking-[0.15em] uppercase text-center" style={{ color: VIOLET }}>
            {exerciseType.name}
          </h2>
          <p className="text-center text-gray-400 mt-2 text-sm">
            Every minute on the minute
            <br />
            le même nombre de reps au début de chaque minute
          </p>

          <p className="mt-8 text-center text-xs tracking-[0.15em] text-gray-300">EXERCICE</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {exercises.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setExercise(name)}
                className={`px-4 py-3 rounded-2xl border text-base transition-all ${
                  exercise === name ? 'text-white' : 'border-white/20 text-gray-300 hover:bg-white/10'
                }`}
                style={exercise === name ? { borderColor: VIOLET, backgroundColor: 'rgba(197,108,240,0.18)' } : undefined}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="mt-8 text-center">
            {editDuration ? (
              <div className="flex items-center justify-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={60}
                  aria-label="Durée en minutes"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 px-3 py-2 bg-white/5 border border-white/20 rounded-xl text-center text-3xl font-extralight text-white outline-none"
                />
                <span className="text-gray-400">minutes</span>
              </div>
            ) : (
              <div>
                <span className="text-5xl font-extralight">{duration}</span>
                <span className="text-gray-400 ml-2">minutes</span>
              </div>
            )}
            {!minutesValid && <p className="text-red-300 text-sm mt-1">Entre 1 et 60 minutes.</p>}
            {!editDuration && (
              <button type="button" onClick={() => setEditDuration(true)} className="mt-1 text-xs text-gray-500 hover:text-gray-300 inline-flex items-center gap-1">
                <Pencil size={12} /> modifier la durée
              </button>
            )}
          </div>

          <button
            onClick={startTimer}
            disabled={!minutesValid}
            className="w-full mt-8 py-4 rounded-full font-bold tracking-wide text-[#111] disabled:opacity-40"
            style={{ backgroundColor: VIOLET }}
          >
            LANCER L&apos;EMOM
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
          <TimerTopBar label="" paused={timer.phase === 'paused'} disabled={inCountdown} onPause={timer.pause} onResume={timer.resume} />
          <h1 className="mt-4 text-2xl font-bold tracking-[0.15em] uppercase text-center" style={{ color: VIOLET }}>
            EMOM · {exercise}
          </h1>
          <p className="text-center text-gray-400 mt-1">
            minute <strong className="text-white">{Math.min(duration, timer.index + 1)} / {duration}</strong>
          </p>

          <div className="mt-8">
            <TimerClock
              color={VIOLET}
              progress={inCountdown ? 0 : timer.intervalElapsed / timer.intervalMs}
              segments={duration}
              segmentsDone={inCountdown ? 0 : timer.index}
              big={inCountdown ? String(Math.max(1, Math.ceil(timer.countdownRemaining / 1000))) : formatClock(timer.intervalRemaining)}
              label={inCountdown ? 'départ dans' : isLastMinute ? 'avant la fin' : `avant la minute ${timer.index + 2}`}
              total={formatClock(timer.remaining)}
            />
          </div>
          {timer.phase === 'paused' && <p className="text-center text-amber-300 font-semibold mt-2">En pause</p>}

          <button
            type="button"
            onClick={
              inCountdown
                ? () => {
                    timer.stop();
                    setView('setup');
                  }
                : () => {
                    timer.pause();
                    setView('score');
                  }
            }
            className="mt-auto pt-10 text-sm text-gray-500 hover:text-gray-300 self-center"
          >
            {inCountdown ? 'Annuler' : 'Terminer'}
          </button>
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

            <p className="text-center text-gray-300">
              EMOM <strong className="text-white">{exercise}</strong> · {duration} min
            </p>

            <div>
              <label htmlFor="emom-date" className="block text-sm font-semibold text-gray-200 mb-2">Date de l&apos;entraînement</label>
              <input
                id="emom-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-cyan-400 outline-none"
              />
            </div>

            <div>
              <label htmlFor="emom-reps" className="block text-sm font-semibold text-gray-200 mb-1">
                Répétitions par minute
              </label>
              <p className="text-xs text-gray-400 mb-2">Moyenne sur la séance : 7 puis 6 à la moitié = 6,5.</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => stepReps(-0.5)} className="p-3 bg-red-600/80 hover:bg-red-700 text-white rounded-xl" aria-label="Moins 0,5">
                  <Minus size={20} />
                </button>
                <input
                  id="emom-reps"
                  type="text"
                  inputMode="decimal"
                  placeholder="ex : 6,5"
                  value={repsInput}
                  onChange={(e) => setRepsInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                  className="flex-1 min-w-0 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-center text-white text-xl font-semibold focus:ring-2 focus:ring-cyan-400 outline-none"
                />
                <button type="button" onClick={() => stepReps(0.5)} className="p-3 bg-green-600/80 hover:bg-green-700 text-white rounded-xl" aria-label="Plus 0,5">
                  <Plus size={20} />
                </button>
              </div>
            </div>

            {repsValid && (
              <div className="rounded-xl p-4 text-center border" style={{ borderColor: 'rgba(197,108,240,0.35)', backgroundColor: 'rgba(197,108,240,0.10)' }}>
                <p className="text-2xl font-black text-white">{formatRepsPerMinute(repsPerMinute)} reps/min</p>
                <p className="text-sm text-gray-300 mt-1">
                  ≈ {totalEmomReps(repsPerMinute, duration)} {exercise} en {duration} min
                </p>
              </div>
            )}

            {error && <p className="text-red-300 text-sm text-center">{error}</p>}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !repsValid}
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
