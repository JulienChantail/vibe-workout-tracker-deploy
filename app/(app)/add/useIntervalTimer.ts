'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { CueAudio } from '../../../lib/cueAudio';
import { LEAD_IN_MS, buildCues, currentInterval, departuresPassed } from '../../../lib/timer';

// ready : pas encore lancé ; countdown : décompte avant le "go" ; finished : temps écoulé
export type TimerPhase = 'ready' | 'countdown' | 'running' | 'paused' | 'finished';

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

/**
 * Chrono de `totalMs` découpé en `intervals` départs, avec annonces vocales.
 * Le temps écoulé est toujours recalculé à partir de l'horloge (jamais en
 * comptant les ticks) : il reste juste si on change d'appli puis qu'on revient.
 */
export function useIntervalTimer({
  totalMs,
  intervals,
  keepAliveInBackground,
}: {
  totalMs: number;
  intervals: number;
  keepAliveInBackground: boolean;
}) {
  const [phase, setPhase] = useState<TimerPhase>('ready');
  const [now, setNow] = useState(0);
  const [countdownEndsAt, setCountdownEndsAt] = useState(0);
  const [runningSince, setRunningSince] = useState(0);
  const [elapsedBefore, setElapsedBefore] = useState(0);

  const audio = useRef<CueAudio | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const lastDepartures = useRef(0);

  const cues = useMemo(() => buildCues(totalMs, intervals), [totalMs, intervals]);

  const elapsed =
    phase === 'countdown'
      ? now - countdownEndsAt
      : phase === 'running'
        ? elapsedBefore + (now - runningSince)
        : elapsedBefore;
  const active = phase === 'countdown' || phase === 'running' || phase === 'paused';

  // Le contexte audio est créé dès l'affichage pour charger les voix à l'avance
  useEffect(() => {
    const a = new CueAudio();
    audio.current = a;
    return () => {
      a.close();
      releaseScreen(wakeLock);
    };
  }, []);

  // Tic d'affichage + passages automatiques (décompte -> départ -> fin)
  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'running') return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (phase === 'countdown') {
        if (t >= countdownEndsAt) {
          setRunningSince(countdownEndsAt);
          setPhase('running');
        }
        return;
      }
      const e = elapsedBefore + (t - runningSince);
      if (e >= totalMs) {
        setElapsedBefore(totalMs);
        setPhase('finished');
        navigator.vibrate?.([400, 150, 400, 150, 600]);
        releaseScreen(wakeLock);
        // laisse le temps au signal de fin d'être joué avant de couper le son de fond
        setTimeout(() => audio.current?.stopKeepAlive(), 4000);
        return;
      }
      const passed = departuresPassed(e, totalMs, intervals);
      if (passed > lastDepartures.current) navigator.vibrate?.(250);
      lastDepartures.current = passed;
      // Son suspendu par le téléphone (appli en arrière-plan sur iPhone...) : on recale les annonces
      const a = audio.current;
      if (a && a.running && Math.abs(a.drift(e)) > 0.25) a.schedule(cues, e);
    }, 200);
    return () => clearInterval(id);
  }, [phase, countdownEndsAt, runningSince, elapsedBefore, totalMs, intervals, cues]);

  // Au retour sur l'appli : on reprend l'écran allumé et le son
  useEffect(() => {
    if (!active) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      keepScreenOn(wakeLock);
      audio.current?.unlock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [active]);

  // Évite de perdre la séance en quittant la page par erreur pendant le chrono
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);

  const start = () => {
    const t = Date.now();
    const goAt = t + LEAD_IN_MS;
    lastDepartures.current = 0;
    setElapsedBefore(0);
    setNow(t);
    setCountdownEndsAt(goAt);
    setPhase('countdown');
    keepScreenOn(wakeLock);
    const a = audio.current;
    if (a) {
      a.unlock()
        .then(() => a.ready)
        .then(() => {
          a.schedule(cues, Date.now() - goAt);
          if (keepAliveInBackground) a.startKeepAlive();
        });
    }
  };

  const pause = () => {
    if (phase !== 'running') return;
    const t = Date.now();
    setElapsedBefore((e) => e + (t - runningSince));
    setNow(t);
    setPhase('paused');
    audio.current?.stopAll();
  };

  const resume = () => {
    if (phase !== 'paused') return;
    const t = Date.now();
    setRunningSince(t);
    setNow(t);
    setPhase('running');
    audio.current?.unlock().then(() => audio.current?.schedule(cues, elapsedBefore));
  };

  // Annule le chrono (pendant le décompte par exemple) et revient à l'état initial
  const stop = () => {
    audio.current?.stopAll();
    audio.current?.stopKeepAlive();
    releaseScreen(wakeLock);
    setElapsedBefore(0);
    setPhase('ready');
  };

  const interval = currentInterval(elapsed, totalMs, intervals);

  return {
    phase,
    active,
    elapsed,
    remaining: totalMs - Math.max(0, elapsed),
    countdownRemaining: phase === 'countdown' ? countdownEndsAt - now : 0,
    departures: departuresPassed(elapsed, totalMs, intervals),
    ...interval,
    start,
    pause,
    resume,
    stop,
  };
}
