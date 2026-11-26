import type { Tournament } from '../types/tournament';

const PIN_MAP_STORAGE_KEY = 'arenapro_tournament_pins_v1';
const SESSION_UNLOCKED_KEY = 'arenapro_unlocked_tournament_v1';

export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 8;

/**
 * Strips any character that is not a numeric digit (0-9).
 */
export function sanitizeNumericPin(raw: string): string {
  return raw.replace(/\D+/g, '').slice(0, MAX_PIN_LENGTH);
}

/**
 * Validates that a PIN contains only digits 0-9 and has at least MIN_PIN_LENGTH digits.
 */
export function isValidNumericPin(pin: string): boolean {
  return new RegExp(`^\\d{${MIN_PIN_LENGTH},${MAX_PIN_LENGTH}}$`).test(pin);
}

/**
 * Lightweight, deterministic 64-bit hash in pure JavaScript (cyrb53).
 * Does NOT use crypto.subtle so it works reliably on file://, local HTTP, and HTTPS.
 */
export function hashPin(pin: string, salt = ''): string {
  const clean = sanitizeNumericPin(pin);
  const str = `arenapro_pin_v1:${salt}:${clean}`;
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;

  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const part1 = (h2 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h1 >>> 0).toString(16).padStart(8, '0');
  return `pin1$${part1}${part2}`;
}

function loadPinMap(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PIN_MAP_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function savePinMap(map: Record<string, string>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PIN_MAP_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Persists the hashed PIN linked to a specific tournament ID in localStorage.
 */
export function saveTournamentPinHash(tournamentId: string, pinHash: string): void {
  if (!tournamentId || !pinHash) return;
  const map = loadPinMap();
  map[tournamentId] = pinHash;
  savePinMap(map);
}

/**
 * Retrieves the hashed PIN for a specific tournament ID from localStorage map.
 */
export function getStoredTournamentPinHash(tournamentId: string): string | null {
  if (!tournamentId) return null;
  const map = loadPinMap();
  return map[tournamentId] ?? null;
}

/**
 * Removes a tournament's PIN from localStorage and sessionStorage when deleted.
 */
export function removeTournamentPinData(tournamentId: string): void {
  if (!tournamentId) return;
  const map = loadPinMap();
  if (tournamentId in map) {
    delete map[tournamentId];
    savePinMap(map);
  }
  if (getUnlockedTournamentIdFromSession() === tournamentId) {
    lockTournamentSession(tournamentId);
  }
}

/**
 * Checks whether a tournament has PIN protection configured.
 */
export function hasTournamentPin(tournament: Tournament | null | undefined): boolean {
  if (!tournament) return false;
  return Boolean(tournament.pinHash || getStoredTournamentPinHash(tournament.id));
}

/**
 * Verifies a candidate numeric PIN against the tournament's stored PIN hash.
 */
export function verifyTournamentPin(
  tournament: Tournament | null | undefined,
  candidatePin: string,
): boolean {
  if (!tournament) return false;
  const expectedHash =
    tournament.pinHash || getStoredTournamentPinHash(tournament.id);
  if (!expectedHash) return true;

  const clean = sanitizeNumericPin(candidatePin);
  if (!isValidNumericPin(clean)) return false;

  const saltedHash = hashPin(clean, tournament.id);
  const unsaltedHash = hashPin(clean, '');
  return (
    expectedHash === saltedHash ||
    expectedHash === unsaltedHash ||
    expectedHash === clean
  );
}

/**
 * Unlocks a single tournament ID in sessionStorage.
 * Enforces isolation between tournaments: unlocking one tournament locks any other.
 */
export function unlockTournamentSession(tournamentId: string): void {
  if (typeof sessionStorage === 'undefined' || !tournamentId) return;
  try {
    sessionStorage.setItem(SESSION_UNLOCKED_KEY, tournamentId);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clears the unlocked tournament session from sessionStorage.
 */
export function lockTournamentSession(tournamentId?: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (!tournamentId) {
      sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
      return;
    }
    const current = sessionStorage.getItem(SESSION_UNLOCKED_KEY);
    if (current === tournamentId) {
      sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getUnlockedTournamentIdFromSession(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(SESSION_UNLOCKED_KEY);
  } catch {
    return null;
  }
}

/**
 * Checks if a tournament is currently unlocked in sessionStorage.
 */
export function isTournamentUnlockedInSession(
  tournament: Tournament | null | undefined,
): boolean {
  if (!tournament) return false;
  if (!hasTournamentPin(tournament)) return true;
  return getUnlockedTournamentIdFromSession() === tournament.id;
}
