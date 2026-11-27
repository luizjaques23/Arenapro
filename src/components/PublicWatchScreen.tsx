import { Eye, Lock, Radio, Trophy, Users, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getSportDisplayName } from '../engine/sports';
import { computeStandings, computeTopScorers } from '../engine/tournamentEngine';
import { subscribePublicTournament } from '../services/liveSync';
import type { Tournament } from '../types/tournament';
import { BracketDashboard } from './BracketDashboard';

interface PublicWatchScreenProps {
  tournamentId: string;
  token: string | null;
}

export function PublicWatchScreen({ tournamentId, token }: PublicWatchScreenProps) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribePublicTournament(tournamentId, token, (data) => {
      setTournament(data);
      setLoaded(true);
    });
    return unsubscribe;
  }, [tournamentId, token]);

  if (!loaded) {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <Radio className="w-10 h-10 mx-auto text-emerald-500 animate-pulse" />
        <p className="font-bold text-slate-700 dark:text-slate-300">
          Carregando torneio compartilhado...
        </p>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="max-w-lg mx-auto px-4 py-16">
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3 shadow-lg">
          <WifiOff className="w-12 h-12 mx-auto text-amber-500" />
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Torneio não encontrado
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Não foi possível carregar as informações deste campeonato. Verifique se o link compartilhado está completo ou aguarde a conexão com a rede.
          </p>
        </div>
      </main>
    );
  }

  const isFutevolei = tournament.sport.id === 'futevolei';
  const sportName = getSportDisplayName(tournament.sport);
  const standings = computeStandings(tournament);
  const scorers = computeTopScorers(tournament);

  const champion =
    standings.find((s) => s.team.id === tournament.championId) ?? standings[0];
  const runnerUp =
    standings.find((s) => s.team.id === tournament.runnerUpId) ?? standings[1];
  const thirdPlace = tournament.thirdPlaceId
    ? standings.find((s) => s.team.id === tournament.thirdPlaceId)
    : undefined;

  const statusLabel =
    tournament.status === 'finished'
      ? 'Torneio Finalizado'
      : tournament.status === 'in_progress'
        ? 'Em Andamento'
        : 'Aguardando Início';

  return (
    <div className="space-y-4 pb-16">
      {/* Shared Read-Only Top Banner */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="rounded-2xl bg-emerald-600 text-white px-4 py-3 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <Eye className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-wider">
                {tournament.name} • {statusLabel}
              </p>
              <p className="text-[11px] text-emerald-100 truncate">
                {sportName} • Atualização automática • Acesso público sem senha
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-bold shrink-0">
            <Lock className="w-3 h-3" /> Somente visualização
          </span>
        </div>
      </div>

      {/* Podium Summary when Finished */}
      {tournament.status === 'finished' && champion && (
        <section className="max-w-6xl mx-auto px-4">
          <div className="rounded-3xl bg-slate-900 text-white border-2 border-amber-400/70 p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-amber-400">
                  Pódio Oficial
                </p>
                <h2 className="text-xl sm:text-2xl font-extrabold">
                  1º Campeão: {isFutevolei || !champion.team.emblem ? champion.team.name : `${champion.team.emblem} ${champion.team.name}`}
                </h2>
              </div>
            </div>
            {(runnerUp || thirdPlace) && (
              <div className="grid sm:grid-cols-2 gap-2.5 text-xs font-bold">
                {runnerUp && runnerUp.team.id !== champion.team.id && (
                  <div className="rounded-xl bg-white/10 px-3.5 py-2.5">
                    2º Vice-campeão: {runnerUp.team.name}
                  </div>
                )}
                {thirdPlace && (
                  <div className="rounded-xl bg-white/10 px-3.5 py-2.5">
                    3º Lugar: {thirdPlace.team.name}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Setup Phase: Registered Participants */}
      {tournament.status === 'setup' ? (
        <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 p-6 text-center space-y-2">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Aguardando início dos jogos
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              O organizador está cadastrando os participantes ({tournament.teams.length}{' '}
              inscritos). O chaveamento e os resultados aparecerão aqui automaticamente assim que iniciar.
            </p>
          </div>

          {tournament.teams.length > 0 && (
            <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Participantes Inscritos ({tournament.teams.length})
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {tournament.teams.map((tm, idx) => (
                  <div
                    key={tm.id}
                    className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2.5 flex items-center gap-2.5"
                  >
                    <span className="text-xs font-extrabold text-slate-400">{idx + 1}.</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {tm.name}
                      </p>
                      {tm.players.length > 0 && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {tm.players.map((p) => p.name).join(' • ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      ) : (
        <>
          {/* Full Read-Only Bracket & Matches */}
          <BracketDashboard
            tournament={tournament}
            readOnly
            onOpenMatch={() => { }}
            onFinishManually={() => { }}
            onOpenResults={() => { }}
            onExportJson={() => { }}
            onOpenReset={() => { }}
          />

          {/* General Standings (Classificação Geral) */}
          {standings.length > 0 && (
            <section className="max-w-6xl mx-auto px-4 space-y-4">
              <div className="rounded-3xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 p-5 space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Classificação Geral
                </h3>
                <div className="space-y-2">
                  {standings.map((row) => (
                    <div
                      key={row.team.id}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-score text-xl font-extrabold w-7 text-slate-500 shrink-0">
                          {row.rank}º
                        </span>
                        {!isFutevolei && row.team.emblem && (
                          <span className="shrink-0">{row.team.emblem}</span>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">
                            {row.team.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {row.statusLabel}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
                        <span>
                          {row.wins}V / {row.losses}D
                        </span>
                        {!isFutevolei && (
                          <span className="w-10 text-right">
                            {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {tournament.sport.trackPlayerGoals && scorers.length > 0 && (
                <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 p-5 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Artilharia
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {scorers.slice(0, 6).map((sc) => (
                      <div
                        key={sc.player.id}
                        className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-xl px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                            {sc.rank}º {sc.player.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{sc.team.name}</p>
                        </div>
                        <span className="font-score text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                          {sc.goals}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
