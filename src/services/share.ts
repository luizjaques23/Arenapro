import { getSportDisplayName } from '../engine/sports';
import { computeStandings, computeTopScorers } from '../engine/tournamentEngine';
import type { Tournament } from '../types/tournament';

export function buildWhatsappSummary(tournament: Tournament): string {
  const standings = computeStandings(tournament);
  const scorers = computeTopScorers(tournament);
  const sportName = getSportDisplayName(tournament.sport);
  const formatLabel =
    tournament.format === 'king_of_court'
      ? 'Rei da Quadra'
      : 'Chaveamento (Vencedores x Perdedores)';
  const dateStr = new Date(tournament.finishedAt ?? tournament.createdAt).toLocaleDateString(
    'pt-BR',
  );

  const lines: string[] = [
    `🏆 *${tournament.name}*`,
    `⚽ Modalidade: ${sportName} • ${formatLabel}`,
    `📅 Data: ${dateStr}`,
    '',
  ];

  const champion = standings.find((s) => s.team.id === tournament.championId) ?? standings[0];
  if (champion) {
    lines.push(`🥇 *CAMPEÃO:* ${champion.team.emblem} ${champion.team.name}`);
    if (champion.team.players.length > 0) {
      lines.push(`   (${champion.team.players.map((p) => p.name).join(' / ')})`);
    }
  }

  const runnerUp =
    standings.find((s) => s.team.id === tournament.runnerUpId) ?? standings[1];
  if (runnerUp && runnerUp.team.id !== champion?.team.id) {
    lines.push(`🥈 *2º Lugar:* ${runnerUp.team.emblem} ${runnerUp.team.name}`);
  }

  if (standings[2]) {
    lines.push(`🥉 *3º Lugar:* ${standings[2].team.emblem} ${standings[2].team.name}`);
  }
  if (tournament.fourthPlaceId && standings[3]) {
    lines.push(`🏅 *4º Lugar:* ${standings[3].team.emblem} ${standings[3].team.name}`);
  }

  if (tournament.sport.trackPlayerGoals && scorers.length > 0) {
    lines.push('');
    lines.push(
      `👟 *Artilheiro:* ${scorers[0].player.name} (${scorers[0].team.name}) — ${scorers[0].goals} gol(s)`,
    );
  }

  lines.push('');
  lines.push('📊 *Classificação Geral:*');
  standings.slice(0, 8).forEach((s) => {
    lines.push(`${s.rank}º ${s.team.name} — ${s.wins}V / ${s.losses}D`);
  });

  return lines.join('\n');
}

export async function shareTournamentSummary(
  tournament: Tournament,
): Promise<'shared' | 'copied'> {
  const text = buildWhatsappSummary(tournament);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: tournament.name,
        text,
      });
      return 'shared';
    } catch {
      // Fall through to clipboard
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return 'copied';
  }

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  return 'copied';
}
