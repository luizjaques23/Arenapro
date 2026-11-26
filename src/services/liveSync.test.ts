import { describe, expect, it } from 'vitest';
import type { Tournament } from '../types/tournament';
import {
  buildPublicWatchUrl,
  decodeSnapshotFromHash,
  encodeSnapshot,
} from './liveSync';

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
});
