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

    // First attempt: lz-string
    const decompressed = LZString.decompressFromEncodedURIComponent(raw);
    if (decompressed) {
      return JSON.parse(decompressed) as Tournament;
    }

    // Fallback: standard base64 if created by an older version
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

export function buildPublicWatchUrl(tournament: Tournament, baseOrigin?: string): string {
  const origin =
    baseOrigin ??
    (typeof window !== 'undefined' ? window.location.href : 'https://arenapro.local/');
  const url = new URL(origin);
  url.pathname = '/';
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
  // Safe topic name containing only alphanumeric and underscores
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
      // Ignore
    }
  }

  // 2. Publish to free zero-config serverless relay for cross-device live updates
  try {
    const topic = getRelayTopic(tournament.id);
    const payload = JSON.stringify({
      tournament: updatedTournament,
      timestamp: Date.now(),
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
  return found;
}

export function subscribePublicTournament(
  tournamentId: string,
  token: string | null,
  onUpdate: (tournament: Tournament | null) => void,
): () => void {
  let cancelled = false;

  const validateTournament = (t: Tournament | null): Tournament | null => {
    if (!t) return null;
    if (t.id !== tournamentId) return null;
    if (token && t.publicToken && t.publicToken !== token) return null;
    return t;
  };

  // 1. Check local storage first
  const local = readPublicTournamentFromStorage(tournamentId, token);
  if (local) {
    onUpdate(local);
  }

  // 2. Check snapshot from URL hash
  const fromHash = decodeSnapshotFromHash();
  const validHash = validateTournament(fromHash);
  if (validHash) {
    onUpdate(validHash);
  }

  // 3. Connect to free serverless relay for cross-device live updates
  const topic = getRelayTopic(tournamentId);

  // Fast initial fetch from relay to ensure latest state is fetched immediately
  const pollRelay = async () => {
    try {
      const res = await fetch(`${RELAY_BASE_URL}/${topic}/json?poll=1`, {
        cache: 'no-store',
      });
      if (cancelled || !res.ok) return;
      const text = await res.text();
      // ntfy can return multiple JSON lines if multiple messages exist
      const lines = text.trim().split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        try {
          const parsed = JSON.parse(lines[i]);
          const rawMessage = parsed.message;
          const msg = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
          const remoteTournament = validateTournament(msg?.tournament ?? msg);
          if (remoteTournament) {
            onUpdate(remoteTournament);
            return;
          }
        } catch {
          // Continue to next line
        }
      }
    } catch {
      // Offline fallback
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
        try {
          const parsed = JSON.parse(event.data);
          const rawMessage = parsed.message;
          if (!rawMessage) return;
          const msg = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
          const remoteTournament = validateTournament(msg?.tournament ?? msg);
          if (remoteTournament) {
            onUpdate(remoteTournament);
          }
        } catch {
          // Ignore invalid message
        }
      };
    } catch {
      eventSource = null;
    }
  }

  // 5. BroadcastChannel for same-device/same-browser multi-window testing
  let ch: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      ch = new BroadcastChannel(CHANNEL_NAME);
      ch.onmessage = (event) => {
        if (cancelled) return;
        const data = event.data as { type?: string; tournament?: Tournament } | undefined;
        if (data?.type === 'TOURNAMENT_SYNC') {
          const valid = validateTournament(data.tournament ?? null);
          if (valid) onUpdate(valid);
        }
      };
    } catch {
      ch = null;
    }
  }

  // Periodic lightweight check every 8 seconds as safety net
  const pollTimer = window.setInterval(() => {
    if (!cancelled) {
      void pollRelay();
    }
  }, 8000);

  return () => {
    cancelled = true;
    window.clearInterval(pollTimer);
    if (eventSource) eventSource.close();
    if (ch) ch.close();
  };
}
