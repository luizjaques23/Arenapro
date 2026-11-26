import LZString from 'lz-string';
import type { Tournament } from '../types/tournament';
import { loadTournaments } from './storage';

const CHANNEL_NAME = 'arenapro_live_sync_v1';
const RELAY_BASE_URL = 'https://ntfy.sh';

export interface PublicRouteParams {
  tournamentId: string;
  token: string | null;
}

export function parsePublicRouteFromLocation(): PublicRouteParams | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const queryId = params.get('torneio') || params.get('acompanhar');
  const token = params.get('token');

  if (queryId) {
    return { tournamentId: queryId, token };
  }

  const match = window.location.pathname.match(/\/acompanhar\/([^/]+)/);
  if (match && match[1]) {
    return { tournamentId: decodeURIComponent(match[1]), token };
  }

  return null;
}

function stripSensitiveFields(tournament: Tournament): Tournament {
  const sanitized = { ...tournament };
  delete sanitized.pinHash;
  return sanitized;
}

export function encodeSnapshot(tournament: Tournament): string {
  try {
    const json = JSON.stringify(stripSensitiveFields(tournament));
    return LZString.compressToEncodedURIComponent(json);
  } catch {
    return '';
  }
}

export function decodeCompressedSnapshot(raw: string): Tournament | null {
  if (!raw) return null;
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(raw);
    if (decompressed) {
      return JSON.parse(decompressed) as Tournament;
    }

    const base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as Tournament;
  } catch {
    return null;
  }
}

export function decodeSnapshotFromHash(rawHash?: string): Tournament | null {
  try {
    let raw = '';
    const hash = rawHash ?? (typeof window !== 'undefined' ? window.location.hash : '');
    if (hash) {
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
      raw = hashParams.get('d') || hashParams.get('s') || '';
    }
    if (!raw && typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      raw = searchParams.get('d') || searchParams.get('s') || '';
    }
    if (!raw) return null;
    return decodeCompressedSnapshot(raw);
  } catch {
    return null;
  }
}

export function buildPublicWatchUrl(tournament: Tournament, baseOrigin?: string): string {
  const origin =
    baseOrigin ??
    (typeof window !== 'undefined' ? window.location.href : 'https://arenapro.local/');
  const url = new URL(origin);
  // Preserve deployment base pathname (e.g., /Arenapro/ on GitHub Pages) while stripping /acompanhar/:id
  const cleanedPath = url.pathname.replace(/\/acompanhar\/[^/]+\/?$/, '/');
  url.pathname = cleanedPath || '/';
  url.search = '';
  url.hash = '';
  url.searchParams.set('torneio', tournament.id);
  if (tournament.publicToken) {
    url.searchParams.set('token', tournament.publicToken);
  }

  const snap = encodeSnapshot(tournament);
  if (snap) {
    url.hash = `d=${snap}`;
  }
  return url.toString();
}

function getRelayTopic(tournamentId: string): string {
  const safeId = tournamentId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `arenapro_t_${safeId}`;
}

export async function publishTournamentLive(tournament: Tournament): Promise<void> {
  const isFinished =
    tournament.status === 'finished' || tournament.publicStatus === 'encerrado';
  const updatedTournament: Tournament = stripSensitiveFields({
    ...tournament,
    publicStatus: isFinished ? 'encerrado' : 'ativo',
  });

  // 1. Broadcast locally for instant multi-tab/same-device reflection
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    try {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.postMessage({ type: 'TOURNAMENT_SYNC', tournament: updatedTournament });
      ch.close();
    } catch {
      // Ignore BroadcastChannel errors
    }
  }

  // 2. Publish compressed snapshot to free zero-config serverless relay (stays <4KB for all sizes)
  try {
    const topic = getRelayTopic(tournament.id);
    const compressed = encodeSnapshot(updatedTournament);
    if (!compressed) return;
    const payload = JSON.stringify({
      z: compressed,
      ts: updatedTournament.updatedAt ?? Date.now(),
    });

    await fetch(`${RELAY_BASE_URL}/${topic}`, {
      method: 'POST',
      body: payload,
      headers: {
        Title: 'ArenaPro Live Update',
        Priority: 'default',
      },
    });
  } catch {
    // Network offline: local storage & URL snapshot remain active
  }
}

export function broadcastTournamentUpdate(tournament: Tournament): void {
  void publishTournamentLive(tournament);
}

