import { describe, expect, it } from 'vitest';
import type { Tournament } from '../types/tournament';
import {
  buildPublicWatchUrl,
  buildShareTournamentUrl,
  decodeSnapshotFromHash,
  encodeSnapshot,
  parsePublicRouteFromLocation,
} from './liveSync';
import {
  HISTORY_EXPIRATION_MS,
  loadDeletedTournamentIds,
  loadTournaments,
  markTournamentDeleted,
  pruneExpiredTournaments,
  saveTournaments,
} from './storage';

describe('liveSync (Zero Database Realtime Sync)', () => {
  const dummyTournament: Tournament = {
    id: 'torneio-unit-test-123',
    name: 'Copa Verão Futevôlei',
    sport: {
      id: 'futevolei',
      label: 'Futevôlei',
      scoringMode: 'sets',
      setsToWin: 1,
      pointsPerSet: 18,
      winByTwo: false,
      trackPlayerGoals: false,
      extraStatsEnabled: [],
    },
    format: 'bracket',
    targetTeamsCount: 4,
    teams: [
      {
        id: 't1',
        name: 'Dupla Alfa',
        color: '#10b981',
        emblem: '⚡',
        players: [{ id: 'p1', name: 'Alfa 1' }, { id: 'p2', name: 'Alfa 2' }],
      },
      {
        id: 't2',
        name: 'Dupla Beta',
        color: '#3b82f6',
        emblem: '🔥',
        players: [{ id: 'p3', name: 'Beta 1' }, { id: 'p4', name: 'Beta 2' }],
      },
    ],
    status: 'in_progress',
    publicToken: 'pub_tok_abc',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('compresses and encodes tournament state into URL-safe string', () => {
    const encoded = encodeSnapshot(dummyTournament);
    expect(encoded).toBeTruthy();
    expect(typeof encoded).toBe('string');
    expect(encoded).not.toContain(' ');
    expect(encoded).not.toContain('"');
  });

  it('builds public watch URL with individual tournament ID and compressed hash payload', () => {
    const url = buildPublicWatchUrl(dummyTournament, 'https://arenapro.app/');
    expect(url).toContain('torneio=torneio-unit-test-123');
    expect(url).toContain('token=pub_tok_abc');
    expect(url).toContain('#d=');
  });

  it('decodes snapshot correctly from hash', () => {
    const encoded = encodeSnapshot(dummyTournament);
    const decoded = decodeSnapshotFromHash(`#d=${encoded}`);
    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(dummyTournament.id);
    expect(decoded?.name).toBe('Copa Verão Futevôlei');
    expect(decoded?.teams).toHaveLength(2);
    expect(decoded?.teams[0].name).toBe('Dupla Alfa');
  });

  it('handles fallback if hash parameter is "s" instead of "d"', () => {
    const encoded = encodeSnapshot(dummyTournament);
    const decoded = decodeSnapshotFromHash(`#s=${encoded}`);
    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(dummyTournament.id);
  });

  it('builds exclusive share URL with compartilhar query param and snapshot hash', () => {
    const url = buildShareTournamentUrl(dummyTournament, 'https://arenapro.app/');
    expect(url).toContain('compartilhar=torneio-unit-test-123');
    expect(url).toContain('token=pub_tok_abc');
    expect(url).toContain('#d=');
  });

  it('automatically removes tournaments older than 24 hours from history', () => {
    const now = 1_700_000_000_000;
    const recent: Tournament = {
      ...dummyTournament,
      id: 'recent-1',
      status: 'finished',
      finishedAt: now - (HISTORY_EXPIRATION_MS - 60_000),
    };
    const expired: Tournament = {
      ...dummyTournament,
      id: 'expired-1',
      status: 'finished',
      finishedAt: now - HISTORY_EXPIRATION_MS - 1,
    };

    const result = pruneExpiredTournaments([recent, expired], now);
    expect(result.active.map((t) => t.id)).toEqual(['recent-1']);
    expect(result.removedIds).toEqual(['expired-1']);
  });

  it('keeps active (setup and in_progress) tournaments even after 24 hours', () => {
    const now = 1_700_000_000_000;
    const oldSetup: Tournament = {
      ...dummyTournament,
      id: 'setup-old',
      status: 'setup',
      createdAt: now - HISTORY_EXPIRATION_MS * 3,
      updatedAt: now - HISTORY_EXPIRATION_MS * 3,
    };
    const oldInProgress: Tournament = {
      ...dummyTournament,
      id: 'progress-old',
      status: 'in_progress',
      createdAt: now - HISTORY_EXPIRATION_MS * 2,
      updatedAt: now - HISTORY_EXPIRATION_MS * 2,
    };

    const result = pruneExpiredTournaments([oldSetup, oldInProgress], now);
    expect(result.active.map((t) => t.id)).toEqual(['setup-old', 'progress-old']);
    expect(result.removedIds).toEqual([]);
  });

  it('persists and restores created tournaments in localStorage reliably', () => {
    const store = new Map<string, string>();
    const prevStorage = (globalThis as { localStorage?: Storage }).localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, String(v)),
        removeItem: (k: string) => store.delete(k),
      },
    });

    try {
      const saved = saveTournaments([dummyTournament]);
      expect(saved).toBe(true);
      const reloaded = loadTournaments();
      expect(reloaded).toHaveLength(1);
      expect(reloaded[0].id).toBe(dummyTournament.id);
      expect(reloaded[0].name).toBe('Copa Verão Futevôlei');
      expect(typeof parsePublicRouteFromLocation).toBe('function');

      // Deleted tournaments are filtered out from listing
      markTournamentDeleted(dummyTournament.id);
      expect(loadDeletedTournamentIds().has(dummyTournament.id)).toBe(true);
      expect(loadTournaments()).toHaveLength(0);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: prevStorage,
      });
    }
  });
});
