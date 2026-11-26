import type { PublicLinkStatus, Tournament } from '../types/tournament';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function isCloudSyncEnabled(): boolean {
  return Boolean(SUPABASE_URL?.trim() && SUPABASE_ANON_KEY?.trim());
}

function getHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY ?? '',
    Authorization: `Bearer ${SUPABASE_ANON_KEY ?? ''}`,
    'Content-Type': 'application/json',
  };
}

export async function upsertTournamentToCloud(tournament: Tournament): Promise<void> {
  if (!isCloudSyncEnabled()) return;
  const baseUrl = SUPABASE_URL!.replace(/\/+$/, '');
  const publicStatus: PublicLinkStatus =
    tournament.status === 'finished' || tournament.publicStatus === 'encerrado'
      ? 'encerrado'
      : 'ativo';

  try {
    await fetch(`${baseUrl}/rest/v1/tournaments?on_conflict=id`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: tournament.id,
        public_token: tournament.publicToken ?? null,
        public_status: publicStatus,
        data: { ...tournament, publicStatus },
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {
    // Offline or network error: localStorage remains authoritative locally
  }
}

export async function fetchTournamentFromCloud(
  tournamentId: string,
  token?: string | null,
): Promise<Tournament | null> {
  if (!isCloudSyncEnabled()) return null;
  const baseUrl = SUPABASE_URL!.replace(/\/+$/, '');
  const params = new URLSearchParams({
    id: `eq.${tournamentId}`,
    select: 'id,public_token,public_status,data',
  });

  try {
    const res = await fetch(`${baseUrl}/rest/v1/tournaments?${params.toString()}`, {
      method: 'GET',
      headers: getHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      id: string;
      public_token: string | null;
      public_status: PublicLinkStatus | null;
      data: Tournament;
    }>;
    const row = rows[0];
    if (!row || !row.data) return null;
    if (token && row.public_token && row.public_token !== token) return null;
    return {
      ...row.data,
      publicStatus: row.public_status ?? row.data.publicStatus,
    };
  } catch {
    return null;
  }
}