export function readPublicTournamentFromStorage(
  tournamentId: string,
  token: string | null,
): Tournament | null {
  const list = loadTournaments();
  const found = list.find((t) => t.id === tournamentId);
  if (!found) return null;
  if (token && found.publicToken && found.publicToken !== token) return null;
  return stripSensitiveFields(found);
}

function extractRelayTournament(rawEventData: string): Tournament | null {
  try {
    const parsed = JSON.parse(rawEventData);
    const rawMessage = parsed?.message;
    if (!rawMessage) return null;
    const msg = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
    if (msg && typeof msg.z === 'string') {
      return decodeCompressedSnapshot(msg.z);
    }
    return (msg?.tournament ?? msg) as Tournament;
  } catch {
    return null;
  }
}

export function subscribePublicTournament(
  tournamentId: string,
  token: string | null,
  onUpdate: (tournament: Tournament | null) => void,
): () => void {
  let cancelled = false;
  let bestTournament: Tournament | null = null;

  const validateTournament = (t: Tournament | null): Tournament | null => {
    if (!t || typeof t !== 'object') return null;
    if (t.id !== tournamentId) return null;
    if (token && t.publicToken && t.publicToken !== token) return null;
    return stripSensitiveFields(t);
  };

  const applyCandidate = (candidate: Tournament | null) => {
    const valid = validateTournament(candidate);
    if (!valid || cancelled) return false;

    if (
      !bestTournament ||
      (valid.updatedAt ?? 0) >= (bestTournament.updatedAt ?? 0) ||
      (valid.status === 'finished' && bestTournament.status !== 'finished')
    ) {
      bestTournament = valid;
      onUpdate(valid);
      return true;
    }
    return false;
  };

  // 1. Check snapshot from URL hash first for instant zero-latency load
  applyCandidate(decodeSnapshotFromHash());

  // 2. Check local storage (overrides hash if local state is newer)
  applyCandidate(readPublicTournamentFromStorage(tournamentId, token));

  // 3. Connect to free serverless relay for cross-device live updates
  const topic = getRelayTopic(tournamentId);

  const pollRelay = async () => {
    try {
      const res = await fetch(`${RELAY_BASE_URL}/${topic}/json?poll=1`, {
        cache: 'no-store',
      });
      if (cancelled) return;
      if (res.ok) {
        const text = await res.text();
        const lines = text.trim().split('\n').filter(Boolean);
        for (let i = lines.length - 1; i >= 0; i -= 1) {
          const remoteTournament = extractRelayTournament(lines[i]);
          if (applyCandidate(remoteTournament)) {
            return;
          }
        }
      }
    } catch {
      // Offline fallback
    }
    if (!cancelled && !bestTournament) {
      onUpdate(null);
    }
  };

  void pollRelay();

  // 4. Live Server-Sent Events (SSE) stream for real-time updates without polling
  let eventSource: EventSource | null = null;
  if (typeof EventSource !== 'undefined') {
    try {
      eventSource = new EventSource(`${RELAY_BASE_URL}/${topic}/sse`);
      eventSource.onmessage = (event) => {
        if (cancelled) return;
        const remoteTournament = extractRelayTournament(event.data);
        applyCandidate(remoteTournament);
      };
    } catch {
      eventSource = null;
    }
  }

  // 5. BroadcastChannel & storage event for same-device/same-browser multi-window sync
  let ch: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      ch = new BroadcastChannel(CHANNEL_NAME);
      ch.onmessage = (event) => {
        if (cancelled) return;
        const data = event.data as { type?: string; tournament?: Tournament } | undefined;
        if (data?.type === 'TOURNAMENT_SYNC') {
          applyCandidate(data.tournament ?? null);
        }
      };
    } catch {
      ch = null;
    }
  }

  const handleStorage = () => {
    if (cancelled) return;
    applyCandidate(readPublicTournamentFromStorage(tournamentId, token));
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  // Periodic lightweight check every 6 seconds as safety net
  const pollTimer =
    typeof window !== 'undefined'
      ? window.setInterval(() => {
          if (!cancelled) {
            void pollRelay();
          }
        }, 6000)
      : undefined;

  return () => {
    cancelled = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
      if (pollTimer !== undefined) window.clearInterval(pollTimer);
    }
    if (eventSource) eventSource.close();
    if (ch) ch.close();
  };
}
