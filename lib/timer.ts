/**
 * Chrono à intervalles : défi avec objectif (ex : 10 tours en 20 min = un départ
 * toutes les 2:00), EMOM (un départ par minute) ou défi sans objectif (un seul
 * intervalle de 20 min).
 *
 * Tous les temps sont en millisecondes depuis le "go" (0 = départ, négatif =
 * décompte avant le départ).
 */

export type CueKind = 'three' | 'two' | 'one' | 'go' | 'beep' | 'halfway' | 'end';
export type Cue = { atMs: number; kind: CueKind };

export const LEAD_IN_MS = 5000;
// En dessous, les annonces "3, 2, 1" se chevaucheraient d'un départ à l'autre
export const MIN_INTERVAL_MS = 10_000;
// En dessous, "halfway there" tomberait en plein dans le "3, 2, 1"
export const HALFWAY_MIN_INTERVAL_MS = 20_000;

/** Objectif maximal pour une durée donnée (intervalle d'au moins 10 s). */
export function maxObjective(totalMs: number): number {
  return Math.max(1, Math.floor(totalMs / MIN_INTERVAL_MS));
}

/**
 * Annonces de la séance : "3, 2, 1, go" au départ, "3, 2, 1" puis un bip à
 * chaque nouveau départ, "halfway there" au milieu de chaque intervalle, et
 * "3, 2, 1" puis le signal de fin.
 */
export function buildCues(totalMs: number, intervals: number): Cue[] {
  const intervalMs = totalMs / intervals;
  const cues: Cue[] = [];
  const countdown = (atMs: number) => {
    cues.push({ atMs: atMs - 3000, kind: 'three' }, { atMs: atMs - 2000, kind: 'two' }, { atMs: atMs - 1000, kind: 'one' });
  };

  countdown(0);
  cues.push({ atMs: 0, kind: 'go' });
  for (let k = 1; k < intervals; k++) {
    countdown(k * intervalMs);
    cues.push({ atMs: k * intervalMs, kind: 'beep' });
  }
  if (intervalMs >= HALFWAY_MIN_INTERVAL_MS) {
    for (let k = 0; k < intervals; k++) cues.push({ atMs: k * intervalMs + intervalMs / 2, kind: 'halfway' });
  }
  countdown(totalMs);
  cues.push({ atMs: totalMs, kind: 'end' });

  return cues.sort((a, b) => a.atMs - b.atMs);
}

/** Nombre de départs déjà passés après le premier (= tours comptés automatiquement). */
export function departuresPassed(elapsedMs: number, totalMs: number, intervals: number): number {
  if (elapsedMs <= 0) return 0;
  // petite marge : 3 x 400 000 ms peut donner 1 199 999,99... en virgule flottante
  return Math.min(intervals, Math.floor(elapsedMs / (totalMs / intervals) + 1e-9));
}

/** Intervalle en cours (0 = premier) et temps restant avant le prochain départ ou la fin. */
export function currentInterval(elapsedMs: number, totalMs: number, intervals: number) {
  const intervalMs = totalMs / intervals;
  const e = Math.min(Math.max(0, elapsedMs), totalMs);
  const index = Math.min(intervals - 1, Math.floor(e / intervalMs + 1e-9));
  const intervalElapsed = e - index * intervalMs;
  return { index, intervalMs, intervalElapsed, intervalRemaining: intervalMs - intervalElapsed };
}

/** Compte à rebours "m:ss" (arrondi à la seconde supérieure, comme une horloge de WOD). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000 - 1e-9));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Durée "m:ss" arrondie à la seconde la plus proche (ex : intervalle de 1:03). */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
