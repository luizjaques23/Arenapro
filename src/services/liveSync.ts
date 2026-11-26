import type { Tournament } from '../types/tournament';
import { loadTournaments } from './storage';

const CHANNEL_NAME = 'arenapro_live_sync_v1';

export function buildPublicWatchUrl(tournament: Tournament): string {
  if (typeof window === 'undefined' || !tournament.publicToken) return '';
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('acompanhar', tournament.id);
  url.searchParams.set('token', tournament.publicToken);
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
  token: string,
): Tournament | null {
  const list = loadTournaments();
  const found = list.find((t) => t.id === tournamentId);
  if (!found) return null;
  if (found.publicToken && found.publicToken !== token) return null;
  return found;
}

export function subscribePublicTournament(
  tournamentId: string,
  token: string,
  onUpdate: (tournament: Tournament | null) => void,
): () => void {
  const refresh = () => {
    onUpdate(readPublicTournamentFromStorage(tournamentId, token));
  };

  refresh();

  let ch: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      ch = new BroadcastChannel(CHANNEL_NAME);
      ch.onmessage = (event) => {
        const data = event.data as { type?: string; tournament?: Tournament } | undefined;
        if (
          data?.type === 'TOURNAMENT_SYNC' &&
          data.tournament?.id === tournamentId &&
          (!data.tournament.publicToken || data.tournament.publicToken === token)
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
      refresh();
    }
  };
  window.addEventListener('storage', handleStorage);

  const pollId = window.setInterval(refresh, 1500);

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.clearInterval(pollId);
    if (ch) ch.close();
  };
}
