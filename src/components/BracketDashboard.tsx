import {
  CheckCircle2,
  Crown,
  Download,
  Flag,
  Play,
  RotateCcw,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { getSportDisplayName } from '../engine/sports';
import type { BracketRound, Match, Team, Tournament } from '../types/tournament';

interface BracketDashboardProps {
  tournament: Tournament;
  onOpenMatch: (matchId: string) => void;
  onFinishManually: () => void;
  onOpenResults: () => void;
  onExportJson: () => void;
  onOpenReset: () => void;
}

function getTeam(teams: Team[], id: string | null | undefined): Team | undefined {
  if (!id) return undefined;
  return teams.find((t) => t.id === id);
}

function MatchCard({
  match,
  teams,
  scoringMode,
  onOpenMatch,
}: {
  match: Match;
  teams: Team[];
  scoringMode: 'sets' | 'goals';
  onOpenMatch: (id: string) => void;
}) {
  const teamA = getTeam(teams, match.teamAId);
  const teamB = getTeam(teams, match.teamBId);
  const isFinished = match.status === 'finished';
  const isWinners = match.side === 'winners';

  if (match.isBye) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/60 p-3.5 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
          <span>Jogo {match.matchNumber}</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            BYE
          </span>
        </div>
        <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-200">
          <span>{teamA?.emblem}</span>
          <span className="truncate">{teamA?.name ?? 'Time'}</span>
          <span className="ml-auto text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            Avança direto
          </span>
        </div>
      </div>
    );
  }

  const borderAccent = isWinners
    ? 'border-emerald-300 dark:border-emerald-800/80'
    : 'border-amber-300 dark:border-amber-800/80';

  const scoreTextA =
    scoringMode === 'sets' && match.sets.length === 1 && !isFinished
      ? match.sets[0].scoreA
      : match.scoreA;
  const scoreTextB =
    scoringMode === 'sets' && match.sets.length === 1 && !isFinished
      ? match.sets[0].scoreB
      : match.scoreB;

  return (
    <button
      type="button"
      onClick={() => !isFinished && onOpenMatch(match.id)}
      disabled={isFinished}
      className={`w-full text-left rounded-2xl border-2 ${borderAccent} bg-white dark:bg-slate-900 p-3.5 shadow-sm transition ${
        isFinished
          ? 'opacity-90 cursor-default'
          : 'hover:border-slate-900 dark:hover:border-white active:scale-[0.98] cursor-pointer'
      }`}
    >
      <div className="flex items-center justify-between text-[11px] font-bold mb-2">
        <span className="text-slate-400">Jogo {match.matchNumber}</span>
        {isFinished ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Encerrado
          </span>
        ) : (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
              match.status === 'live'
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            {match.status === 'live' ? 'Ao vivo' : 'Jogar'}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {[
          { team: teamA, score: scoreTextA, id: match.teamAId },
          { team: teamB, score: scoreTextB, id: match.teamBId },
        ].map((row, idx) => {
          const isWinner = isFinished && match.winnerId === row.id;
          return (
            <div
              key={idx}
              className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl ${
                isWinner
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 font-extrabold'
                  : 'bg-slate-50 dark:bg-slate-800/50 font-semibold'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: row.team?.color ?? '#94a3b8' }}
                />
                <span className="text-sm">{row.team?.emblem}</span>
                <span className="text-sm text-slate-900 dark:text-white truncate">
                  {row.team?.name ?? 'A definir'}
                </span>
              </div>
              <span className="font-score text-xl font-extrabold text-slate-900 dark:text-white shrink-0">
                {isFinished || match.status === 'live' ? row.score : '-'}
              </span>
            </div>
          );
        })}
      </div>

      {scoringMode === 'sets' && isFinished && match.sets.length > 0 && (
        <p className="text-[11px] font-semibold text-slate-400 mt-2 text-right">
          Sets: {match.sets.map((s) => `${s.scoreA}x${s.scoreB}`).join(' • ')}
        </p>
      )}
    </button>
  );
}

