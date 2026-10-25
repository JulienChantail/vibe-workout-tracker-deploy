/**
 * EMOM (Every Minute On the Minute) : au début de chaque minute, on fait le même
 * nombre de répétitions d'un exercice. Le score est la moyenne de répétitions par
 * minute (ex : 7 pendant 5 min puis 6 pendant 5 min = 6,5).
 */

// SQL Server ne gère pas les tableaux : la liste des exercices est stockée en JSON texte
export function parseExerciseOptions(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalizeExerciseOptions(parsed) : [];
  } catch {
    return [];
  }
}

/** Noms non vides, sans doublon, 100 caractères au plus. */
export function normalizeExerciseOptions(value: unknown[]): string[] {
  const names = value.map((v) => (typeof v === 'string' ? v.trim().slice(0, 100) : '')).filter(Boolean);
  return [...new Set(names)];
}

/** "6,5" -> 6.5 ; accepte la virgule ou le point. NaN si ce n'est pas un nombre. */
export function parseRepsPerMinute(value: string): number {
  const trimmed = value.trim().replace(',', '.');
  return trimmed === '' ? NaN : Number(trimmed);
}

/** 6.5 -> "6,5" ; 7 -> "7" */
export function formatRepsPerMinute(value: number): string {
  return (Math.round(value * 10) / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

/** Total de répétitions de la séance, arrondi à l'unité. */
export function totalEmomReps(repsPerMinute: number, durationMinutes: number): number {
  return Math.round(repsPerMinute * durationMinutes);
}
