import { jsPDF } from 'jspdf';
import { getSportDisplayName } from '../engine/sports';
import { computeStandings, computeTopScorers } from '../engine/tournamentEngine';
import type { Match, Team, Tournament } from '../types/tournament';
import { formatDateForFilename, slugifyFilename } from './storage';

function drawEmblemLogo(doc: jsPDF, cx: number, cy: number, r: number): void {
  doc.setFillColor(16, 185, 129); // Emerald
  doc.circle(cx, cy, r, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.7);
  doc.circle(cx, cy, r * 0.78, 'S');
  // Stylized futevolei ball pentagon/arcs
  doc.line(cx - r * 0.7, cy, cx + r * 0.7, cy);
  doc.line(cx, cy - r * 0.7, cx, cy + r * 0.7);
  doc.setFillColor(245, 158, 11); // Amber accent
  doc.circle(cx, cy, r * 0.25, 'F');
}

function getTeamName(teams: Team[], teamId: string | null | undefined): string {
  if (!teamId) return 'BYE';
  return teams.find((t) => t.id === teamId)?.name ?? 'Time';
}

function formatMatchScore(match: Match, scoringMode: 'sets' | 'goals'): string {
  if (match.isBye) return 'BYE (Avanço automático)';
  if (match.status !== 'finished') return 'Pendente';
  if (scoringMode === 'sets' && match.sets.length > 0) {
    const setsText = match.sets.map((s) => `${s.scoreA}x${s.scoreB}`).join(' | ');
    return `${match.scoreA} x ${match.scoreB} (${setsText})`;
  }
  return `${match.scoreA} x ${match.scoreB}`;
}

