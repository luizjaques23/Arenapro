import { beforeEach, describe, expect, it } from 'vitest';
import { SPORT_PRESETS } from '../engine/sports';
import { createTournament } from '../engine/tournamentEngine';
import { decodeSnapshotFromHash, encodeSnapshot } from './liveSync';
import {
  hashPin,
  isTournamentUnlockedInSession,
  isValidNumericPin,
  lockTournamentSession,
  sanitizeNumericPin,
  unlockTournamentSession,
  verifyTournamentPin,
} from './pinAuth';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe('pinAuth (100% Frontend Numeric Password Protection)', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: createMemoryStorage(),
      configurable: true,
      writable: true,
    });
  });

  it('sanitizes input strictly to numeric digits 0-9', () => {
    expect(sanitizeNumericPin('12a34-!@#b')).toBe('1234');
    expect(sanitizeNumericPin('abcdef')).toBe('');
    expect(sanitizeNumericPin('9876543210')).toBe('98765432');
  });

  it('validates numeric PIN length (minimum 4 digits)', () => {
    expect(isValidNumericPin('123')).toBe(false);
    expect(isValidNumericPin('123a')).toBe(false);
    expect(isValidNumericPin('1234')).toBe(true);
    expect(isValidNumericPin('0000')).toBe(true);
    expect(isValidNumericPin('123456')).toBe(true);
  });

  it('creates pure-JS deterministic hashes per tournament ID without crypto.subtle', () => {
    const hA = hashPin('1234', 'trn_a');
    const hB = hashPin('1234', 'trn_b');
    expect(hA).toMatch(/^pin1\$[0-9a-f]{16}$/);
    expect(hA).not.toBe(hB);
    expect(hashPin('1234', 'trn_a')).toBe(hA);
  });

  it('binds unique numeric password to each created tournament and verifies it', () => {
    const futevolei = SPORT_PRESETS[0].defaultConfig;
    const t1 = createTournament({
      name: 'Torneio Manhã',
      sport: futevolei,
      format: 'bracket',
      targetTeamsCount: 8,
      pin: '2468',
    });
    const t2 = createTournament({
      name: 'Torneio Tarde',
      sport: futevolei,
      format: 'bracket',
      targetTeamsCount: 8,
      pin: '1357',
    });

    expect(t1.pinHash).toBeTruthy();
    expect(t2.pinHash).toBeTruthy();
    expect(t1.pinHash).not.toBe(t2.pinHash);

    expect(verifyTournamentPin(t1, '2468')).toBe(true);
    expect(verifyTournamentPin(t1, '1357')).toBe(false);
    expect(verifyTournamentPin(t1, '0000')).toBe(false);

    expect(verifyTournamentPin(t2, '1357')).toBe(true);
    expect(verifyTournamentPin(t2, '2468')).toBe(false);
  });

  it('enforces strict session isolation between tournaments and supports locking', () => {
    const futevolei = SPORT_PRESETS[0].defaultConfig;
    const t1 = createTournament({
      name: 'Torneio 1',
      sport: futevolei,
      format: 'bracket',
      targetTeamsCount: 4,
      pin: '1111',
    });
    const t2 = createTournament({
      name: 'Torneio 2',
      sport: futevolei,
      format: 'bracket',
      targetTeamsCount: 4,
      pin: '2222',
    });

    expect(isTournamentUnlockedInSession(t1)).toBe(false);
    expect(isTournamentUnlockedInSession(t2)).toBe(false);

    // Unlocking t1 ONLY unlocks t1
    unlockTournamentSession(t1.id);
    expect(isTournamentUnlockedInSession(t1)).toBe(true);
    expect(isTournamentUnlockedInSession(t2)).toBe(false);

    // Switching to t2 unlocks t2 and automatically locks t1
    unlockTournamentSession(t2.id);
    expect(isTournamentUnlockedInSession(t2)).toBe(true);
    expect(isTournamentUnlockedInSession(t1)).toBe(false);

    // Explicit lock clears session unlock
    lockTournamentSession();
    expect(isTournamentUnlockedInSession(t1)).toBe(false);
    expect(isTournamentUnlockedInSession(t2)).toBe(false);
  });

  it('strips pinHash from public spectator share links', () => {
    const futevolei = SPORT_PRESETS[0].defaultConfig;
    const t1 = createTournament({
      name: 'Torneio Secreto',
      sport: futevolei,
      format: 'bracket',
      targetTeamsCount: 4,
      pin: '9988',
    });

    expect(t1.pinHash).toBeTruthy();
    const encoded = encodeSnapshot(t1);
    const decoded = decodeSnapshotFromHash(`#d=${encoded}`);
    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(t1.id);
    expect(decoded?.pinHash).toBeUndefined();
  });
});
