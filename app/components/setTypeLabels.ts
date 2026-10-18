export const SET_TYPE_LABELS: Record<string, string> = {
  WARMUP: 'Échauffement',
  WORKING: 'Travail',
  RECOVERY: 'Récupération',
};

export const SET_TYPE_ORDER = ['WARMUP', 'WORKING', 'RECOVERY'] as const;

export const TIER_LABELS: Record<string, string> = {
  HEAVY: 'Lourd',
  MEDIUM: 'Moyen',
  LIGHT: 'Léger / à vide',
};
