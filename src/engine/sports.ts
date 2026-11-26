import type { SportConfig, SportId } from '../types/tournament';

export interface SportPreset {
  id: SportId;
  label: string;
  tagline: string;
  defaultConfig: SportConfig;
}

export const SPORT_PRESETS: SportPreset[] = [
  {
    id: 'futevolei',
    label: 'Futevôlei',
    tagline: 'Sets e pontos na areia',
    defaultConfig: {
      id: 'futevolei',
      label: 'Futevôlei',
      scoringMode: 'sets',
      setsToWin: 1,
      pointsPerSet: 18,
      winByTwo: true,
      trackPlayerGoals: false,
      extraStatsEnabled: ['ace', 'block'],
    },
  },
  {
    id: 'futsal',
    label: 'Futsal',
    tagline: 'Gols por jogador e artilheiro',
    defaultConfig: {
      id: 'futsal',
      label: 'Futsal',
      scoringMode: 'goals',
      setsToWin: 1,
      pointsPerSet: 0,
      winByTwo: false,
      trackPlayerGoals: true,
      extraStatsEnabled: ['assist'],
    },
  },
  {
    id: 'volei_praia',
    label: 'Vôlei de Praia',
    tagline: 'Sets de 21 ou 15 pontos',
    defaultConfig: {
      id: 'volei_praia',
      label: 'Vôlei de Praia',
      scoringMode: 'sets',
      setsToWin: 1,
      pointsPerSet: 21,
      winByTwo: true,
      trackPlayerGoals: false,
      extraStatsEnabled: ['ace', 'block'],
    },
  },
  {
    id: 'beach_tennis',
    label: 'Beach Tennis',
    tagline: 'Sets ou tie-break na areia',
    defaultConfig: {
      id: 'beach_tennis',
      label: 'Beach Tennis',
      scoringMode: 'sets',
      setsToWin: 1,
      pointsPerSet: 6,
      winByTwo: true,
      trackPlayerGoals: false,
      extraStatsEnabled: ['ace'],
    },
  },
  {
    id: 'outro',
    label: 'Outro',
    tagline: 'Modalidade personalizada',
    defaultConfig: {
      id: 'outro',
      label: 'Outro',
      customName: 'Personalizado',
      scoringMode: 'sets',
      setsToWin: 1,
      pointsPerSet: 15,
      winByTwo: false,
      trackPlayerGoals: false,
      extraStatsEnabled: [],
    },
  },
];

export function getSportDisplayName(sport: SportConfig): string {
  if (sport.id === 'outro' && sport.customName?.trim()) {
    return sport.customName.trim();
  }
  return sport.label;
}

export const TEAM_COLORS = [
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#0ea5e9', // Sky
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#3b82f6', // Blue
  '#84cc16', // Lime
  '#eab308', // Yellow
  '#06b6d4', // Cyan
];

export const TEAM_EMBLEMS = [
  '⚽',
  '🏐',
  '🏖️',
  '🔥',
  '⚡',
  '🦈',
  '🦁',
  '🦅',
  '🌴',
  '🏆',
  '⭐',
  '🎯',
];
