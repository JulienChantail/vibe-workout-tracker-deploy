type SetLike = { weight: number; reps: number; setType: string };

/**
 * Formule d'Epley : estimation du 1RM à partir d'une série (poids x reps).
 * Fiable surtout entre 1 et 10 répétitions.
 */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

/**
 * 1RM d'une séance : meilleure estimation (Epley) parmi les séries de travail
 * uniquement (les séries d'échauffement/récupération ne sont pas à l'effort max
 * et fausseraient l'estimation).
 *
 * Pour les exercices de catégorie BODYWEIGHT_LESTE (dips, tractions lestées...),
 * le poids saisi n'est que le leste alors que le poids réellement soulevé est
 * corps + leste : `bodyWeightKg` est donc ajouté avant d'appliquer Epley (le
 * poids du corps influe sur l'effort réel), puis retranché du résultat pour
 * exprimer le 1RM en équivalent leste (ex : 50kg de corps, 80kg de 1RM total
 * => 30kg affichés).
 */
export function sessionOneRepMax(sets: SetLike[], bodyWeightKg = 0): number | null {
  const working = sets.filter((s) => s.setType === 'WORKING' && s.reps > 0);
  if (working.length === 0) return null;
  return Math.max(...working.map((s) => estimateOneRepMax(s.weight + bodyWeightKg, s.reps) - bodyWeightKg));
}
