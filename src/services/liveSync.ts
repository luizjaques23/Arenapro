import LZString from 'lz-string';
import type { Tournament } from '../types/tournament';
import { getFirebaseDatabaseUrl, isFirebaseConfigured } from './firebaseConfig';
import { loadTournaments } from './storage';
import { isSupabaseConfigured, supabaseConfig } from './supabaseConfig';

const CHANNEL_NAME = 'arenapro_live_sync_v1';
const RELAY_BASE_URL = 'https://ntfy.sh';

export interface PublicRouteParams {
  tournamentId: string;
  token: string | null;
}

export function parsePublicRouteFromLocation(): PublicRouteParams | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const queryId =
    params.get('compartilhar') || params.get('torneio') || params.get('acompanhar');
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

function normalizeTournamentData(raw: Tournament | null | undefined): Tournament | null {
  if (!raw || typeof raw !== 'object' || !raw.id) return null;

  const normalizeMatches = (
    matches:
      | (Tournament['bracket'] extends undefined
        ? never
        : NonNullable<Tournament['bracket']>['winnersRounds'][number]['matches'])
      | undefined,
  ) =>
    (Array.isArray(matches) ? matches : []).map((m) => ({
      ...m,
      teamAId: m.teamAId ?? null,
      teamBId: m.teamBId ?? null,
      sets: Array.isArray(m.sets) ? m.sets : [],
      events: Array.isArray(m.events) ? m.events : [],
    }));

  const normalizeRounds = (
    rounds: NonNullable<Tournament['bracket']>['winnersRounds'] | undefined,
  ) =>
    (Array.isArray(rounds) ? rounds : []).map((r) => ({
      ...r,
      matches: normalizeMatches(r.matches),
    }));

  const normalized: Tournament = {
    ...raw,
    sport: {
      ...raw.sport,
      extraStatsEnabled: Array.isArray(raw.sport?.extraStatsEnabled)
        ? raw.sport.extraStatsEnabled
        : [],
    },
    teams: (Array.isArray(raw.teams) ? raw.teams : []).map((t) => ({
      ...t,
      players: Array.isArray(t.players) ? t.players : [],
    })),
    bracket: raw.bracket
      ? {
        ...raw.bracket,
        winnersRounds: normalizeRounds(raw.bracket.winnersRounds),
        losersRounds: normalizeRounds(raw.bracket.losersRounds),
        finalsRounds: normalizeRounds(raw.bracket.finalsRounds),
        losersAdvancingPool: Array.isArray(raw.bracket.losersAdvancingPool)
          ? raw.bracket.losersAdvancingPool
          : [],
        losersStagingPool: Array.isArray(raw.bracket.losersStagingPool)
          ? raw.bracket.losersStagingPool
          : [],
        byeHistoryTeamIds: Array.isArray(raw.bracket.byeHistoryTeamIds)
          ? raw.bracket.byeHistoryTeamIds
          : [],
        eliminated: Array.isArray(raw.bracket.eliminated) ? raw.bracket.eliminated : [],
      }
      : undefined,
    kingOfCourt: raw.kingOfCourt
      ? {
        ...raw.kingOfCourt,
        courtTeamAId: raw.kingOfCourt.courtTeamAId ?? null,
        courtTeamBId: raw.kingOfCourt.courtTeamBId ?? null,
        currentMatchId: raw.kingOfCourt.currentMatchId ?? null,
        currentKingTeamId: raw.kingOfCourt.currentKingTeamId ?? null,
        queue: Array.isArray(raw.kingOfCourt.queue) ? raw.kingOfCourt.queue : [],
        matches: normalizeMatches(raw.kingOfCourt.matches),
        bestStreakByTeam: raw.kingOfCourt.bestStreakByTeam ?? {},
      }
      : undefined,
  };

  return stripSensitiveFields(normalized);
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
      return normalizeTournamentData(JSON.parse(decompressed) as Tournament);
    }

    const base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    return normalizeTournamentData(JSON.parse(json) as Tournament);
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

