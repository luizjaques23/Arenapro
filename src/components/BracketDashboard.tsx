import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Download,
  Flag,
  ListOrdered,
  Pencil,
  Play,
  RotateCcw,
  Share2,
  Swords,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { getSportDisplayName } from '../engine/sports';
import { getAllMatches } from '../engine/tournamentEngine';
import { buildShareTournamentUrl } from '../services/liveSync';
import type { BracketRound, Match, Team, Tournament } from '../types/tournament';

interface BracketDashboardProps {
  tournament: Tournament;
  readOnly?: boolean;
  onOpenMatch: (matchId: string) => void;
  onSelectDirectWinner?: (matchId: string, winnerId: string) => void;
  onFinishManually: () => void;
  onOpenResults: () => void;
  onExportJson: () => void;
  onOpenReset: () => void;
  onEditTeams?: () => void;
  onDeleteTournament?: () => void;
}

function getTeam(teams: Team[], id: string | null | undefined): Team | undefined {
  if (!id) return undefined;
  return teams.find((t) => t.id === id);
}

const BLOCK_TITLES: Record<number, string> = {
  1: 'Bloco 1 — Rodada 1 Vencedores',
  2: 'Bloco 2 — Rodada 2 Vencedores + Repescagem R1',
  3: 'Bloco 3 — Repescagem R2 + Classificatórios Vencedores',
  4: 'Bloco 4 — Repescagem R3',
  5: 'Bloco 5 — Classificatórios da Repescagem',
  6: 'Bloco 6 — Semifinais (Fase Final)',
  7: 'Bloco 7 — Disputa de 3º/4º e Grande Final',
};

