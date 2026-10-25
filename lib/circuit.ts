/**
 * Circuits chronométrés (catégorie CIRCUIT), ex : le défi Tom Holland / "Cindy" :
 * le plus de tours possible en 20 minutes de 5 tractions + 10 pompes.
 *
 * Le score d'une séance est un nombre de tours complets + des répétitions en plus
 * (le tour commencé mais pas fini quand le temps s'arrête), comme en CrossFit.
 */

export type CircuitExercise = { name: string; reps: number };

// SQL Server ne gère pas le type Json avec Prisma : la composition d'un tour est
// stockée en JSON texte, ex : '[{"name":"Tractions","reps":5},{"name":"Pompes","reps":10}]'
export function parseCircuit(value: string | null | undefined): CircuitExercise[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalizeCircuit(parsed) : [];
  } catch {
    return [];
  }
}

/** Garde uniquement les exercices valides (nom non vide, répétitions entières >= 1). */
export function normalizeCircuit(value: unknown[]): CircuitExercise[] {
  return value
    .map((item) => {
      const e = item as { name?: unknown; reps?: unknown };
      return { name: typeof e.name === 'string' ? e.name.trim() : '', reps: Number(e.reps) };
    })
    .filter((e) => e.name && Number.isInteger(e.reps) && e.reps >= 1);
}

/** Nombre de répétitions dans un tour complet (5 + 10 = 15 pour le défi Tom Holland). */
export function repsPerRound(circuit: CircuitExercise[]): number {
  return circuit.reduce((sum, e) => sum + e.reps, 0);
}

/** "5 Tractions + 10 Pompes" */
export function circuitSummary(circuit: CircuitExercise[]): string {
  return circuit.map((e) => `${e.reps} ${e.name}`).join(' + ');
}

/** Score sur une seule valeur pour la courbe : 19 tours + 3 reps sur 15 => 19,2 tours. */
export function roundsScore(rounds: number, extraReps: number, circuit: CircuitExercise[]): number {
  const perRound = repsPerRound(circuit);
  return perRound > 0 ? rounds + extraReps / perRound : rounds;
}

/** "19 tours", "19 tours + 3 reps", "1 tour" */
export function formatScore(rounds: number, extraReps: number): string {
  const base = `${rounds} tour${rounds > 1 ? 's' : ''}`;
  return extraReps > 0 ? `${base} + ${extraReps} rep${extraReps > 1 ? 's' : ''}` : base;
}

/**
 * Répétitions réellement faites par exercice : les tours complets, plus les
 * répétitions en plus réparties dans l'ordre du tour (7 reps en plus sur
 * "5 tractions + 10 pompes" => 5 tractions et 2 pompes).
 */
export function totalsByExercise(
  rounds: number,
  extraReps: number,
  circuit: CircuitExercise[]
): { name: string; reps: number }[] {
  let remaining = extraReps;
  return circuit.map((e) => {
    const extra = Math.min(remaining, e.reps);
    remaining -= extra;
    return { name: e.name, reps: rounds * e.reps + extra };
  });
}