export function buildShareTournamentUrl(
  tournament: Tournament,
  baseOrigin?: string,
): string {
  const origin =
    baseOrigin ??
    (typeof window !== 'undefined' ? window.location.href : 'https://arenapro.local/');
  const url = new URL(origin);
  const cleanedPath = url.pathname.replace(/\/acompanhar\/[^/]+\/?$/, '/');
  url.pathname = cleanedPath || '/';
  url.search = '';
  url.hash = '';
  url.searchParams.set('compartilhar', tournament.id);
  if (tournament.publicToken) {
    url.searchParams.set('token', tournament.publicToken);
  }

  const snap = encodeSnapshot(tournament);
  if (snap) {
    url.hash = `d=${snap}`;
  }
  return url.toString();
}

export function buildPublicWatchUrl(tournament: Tournament, baseOrigin?: string): string {
  const origin =
    baseOrigin ??
    (typeof window !== 'undefined' ? window.location.href : 'https://arenapro.local/');
  const url = new URL(origin);
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

function getFirebaseTournamentEndpoint(tournamentId: string): string | null {
  const baseUrl = getFirebaseDatabaseUrl();
  if (!baseUrl) return null;
  const safeId = encodeURIComponent(tournamentId.replace(/[.#$[\]/]/g, '_'));
  return `${baseUrl}/tournaments/${safeId}.json`;
}

export async function publishTournamentLive(tournament: Tournament): Promise<void> {
  const isFinished =
    tournament.status === 'finished' || tournament.publicStatus === 'encerrado';
  const updatedTournament: Tournament = stripSensitiveFields({
    ...tournament,
    publicStatus: isFinished ? 'encerrado' : 'ativo',
  });

  // 1. Broadcast local para abas no mesmo aparelho
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    try {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.postMessage({ type: 'TOURNAMENT_SYNC', tournament: updatedTournament });
      ch.close();
    } catch {
      // Ignore
    }
  }

  // 2. Se o banco SQL (Supabase) estiver configurado, salva na tabela public.tournaments
  if (isSupabaseConfigured()) {
    try {
      const baseUrl = supabaseConfig.url.replace(/\/+$/, '');
      await fetch(`${baseUrl}/rest/v1/tournaments?on_conflict=id`, {
        method: 'POST',
        headers: {
          apikey: supabaseConfig.anonKey,
          Authorization: `Bearer ${supabaseConfig.anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          id: tournament.id,
          public_token: tournament.publicToken ?? null,
          public_status: updatedTournament.publicStatus,
          data: updatedTournament,
          updated_at: new Date().toISOString(),
        }),
      });
    } catch {
      // Ignora falhas temporárias de rede
    }
  }

  // 3. Se o Firebase Realtime Database estiver configurado, salva no endpoint REST
  if (isFirebaseConfigured()) {
    const fbEndpoint = getFirebaseTournamentEndpoint(tournament.id);
    if (fbEndpoint) {
      try {
        await fetch(fbEndpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedTournament),
        });
      } catch {
        // Ignora
      }
    }
  }

  // 4. Sempre envia também ao relay público leve para garantir sincronização entre celulares
  try {
    const topic = getRelayTopic(tournament.id);
    const compressed = encodeSnapshot(updatedTournament);
    if (compressed) {
      await fetch(`${RELAY_BASE_URL}/${topic}`, {
        method: 'POST',
        body: JSON.stringify({
          z: compressed,
          ts: updatedTournament.updatedAt ?? Date.now(),
        }),
        headers: {
          Title: 'ArenaPro Live Update',
          Priority: 'default',
        },
      });
    }
  } catch {
    // Ignora
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
    const normalized = normalizeTournamentData(t);
    if (!normalized) return null;
    if (normalized.id !== tournamentId) return null;
    if (token && normalized.publicToken && normalized.publicToken !== token) return null;
    return normalized;
  };

  const applyCandidate = (candidate: Tournament | null): boolean => {
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

  // 1. Carrega imediatamente do snapshot da URL e do localStorage local
  applyCandidate(decodeSnapshotFromHash());
  applyCandidate(readPublicTournamentFromStorage(tournamentId, token));

  // 2. Busca no banco SQL (Supabase) se estiver configurado
  const pollSupabase = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const baseUrl = supabaseConfig.url.replace(/\/+$/, '');
      const res = await fetch(
        `${baseUrl}/rest/v1/tournaments?id=eq.${tournamentId}&select=id,public_token,public_status,data`,
        {
          headers: {
            apikey: supabaseConfig.anonKey,
            Authorization: `Bearer ${supabaseConfig.anonKey}`,
          },
          cache: 'no-store',
        },
      );
      if (cancelled || !res.ok) return;
      const rows = (await res.json()) as Array<{ data?: Tournament }>;
      if (rows?.[0]?.data) {
        applyCandidate(rows[0].data);
      }
    } catch {
      // Ignora erro de rede temporário
    }
  };

  // 3. Busca no Firebase se estiver configurado
  const fbEndpoint = getFirebaseTournamentEndpoint(tournamentId);
  const pollFirebase = async () => {
    if (!fbEndpoint) return;
    try {
      const res = await fetch(fbEndpoint, { cache: 'no-store' });
      if (cancelled || !res.ok) return;
      const data = (await res.json()) as Tournament | null;
      if (data) applyCandidate(data);
    } catch {
      // Ignora
    }
  };

  // 4. Busca no relay público de alta velocidade
  const topic = getRelayTopic(tournamentId);
  const pollRelay = async () => {
    try {
      const res = await fetch(`${RELAY_BASE_URL}/${topic}/json?poll=1`, {
        cache: 'no-store',
      });
      if (cancelled || !res.ok) return;
      const text = await res.text();
      const lines = text.trim().split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        const remoteTournament = extractRelayTournament(lines[i]);
        if (applyCandidate(remoteTournament)) return;
      }
    } catch {
      // Ignora
    }
    if (!cancelled && !bestTournament) {
      onUpdate(null);
    }
  };

  void pollSupabase();
  void pollFirebase();
  void pollRelay();

  // 5. Streams em tempo real (SSE) do Relay e Firebase
  let relayEventSource: EventSource | null = null;
  if (typeof EventSource !== 'undefined') {
    try {
      relayEventSource = new EventSource(`${RELAY_BASE_URL}/${topic}/sse`);
      relayEventSource.onmessage = (event) => {
        if (cancelled) return;
        const remote = extractRelayTournament(event.data);
        applyCandidate(remote);
      };
    } catch {
      relayEventSource = null;
    }
  }

  let fbEventSource: EventSource | null = null;
  if (fbEndpoint && typeof EventSource !== 'undefined') {
    try {
      fbEventSource = new EventSource(fbEndpoint);
      fbEventSource.addEventListener('put', (event: MessageEvent) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse(event.data) as { path?: string; data?: Tournament };
          if (payload?.path === '/' && payload.data) {
            applyCandidate(payload.data);
          } else if (payload?.path && payload.path !== '/') {
            void pollFirebase();
          }
        } catch {
          // Ignora
        }
      });
    } catch {
      fbEventSource = null;
    }
  }

  // 6. BroadcastChannel para comunicação local
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

  // Polling leve a cada 5s para manter atualizado
  const pollTimer =
    typeof window !== 'undefined'
      ? window.setInterval(() => {
        if (!cancelled) {
          void pollSupabase();
          void pollFirebase();
          void pollRelay();
        }
      }, 5000)
      : undefined;

  return () => {
    cancelled = true;
    if (pollTimer !== undefined) window.clearInterval(pollTimer);
    if (relayEventSource) relayEventSource.close();
    if (fbEventSource) fbEventSource.close();
    if (ch) ch.close();
  };
}
