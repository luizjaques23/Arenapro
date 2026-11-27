import { getSportDisplayName } from '../engine/sports';
import type { Tournament } from '../types/tournament';
import { removeTournamentPinData } from './pinAuth';

const TOURNAMENTS_KEY = 'arenapro_tournaments_v1';
const SETTINGS_KEY = 'arenapro_settings_v1';
export const HISTORY_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 horas

export interface AppSettings {
  theme: 'light' | 'dark';
  muted: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  muted: false,
};

export function isTournamentExpired(
  tournament: Tournament,
  now = Date.now(),
): boolean {
  // Apenas torneios finalizados (Histórico) expiram automaticamente após 24 horas.
  // Torneios em cadastro ou em andamento permanecem visíveis na listagem.
  if (tournament.status !== 'finished') {
    return false;
  }
  const referenceTime =
    tournament.finishedAt ?? tournament.updatedAt ?? tournament.createdAt;

  if (typeof referenceTime !== 'number' || Number.isNaN(referenceTime)) {
    return false;
  }
  return now - referenceTime >= HISTORY_EXPIRATION_MS;
}

function normalizeLoadedTournament(raw: unknown): Tournament | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Partial<Tournament>;
  if (!t.id || typeof t.id !== 'string') return null;

  const now = Date.now();
  return {
    ...(t as Tournament),
    name: typeof t.name === 'string' && t.name.trim() ? t.name : 'Torneio sem nome',
    teams: Array.isArray(t.teams) ? t.teams : [],
    status:
      t.status === 'setup' || t.status === 'in_progress' || t.status === 'finished'
        ? t.status
        : 'setup',
    createdAt: typeof t.createdAt === 'number' ? t.createdAt : now,
    updatedAt: typeof t.updatedAt === 'number' ? t.updatedAt : now,
  };
}

export function pruneExpiredTournaments(
  tournaments: Tournament[],
  now = Date.now(),
): { active: Tournament[]; removedIds: string[] } {
  const active: Tournament[] = [];
  const removedIds: string[] = [];

  for (const t of tournaments) {
    if (isTournamentExpired(t, now)) {
      removedIds.push(t.id);
    } else {
      active.push(t);
    }
  }

  return { active, removedIds };
}

export function loadTournaments(): Tournament[] {
  try {
    const raw = localStorage.getItem(TOURNAMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const normalized = parsed
      .map(normalizeLoadedTournament)
      .filter((t): t is Tournament => t !== null);

    const { active, removedIds } = pruneExpiredTournaments(normalized);
    if (removedIds.length > 0) {
      for (const id of removedIds) {
        removeTournamentPinData(id);
      }
      saveTournaments(active);
    }
    return active;
  } catch {
    return [];
  }
}

export function saveTournaments(tournaments: Tournament[]): boolean {
  try {
    localStorage.setItem(TOURNAMENTS_KEY, JSON.stringify(tournaments));
    return true;
  } catch {
    return false;
  }
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      muted: Boolean(parsed.muted),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors in restricted webviews
  }
}

export function slugifyFilename(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'torneio'
  );
}

export function formatDateForFilename(timestamp: number): string {
  const d = new Date(timestamp);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function exportTournamentJson(tournament: Tournament): void {
  const payload = {
    app: 'ArenaPro Torneios',
    version: 1,
    exportedAt: Date.now(),
    tournament,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const datePart = formatDateForFilename(tournament.createdAt);
  a.href = url;
  a.download = `${slugifyFilename(tournament.name)}-${datePart}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseImportedTournament(rawText: string): Tournament {
  const parsed = JSON.parse(rawText) as { tournament?: Tournament } | Tournament;
  const candidate =
    'tournament' in parsed && parsed.tournament ? parsed.tournament : (parsed as Tournament);

  if (
    !candidate ||
    typeof candidate.name !== 'string' ||
    !Array.isArray(candidate.teams) ||
    !candidate.sport ||
    !candidate.format
  ) {
    throw new Error('Arquivo JSON inválido ou incompatível.');
  }

  // Ensure sport display metadata is intact
  const sportLabel = getSportDisplayName(candidate.sport);
  return {
    ...candidate,
    id: `trn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    sport: {
      ...candidate.sport,
      label: candidate.sport.label || sportLabel,
    },
    updatedAt: Date.now(),
  };
}