export function generateTournamentPdf(tournament: Tournament): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 18) {
      doc.addPage();
      y = 18;
    }
  };

  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F');
  drawEmblemLogo(doc, margin + 12, y + 14, 7.5);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(tournament.name.slice(0, 48), margin + 24, y + 11.5);

  const sportName = getSportDisplayName(tournament.sport);
  const formatName =
    tournament.format === 'king_of_court'
      ? 'Rei da Quadra'
      : 'Chaveamento (Vencedores x Perdedores)';
  const dateStr = new Date(tournament.finishedAt ?? tournament.createdAt).toLocaleDateString(
    'pt-BR',
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`${sportName}  •  ${formatName}  •  ${dateStr}`, margin + 24, y + 19.5);

  doc.setFontSize(8);
  doc.setTextColor(52, 211, 153);
  doc.text('ARENA PRO TORNEIOS', pageWidth - margin - 4, y + 19.5, { align: 'right' });

  y += 35;

  const standings = computeStandings(tournament);
  const champion = standings.find((s) => s.team.id === tournament.championId) ?? standings[0];

  // Champion Highlight Box
  if (champion) {
    ensureSpace(34);
    doc.setFillColor(254, 243, 199); // Amber 100
    doc.setDrawColor(245, 158, 11); // Amber 500
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, y, contentWidth, 30, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9);
    doc.text('CAMPEÃO DO TORNEIO', pageWidth / 2, y + 8, { align: 'center' });

    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    doc.text(champion.team.name, pageWidth / 2, y + 18, { align: 'center' });

    if (champion.team.players.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(
        champion.team.players.map((p) => p.name).join('  •  '),
        pageWidth / 2,
        y + 25,
        { align: 'center' },
      );
    }

    y += 37;
  }

  // Top Scorer (Artilheiro) if applicable
  const scorers = computeTopScorers(tournament);
  if (tournament.sport.trackPlayerGoals && scorers.length > 0) {
    ensureSpace(26);
    doc.setFillColor(236, 253, 245); // Emerald 50
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(margin, y, contentWidth, 20, 2.5, 2.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(4, 120, 87);
    doc.text('ARTILHEIRO DO CAMPEONATO', margin + 5, y + 7);

    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `${scorers[0].player.name} (${scorers[0].team.name}) — ${scorers[0].goals} gol(s)`,
      margin + 5,
      y + 14.5,
    );
    y += 26;
  }

  // Standings Table
  ensureSpace(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Classificação Geral', margin, y);
  y += 5;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('#', margin + 3, y + 4.8);
  doc.text('Time / Dupla', margin + 12, y + 4.8);
  doc.text('J', margin + 106, y + 4.8, { align: 'right' });
  doc.text('V', margin + 120, y + 4.8, { align: 'right' });
  doc.text('D', margin + 134, y + 4.8, { align: 'right' });
  doc.text('Saldo', margin + 154, y + 4.8, { align: 'right' });
  doc.text('Situação', pageWidth - margin - 3, y + 4.8, { align: 'right' });
  y += 8;

  doc.setFont('helvetica', 'normal');
  for (const row of standings) {
    ensureSpace(8);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.text(`${row.rank}º`, margin + 3, y + 4.5);
    doc.text(row.team.name.slice(0, 38), margin + 12, y + 4.5);
    doc.text(String(row.played), margin + 106, y + 4.5, { align: 'right' });
    doc.text(String(row.wins), margin + 120, y + 4.5, { align: 'right' });
    doc.text(String(row.losses), margin + 134, y + 4.5, { align: 'right' });
    const diffStr = row.pointDiff > 0 ? `+${row.pointDiff}` : String(row.pointDiff);
    doc.text(diffStr, margin + 154, y + 4.5, { align: 'right' });
    doc.setTextColor(100, 116, 139);
    doc.text(row.statusLabel, pageWidth - margin - 3, y + 4.5, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 6.5, pageWidth - margin, y + 6.5);
    y += 7;
  }

  y += 6;

  // Bracket / Matches Section
  const printMatchList = (title: string, matches: Match[], accentRgb: [number, number, number]) => {
    if (matches.length === 0) return;
    ensureSpace(16);
    doc.setFillColor(...accentRgb);
    doc.rect(margin, y, 2.5, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(title, margin + 5, y + 4.8);
    y += 8.5;

    for (const m of matches) {
      ensureSpace(8);
      const nameA = m.teamAId
        ? getTeamName(tournament.teams, m.teamAId)
        : (m.slotALabel ?? 'A definir');
      const nameB = m.isBye
        ? 'BYE'
        : m.teamBId
          ? getTeamName(tournament.teams, m.teamBId)
          : (m.slotBLabel ?? 'A definir');
      const scoreText = formatMatchScore(m, tournament.sport.scoringMode);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(51, 65, 85);
      const stagePrefix = m.stageLabel ? ` (${m.stageLabel})` : '';
      const label = m.isBye
        ? `Jogo ${m.matchNumber}${stagePrefix}: ${nameA} — Avanço automático (BYE)`
        : `Jogo ${m.matchNumber}${stagePrefix}: ${nameA}  vs  ${nameB}`;
      doc.text(label.slice(0, 66), margin + 4, y + 4);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(scoreText, pageWidth - margin - 2, y + 4, { align: 'right' });

      doc.setDrawColor(241, 245, 249);
      doc.line(margin + 2, y + 5.8, pageWidth - margin, y + 5.8);
      y += 6.5;
    }
    y += 4;
  };

  if (tournament.format === 'bracket' && tournament.bracket) {
    for (const r of tournament.bracket.winnersRounds) {
      printMatchList(`1. Chave dos Vencedores — ${r.name}`, r.matches, [16, 185, 129]);
    }
    for (const r of tournament.bracket.losersRounds) {
      printMatchList(`2. Chave da Repescagem — ${r.name}`, r.matches, [245, 158, 11]);
    }
    for (const r of tournament.bracket.finalsRounds ?? []) {
      printMatchList(`3. Fase Final — ${r.name}`, r.matches, [14, 165, 233]);
    }
  } else if (tournament.kingOfCourt) {
    printMatchList(
      'Histórico de Partidas — Rei da Quadra',
      tournament.kingOfCourt.matches.filter((m) => m.status === 'finished'),
      [14, 165, 233],
    );
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Gerado offline por ArenaPro Torneios • Página ${p} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' },
    );
  }

  const filename = `${slugifyFilename(tournament.name)}-${formatDateForFilename(
    tournament.finishedAt ?? tournament.createdAt,
  )}.pdf`;
  doc.save(filename);
  return filename;
}