function BracketSection({
  title,
  badgeClass,
  rounds,
  teams,
  scoringMode,
  emptyNote,
  onOpenMatch,
}: {
  title: string;
  badgeClass: string;
  rounds: BracketRound[];
  teams: Team[];
  scoringMode: 'sets' | 'goals';
  emptyNote?: string;
  onOpenMatch: (id: string) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${badgeClass}`}>
          {title}
        </span>
      </div>

      {rounds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-amber-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-5 text-xs font-medium text-slate-500 dark:text-slate-400">
          {emptyNote}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-3 snap-x">
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
                    onOpenMatch={onOpenMatch}
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
  onOpenMatch,
  onFinishManually,
  onOpenResults,
  onExportJson,
  onOpenReset,
}: BracketDashboardProps) {
  const [filter, setFilter] = useState<'all' | 'winners' | 'losers'>('all');
  const sportName = getSportDisplayName(tournament.sport);

  const bracket = tournament.bracket;
  const koc = tournament.kingOfCourt;

  const winnersChamp = bracket?.winnersChampionId
    ? getTeam(tournament.teams, bracket.winnersChampionId)
    : undefined;

  return (
    <main className="max-w-5xl mx-auto px-4 py-5 pb-28 space-y-5">
      {/* Top Info + Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
          {sportName} • {tournament.teams.length} times •{' '}
          {tournament.format === 'king_of_court'
            ? 'Rei da Quadra'
            : 'Vencedores x Perdedores'}
        </div>
        <div className="flex items-center gap-2">
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
                Campeão: {getTeam(tournament.teams, tournament.championId)?.name ?? '-'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenResults}
            className="w-full sm:w-auto h-11 px-5 rounded-2xl bg-slate-950 text-white font-extrabold text-sm"
          >
            Ver Pódio e PDF
          </button>
        </div>
      )}

      {/* BRACKET MODE */}
      {tournament.format === 'bracket' && bracket && (
        <>
          {/* Winners champion crowned while Losers bracket still active */}
          {winnersChamp && tournament.status !== 'finished' && (
            <div className="rounded-3xl bg-emerald-600 text-white p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <Trophy className="w-7 h-7 text-amber-300 shrink-0" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-100">
                    Campeão da Chave de Vencedores
                  </p>
                  <p className="font-extrabold text-lg">
                    {winnersChamp.emblem} {winnersChamp.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onFinishManually}
                className="w-full sm:w-auto h-11 px-4 rounded-2xl bg-white text-emerald-900 font-extrabold text-xs flex items-center justify-center gap-1.5"
              >
                <Flag className="w-4 h-4" />
                Encerrar Torneio Agora
              </button>
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'Todas as Chaves' },
              { id: 'winners', label: 'Chave de Vencedores' },
              { id: 'losers', label: 'Outro Lado (Repescagem)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`h-10 px-4 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                  filter === tab.id
                    ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {(filter === 'all' || filter === 'winners') && (
            <BracketSection
              title="Chave de Vencedores (Quem ganha fica)"
              badgeClass="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
              rounds={bracket.winnersRounds}
              teams={tournament.teams}
              scoringMode={tournament.sport.scoringMode}
              onOpenMatch={onOpenMatch}
            />
          )}

          {(filter === 'all' || filter === 'losers') && (
            <BracketSection
              title="Chave de Baixo / Repescagem (Quem perde vai pro outro lado)"
              badgeClass="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
              rounds={bracket.losersRounds}
              teams={tournament.teams}
              scoringMode={tournament.sport.scoringMode}
              emptyNote="Os perdedores da 1ª rodada aparecerão aqui automaticamente assim que os primeiros jogos forem finalizados."
              onOpenMatch={onOpenMatch}
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
                      className={`rounded-2xl p-4 bg-white/5 border ${
                        isKing ? 'border-amber-400' : 'border-white/10'
                      }`}
                    >
                      <div className="text-3xl mb-1">{tm?.emblem ?? '⚽'}</div>
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
                <div className="font-score text-3xl font-extrabold text-amber-400">
                  VS
                </div>
                {[koc.courtTeamAId, koc.courtTeamBId].map((tid, idx) => {
                  const tm = getTeam(tournament.teams, tid);
                  const isKing = tid && koc.currentKingTeamId === tid;
                  return (
                    <div
                      key={idx}
                      className={`rounded-2xl p-4 bg-white/5 border ${
                        isKing ? 'border-amber-400' : 'border-white/10'
                      }`}
                    >
                      <div className="text-3xl mb-1">{tm?.emblem ?? '⚽'}</div>
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

              <button
                type="button"
                onClick={() => onOpenMatch(koc.currentMatchId!)}
                className="w-full h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.99] transition"
              >
                <Swords className="w-5 h-5" />
                Abrir Placar Ao Vivo
              </button>
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
                      <span className="text-amber-600 dark:text-amber-400">
                        {idx + 1}º
                      </span>
                      <span>{tm?.emblem}</span>
                      <span className="text-slate-900 dark:text-white">{tm?.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Finished matches history */}
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
                      onOpenMatch={onOpenMatch}
                    />
                  ))}
              </div>
            </section>
          )}

          {tournament.status !== 'finished' && (
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
    </main>
  );
}