function MatchCard({
  match,
  teams,
  scoringMode,
  isFutevolei,
  readOnly,
  onSelectMatch,
}: {
  match: Match;
  teams: Team[];
  scoringMode: 'sets' | 'goals';
  isFutevolei: boolean;
  readOnly?: boolean;
  onSelectMatch: (match: Match) => void;
}) {
  const teamA = getTeam(teams, match.teamAId);
  const teamB = getTeam(teams, match.teamBId);
  const isFinished = match.status === 'finished';
  const isReadyToPlay =
    !readOnly && Boolean(match.teamAId && match.teamBId) && !isFinished;

  if (match.isBye) {
    const byeWinner = teamA ?? teamB;
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 p-3.5 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
          <span>
            Jogo {match.matchNumber}
            {match.stageLabel ? ` • ${match.stageLabel}` : ''}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            BYE
          </span>
        </div>
        <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-200">
          {!isFutevolei && <span>{byeWinner?.emblem ?? '⏭️'}</span>}
          <span className="truncate">{byeWinner?.name ?? 'Passagem automática'}</span>
          <span className="ml-auto text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            Avança
          </span>
        </div>
      </div>
    );
  }

  const borderAccent =
    match.side === 'winners'
      ? 'border-emerald-300 dark:border-emerald-800/80'
      : match.side === 'finals'
        ? 'border-sky-400 dark:border-sky-700/80'
        : 'border-amber-300 dark:border-amber-800/80';

  const scoreTextA =
    scoringMode === 'sets' && match.sets.length === 1 && !isFinished
      ? match.sets[0].scoreA
      : match.scoreA;
  const scoreTextB =
    scoringMode === 'sets' && match.sets.length === 1 && !isFinished
      ? match.sets[0].scoreB
      : match.scoreB;

  const rows = [
    {
      team: teamA,
      id: match.teamAId,
      placeholder: match.slotALabel ?? 'A definir',
      isByeSlot: match.slotAIsBye,
      score: scoreTextA,
    },
    {
      team: teamB,
      id: match.teamBId,
      placeholder: match.slotBLabel ?? 'A definir',
      isByeSlot: match.slotBIsBye,
      score: scoreTextB,
    },
  ];

  return (
    <button
      type="button"
      onClick={() => isReadyToPlay && onSelectMatch(match)}
      disabled={!isReadyToPlay}
      className={`w-full text-left rounded-2xl border-2 ${borderAccent} bg-white/95 dark:bg-slate-900/95 p-3.5 shadow-sm transition ${isReadyToPlay
        ? 'hover:border-slate-900 dark:hover:border-white active:scale-[0.98] cursor-pointer'
        : 'opacity-90 cursor-default'
        }`}
    >
      <div className="flex items-center justify-between gap-2 text-[11px] font-bold mb-2">
        <span className="text-slate-500 dark:text-slate-400 truncate">
          Jogo {match.matchNumber}
          {match.stageLabel ? ` • ${match.stageLabel}` : ''}
        </span>
        {isFinished ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> Encerrado
          </span>
        ) : isReadyToPlay ? (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0 ${match.status === 'live'
              ? 'bg-rose-500 text-white animate-pulse'
              : 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950'
              }`}
          >
            <Play className="w-3 h-3 fill-current" />
            {isFutevolei
              ? 'Definir Vencedor'
              : match.status === 'live'
                ? 'Ao vivo'
                : 'Jogar'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
            <Clock className="w-3 h-3" />
            {readOnly && Boolean(match.teamAId && match.teamBId)
              ? 'Em breve'
              : 'Aguardando'}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {rows.map((row, idx) => {
          const isWinner = isFinished && Boolean(row.id) && match.winnerId === row.id;
          return (
            <div
              key={idx}
              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl ${isWinner
                ? 'bg-emerald-50 dark:bg-emerald-950/50 font-extrabold'
                : row.team
                  ? 'bg-slate-50 dark:bg-slate-800/60 font-semibold'
                  : 'bg-slate-50/70 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700/70 font-semibold'
                }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {row.team ? (
                  <>
                    {!isFutevolei && (
                      <>
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: row.team.color }}
                        />
                        <span className="text-sm">{row.team.emblem}</span>
                      </>
                    )}
                    <span className="text-sm text-slate-900 dark:text-white truncate">
                      {row.team.name}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-[10px] font-extrabold text-slate-700 dark:text-slate-200">
                      {row.isByeSlot ? 'BYE' : row.placeholder}
                    </span>
                    <span className="text-xs italic text-slate-400 truncate">
                      {row.isByeSlot ? 'Passagem automática' : 'Aguardando definição'}
                    </span>
                  </>
                )}
              </div>

              {isFutevolei ? (
                isWinner && (
                  <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 shrink-0">
                    Venceu
                  </span>
                )
              ) : (
                <span className="font-score text-xl font-extrabold text-slate-900 dark:text-white shrink-0">
                  {isFinished || match.status === 'live' ? row.score : '-'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!isFutevolei && scoringMode === 'sets' && isFinished && match.sets.length > 0 && (
        <p className="text-[11px] font-semibold text-slate-400 mt-2 text-right">
          Sets: {match.sets.map((s) => `${s.scoreA}x${s.scoreB}`).join(' • ')}
        </p>
      )}

      {!isFinished && (match.destWinnerLabel || match.destLoserLabel) && (
        <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-[10px] font-bold text-slate-400">
          <span className="text-emerald-600 dark:text-emerald-400 truncate">
            {match.destWinnerLabel}
          </span>
          <span className="text-amber-600 dark:text-amber-400 truncate">
            {match.destLoserLabel}
          </span>
        </div>
      )}
    </button>
  );
}

function BracketSection({
  title,
  subtitle,
  badgeClass,
  rounds,
  teams,
  scoringMode,
  isFutevolei,
  readOnly,
  reverseColumnsOnDesktop,
  emptyNote,
  onSelectMatch,
}: {
  title: string;
  subtitle?: string;
  badgeClass: string;
  rounds: BracketRound[];
  teams: Team[];
  scoringMode: 'sets' | 'goals';
  isFutevolei: boolean;
  readOnly?: boolean;
  reverseColumnsOnDesktop?: boolean;
  emptyNote?: string;
  onSelectMatch: (match: Match) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span
          className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${badgeClass}`}
        >
          {title}
        </span>
        {subtitle && (
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {subtitle}
          </span>
        )}
      </div>

      {rounds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-5 text-xs font-medium text-slate-500 dark:text-slate-400">
          {emptyNote}
        </div>
      ) : (
        <div
          className={`flex gap-4 overflow-x-auto pb-3 snap-x ${reverseColumnsOnDesktop ? 'lg:flex-row-reverse' : ''
            }`}
        >
          {rounds.map((round) => (
            <div
              key={`${round.side}_${round.roundIndex}`}
              className="min-w-[260px] sm:min-w-[280px] flex-1 space-y-2.5 snap-start"
            >
              <div className="px-2 flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  {round.name}
                </h3>
                <span className="text-[11px] font-bold text-slate-400">
                  {round.matches.filter((m) => m.status === 'finished').length}/
                  {round.matches.length}
                </span>
              </div>
              <div className="space-y-2.5">
                {round.matches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    teams={teams}
                    scoringMode={scoringMode}
                    isFutevolei={isFutevolei}
                    readOnly={readOnly}
                    onSelectMatch={onSelectMatch}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function BracketDashboard({
  tournament,
  readOnly = false,
  onOpenMatch,
  onSelectDirectWinner,
  onFinishManually,
  onOpenResults,
  onExportJson,
  onOpenReset,
  onEditTeams,
  onDeleteTournament,
}: BracketDashboardProps) {
  const [filter, setFilter] = useState<
    'all' | 'blocks' | 'winners' | 'losers' | 'finals'
  >('all');
  const [directPickMatch, setDirectPickMatch] = useState<Match | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const isFutevolei = tournament.sport.id === 'futevolei';
  const sportName = getSportDisplayName(tournament.sport);
  const shareUrl = !readOnly ? buildShareTournamentUrl(tournament) : '';

  const bracket = tournament.bracket;
  const koc = tournament.kingOfCourt;
  const finalsRounds = bracket?.finalsRounds ?? [];
  const allMatches = getAllMatches(tournament);
  const finishedMatchesCount = allMatches.filter((m) => m.status === 'finished').length;

  const blocksMap = new Map<number, Match[]>();
  for (const m of allMatches) {
    const b = m.blockNumber ?? 1;
    const list = blocksMap.get(b) ?? [];
    list.push(m);
    blocksMap.set(b, list);
  }
  const blockEntries = Array.from(blocksMap.entries()).sort((a, b) => a[0] - b[0]);

  const handleMatchAction = (match: Match) => {
    if (readOnly) return;
    if (isFutevolei) {
      setDirectPickMatch(match);
      return;
    }
    onOpenMatch(match.id);
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl) return;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: tournament.name,
            text: `Acompanhe o torneio ${tournament.name} (somente visualização):`,
            url: shareUrl,
          });
          return;
        } catch {
          // Fallback to clipboard copy
        }
      }
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const directTeamA = directPickMatch
    ? getTeam(tournament.teams, directPickMatch.teamAId)
    : undefined;
  const directTeamB = directPickMatch
    ? getTeam(tournament.teams, directPickMatch.teamBId)
    : undefined;

  return (
    <main className="max-w-6xl mx-auto px-4 py-5 pb-28 space-y-5">
      {/* Exclusive Share Tournament Link Bar (read-only access without password) */}
      {shareUrl && (
        <section className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
                Compartilhar Torneio (link exclusivo • somente visualização)
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 truncate">
                {shareUrl}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedLink ? 'Copiado!' : 'Compartilhar'}
          </button>
        </section>
      )}

      {/* Top Info + Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
          {sportName} • {tournament.teams.length} participantes •{' '}
          {tournament.format === 'king_of_court'
            ? 'Rei da Quadra'
            : `${finishedMatchesCount}/${allMatches.length} jogos concluídos`}
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            {onEditTeams && (
              <button
                type="button"
                onClick={onEditTeams}
                className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm active:scale-95 transition"
              >
                <Pencil className="w-3.5 h-3.5" />
                EDITAR
              </button>
            )}
            {onDeleteTournament && (
              <button
                type="button"
                onClick={onDeleteTournament}
                aria-label="Excluir torneio"
                title="Excluir torneio"
                className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onExportJson}
              className="h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
            >
              <Download className="w-3.5 h-3.5" />
              Backup JSON
            </button>
            <button
              type="button"
              onClick={onOpenReset}
              className="h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 text-xs font-bold flex items-center gap-1.5 text-rose-600 dark:text-rose-400"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reiniciar
            </button>
          </div>
        )}
      </div>

      {/* Finished Banner */}
      {tournament.status === 'finished' && (
        <div className="rounded-3xl bg-gradient-to-r from-amber-500 to-emerald-500 p-4 sm:p-5 text-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 shrink-0" />
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider">
                Torneio Finalizado!
              </p>
              <p className="font-extrabold text-lg">
                1º Campeão: {getTeam(tournament.teams, tournament.championId)?.name ?? '-'}
                {tournament.thirdPlaceId
                  ? ` • 3º: ${getTeam(tournament.teams, tournament.thirdPlaceId)?.name ?? '-'}`
                  : ''}
              </p>
            </div>
          </div>
          {!readOnly && (
            <button
              type="button"
              onClick={onOpenResults}
              className="w-full sm:w-auto h-11 px-5 rounded-2xl bg-slate-950 text-white font-extrabold text-sm"
            >
              Ver Pódio e PDF
            </button>
          )}
        </div>
      )}

      {/* BRACKET MODE */}
      {tournament.format === 'bracket' && bracket && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'Tabela Completa' },
              ...(bracket.isHybridGraph
                ? [{ id: 'blocks', label: 'Ordem Cronológica (Blocos)' }]
                : []),
              ...(bracket.winnersRounds.length > 0
                ? [{ id: 'winners', label: '1. Chave dos Vencedores' }]
                : []),
              ...(bracket.losersRounds.length > 0
                ? [{ id: 'losers', label: '2. Repescagem' }]
                : []),
              ...(finalsRounds.length > 0
                ? [{ id: 'finals', label: '3. Fase Final (Semis e Finais)' }]
                : []),
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`h-10 px-4 rounded-xl text-xs font-extrabold whitespace-nowrap flex items-center gap-1.5 transition ${filter === tab.id
                  ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
              >
                {tab.id === 'blocks' && <ListOrdered className="w-3.5 h-3.5" />}
                {tab.label}
              </button>
            ))}
          </div>

          {filter === 'blocks' && bracket.isHybridGraph && (
            <div className="space-y-5">
              {blockEntries.map(([blockNum, matches]) => (
                <section key={blockNum} className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-slate-900 dark:bg-slate-800 text-white">
                      {bracket.bracketSize === 16 && BLOCK_TITLES[blockNum]
                        ? BLOCK_TITLES[blockNum]
                        : `Bloco ${blockNum} — ${Array.from(
                          new Set(matches.map((m) => m.stageLabel).filter(Boolean)),
                        ).join(' + ')}`}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {matches.filter((m) => m.status === 'finished').length}/{matches.length}{' '}
                      concluídos
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {matches.map((m) => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        teams={tournament.teams}
                        scoringMode={tournament.sport.scoringMode}
                        isFutevolei={isFutevolei}
                        readOnly={readOnly}
                        onSelectMatch={handleMatchAction}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {(filter === 'all' || filter === 'winners') &&
            bracket.winnersRounds.length > 0 && (
              <BracketSection
                title="1. Chave dos Vencedores (Lado Esquerdo)"
                subtitle="1ª derrota transfere para a Repescagem"
                badgeClass="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                rounds={bracket.winnersRounds}
                teams={tournament.teams}
                scoringMode={tournament.sport.scoringMode}
                isFutevolei={isFutevolei}
                readOnly={readOnly}
                onSelectMatch={handleMatchAction}
              />
            )}

          {(filter === 'all' || filter === 'finals') && finalsRounds.length > 0 && (
            <BracketSection
              title="3. Fase Final — Semifinais, 3º/4º e Final (Centro)"
              subtitle="Eliminatória simples: define do 1º ao 4º lugar"
              badgeClass="bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800"
              rounds={finalsRounds}
              teams={tournament.teams}
              scoringMode={tournament.sport.scoringMode}
              isFutevolei={isFutevolei}
              readOnly={readOnly}
              onSelectMatch={handleMatchAction}
            />
          )}

          {(filter === 'all' || filter === 'losers') &&
            bracket.losersRounds.length > 0 && (
              <BracketSection
                title="2. Chave da Repescagem / Perdedores (Lado Direito)"
                subtitle="Cruzamento anti-revanche • Derrota elimina"
                badgeClass="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                rounds={bracket.losersRounds}
                teams={tournament.teams}
                scoringMode={tournament.sport.scoringMode}
                isFutevolei={isFutevolei}
                readOnly={readOnly}
                reverseColumnsOnDesktop={bracket.isHybridGraph}
                emptyNote="Os perdedores aparecerão aqui conforme os jogos da Chave dos Vencedores forem concluídos."
                onSelectMatch={handleMatchAction}
              />
            )}
        </>
      )}

      {/* KING OF THE COURT MODE */}
      {tournament.format === 'king_of_court' && koc && (
        <div className="space-y-5">
          {tournament.status !== 'finished' && koc.currentMatchId && (
            <section className="rounded-3xl bg-slate-900 text-white p-5 sm:p-6 border border-amber-500/40 shadow-xl space-y-5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-extrabold uppercase tracking-wider">
                  <Crown className="w-4 h-4" /> Em Quadra Agora • Jogo {koc.nextMatchNumber - 1}
                </span>
                {koc.currentKingTeamId && (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                    Rei atual: {getTeam(tournament.teams, koc.currentKingTeamId)?.name} (
                    {koc.currentStreak}x seguidas)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                {[koc.courtTeamAId, koc.courtTeamBId].map((tid, idx) => {
                  const tm = getTeam(tournament.teams, tid);
                  const isKing = tid && koc.currentKingTeamId === tid;
                  return (
                    <div
                      key={idx}
                      className={`rounded-2xl p-4 bg-white/5 border ${isKing ? 'border-amber-400' : 'border-white/10'
                        }`}
                    >
                      {!isFutevolei && <div className="text-3xl mb-1">{tm?.emblem ?? '⚽'}</div>}
                      <p className="font-extrabold text-base sm:text-lg truncate">
                        {tm?.name ?? 'Time'}
                      </p>
                      {isKing && (
                        <span className="inline-block mt-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                          👑 Rei da Quadra
                        </span>
                      )}
                    </div>
                  );
                })[0]}
                <div className="font-score text-3xl font-extrabold text-amber-400">VS</div>
                {[koc.courtTeamAId, koc.courtTeamBId].map((tid, idx) => {
                  const tm = getTeam(tournament.teams, tid);
                  const isKing = tid && koc.currentKingTeamId === tid;
                  return (
                    <div
                      key={idx}
                      className={`rounded-2xl p-4 bg-white/5 border ${isKing ? 'border-amber-400' : 'border-white/10'
                        }`}
                    >
                      {!isFutevolei && <div className="text-3xl mb-1">{tm?.emblem ?? '⚽'}</div>}
                      <p className="font-extrabold text-base sm:text-lg truncate">
                        {tm?.name ?? 'Time'}
                      </p>
                      {isKing && (
                        <span className="inline-block mt-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                          👑 Rei da Quadra
                        </span>
                      )}
                    </div>
                  );
                })[1]}
              </div>

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    const current = koc.matches.find((m) => m.id === koc.currentMatchId);
                    if (current) handleMatchAction(current);
                  }}
                  className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.99] transition"
                >
                  <Swords className="w-5 h-5" />
                  {isFutevolei ? 'Definir Vencedor da Quadra' : 'Abrir Placar Ao Vivo'}
                </button>
              )}
            </section>
          )}

          {/* Queue */}
          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Fila de Desafiantes ({koc.queue.length})
              </h3>
            </div>
            {koc.queue.length === 0 ? (
              <p className="text-xs text-slate-500">
                Sem times aguardando na fila (apenas 2 times em quadra).
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {koc.queue.map((tid, idx) => {
                  const tm = getTeam(tournament.teams, tid);
                  return (
                    <div
                      key={`${tid}_${idx}`}
                      className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 text-xs font-bold flex items-center gap-2"
                    >
                      <span className="text-amber-600 dark:text-amber-400">{idx + 1}º</span>
                      {!isFutevolei && <span>{tm?.emblem}</span>}
                      <span className="text-slate-900 dark:text-white">{tm?.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {koc.matches.filter((m) => m.status === 'finished').length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Partidas Realizadas
              </h3>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {koc.matches
                  .filter((m) => m.status === 'finished')
                  .slice()
                  .reverse()
                  .map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      teams={tournament.teams}
                      scoringMode={tournament.sport.scoringMode}
                      isFutevolei={isFutevolei}
                      readOnly={readOnly}
                      onSelectMatch={handleMatchAction}
                    />
                  ))}
              </div>
            </section>
          )}

          {!readOnly && tournament.status !== 'finished' && (
            <button
              type="button"
              onClick={onFinishManually}
              className="w-full h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg"
            >
              <Flag className="w-5 h-5" />
              Encerrar Rei da Quadra e Ver Campeão
            </button>
          )}
        </div>
      )}

      {/* Direct Winner Selection Modal for Futevôlei (no score inputs) */}
      {!readOnly && isFutevolei && directPickMatch && directTeamA && directTeamB && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Jogo {directPickMatch.matchNumber}
                  {directPickMatch.stageLabel ? ` • ${directPickMatch.stageLabel}` : ''}
                </p>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                  Quem venceu o confronto?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Toque na dupla vencedora para avançar automaticamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDirectPickMatch(null)}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {[directTeamA, directTeamB].map((tm) => (
                <button
                  key={tm.id}
                  type="button"
                  onClick={() => {
                    onSelectDirectWinner?.(directPickMatch.id, tm.id);
                    setDirectPickMatch(null);
                  }}
                  className="w-full min-h-[64px] px-5 py-3 rounded-2xl border-2 border-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/70 text-left flex items-center justify-between gap-3 active:scale-[0.98] transition"
                >
                  <div className="min-w-0">
                    <p className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                      {tm.name}
                    </p>
                    {tm.players.length > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {tm.players.map((p) => p.name).join(' • ')}
                      </p>
                    )}
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold shrink-0">
                    Venceu
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
