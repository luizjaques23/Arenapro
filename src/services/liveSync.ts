import type { Tournament } from '../types/tournament';
import { fetchTournamentFromCloud, isCloudSyncEnabled } from './cloudSync';
import { loadTournaments } from './storage';

const CHANNEL_NAME = 'arenapro_live_sync_v1';

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

function encodeSnapshot(tournament: Tournament): string {
  try {
    const json = JSON.stringify(tournament);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

export function decodeSnapshotFromHash(): Tournament | null {
  if (typeof window === 'undefined' || !window.location.hash) return null;
  try {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const raw = hashParams.get('s');
    if (!raw) return null;
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

export function buildPublicWatchUrl(tournament: Tournament): string {
  if (typeof window === 'undefined' || !tournament.publicToken) return '';
  const url = new URL(window.location.href);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  url.searchParams.set('torneio', tournament.id);
  url.searchParams.set('token', tournament.publicToken);

  if (!isCloudSyncEnabled()) {
    const snap = encodeSnapshot(tournament);
    if (snap) url.hash = `s=${snap}`;
  }
  return url.toString();
}

export function broadcastTournamentUpdate(tournament: Tournament): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.postMessage({ type: 'TOURNAMENT_SYNC', tournament });
    ch.close();
  } catch {
    // Ignore BroadcastChannel errors in restricted browsers
  }
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

  const refresh = async () => {
    if (isCloudSyncEnabled()) {
      const cloud = await fetchTournamentFromCloud(tournamentId, token);
      if (!cancelled && cloud) {
        onUpdate(cloud);
        return;
      }
    }

    const local = readPublicTournamentFromStorage(tournamentId, token);
    if (!cancelled && local) {
      onUpdate(local);
      return;
    }

    const fromHash = decodeSnapshotFromHash();
    if (
      !cancelled &&
      fromHash &&
      fromHash.id === tournamentId &&
      (!token || !fromHash.publicToken || fromHash.publicToken === token)
    ) {
      onUpdate(fromHash);
      return;
    }

    if (!cancelled) {
      onUpdate(null);
    }
  };

  void refresh();

  let ch: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      ch = new BroadcastChannel(CHANNEL_NAME);
      ch.onmessage = (event) => {
        const data = event.data as { type?: string; tournament?: Tournament } | undefined;
        if (
          data?.type === 'TOURNAMENT_SYNC' &&
          data.tournament?.id === tournamentId &&
          (!token || !data.tournament.publicToken || data.tournament.publicToken === token)
        ) {
          onUpdate(data.tournament);
        }
      };
    } catch {
      ch = null;
    }
  }

  const handleStorage = (e: StorageEvent) => {
    if (!e.key || e.key === 'arenapro_tournaments_v1') {
      void refresh();
    }
  };
  window.addEventListener('storage', handleStorage);

  const pollId = window.setInterval(() => {
    void refresh();
  }, 1800);

  return () => {
    cancelled = true;
    window.removeEventListener('storage', handleStorage);
    window.clearInterval(pollId);
    if (ch) ch.close();
  };
}
