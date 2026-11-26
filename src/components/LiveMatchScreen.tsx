import {
  Check,
  Clock,
  Flag,
  Minus,
  Plus,
  Sparkles,
  Trophy,
  Volume2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createId } from '../engine/tournamentEngine';
import { soundEngine } from '../services/sound';
import type {
  Match,
  MatchStatEvent,
  SetScore,
  StatType,
  Team,
  Tournament,
} from '../types/tournament';

interface LiveMatchScreenProps {
  tournament: Tournament;
  match: Match;
  onUpdateLive: (updater: (m: Match) => Match) => void;
  onFinishMatch: (payload: {
    winnerId: string;
    scoreA: number;
    scoreB: number;
    sets: SetScore[];
    events: MatchStatEvent[];
  }) => void;
}

export function LiveMatchScreen({
  tournament,
  match,
  onUpdateLive,
  onFinishMatch,
}: LiveMatchScreenProps) {
  const teamA: Team | undefined = tournament.teams.find((t) => t.id === match.teamAId);
  const teamB: Team | undefined = tournament.teams.find((t) => t.id === match.teamBId);

  const [popSide, setPopSide] = useState<'A' | 'B' | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [pickWinnerModal, setPickWinnerModal] = useState(false);

  const isSetsMode = tournament.sport.scoringMode === 'sets';
  const currentSetIdx = match.currentSetIndex ?? 0;
  const sets =
    match.sets.length > 0 ? match.sets : [{ setNumber: 1, scoreA: 0, scoreB: 0 }];
  const currentSet = sets[currentSetIdx] ?? sets[0];

  useEffect(() => {
    const start = match.startedAt ?? Date.now();
    const tick = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [match.startedAt]);

  const formatTimer = (sec: number) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const triggerPop = (side: 'A' | 'B') => {
    setPopSide(side);
    window.setTimeout(() => setPopSide(null), 230);
  };

  const computeSetTotals = (allSets: SetScore[]) => {
    let winsA = 0;
    let winsB = 0;
    for (const s of allSets) {
      if (s.winnerId === match.teamAId) winsA += 1;
      else if (s.winnerId === match.teamBId) winsB += 1;
    }
    return { winsA, winsB };
  };

  const addPoint = (
    side: 'A' | 'B',
    delta: 1 | -1,
    playerId?: string,
    statType: StatType = tournament.sport.trackPlayerGoals ? 'goal' : 'point',
  ) => {
    const teamId = side === 'A' ? match.teamAId : match.teamBId;
    if (!teamId) return;

    if (delta > 0) {
      triggerPop(side);
      if (statType === 'goal') soundEngine.playGoal();
      else soundEngine.playPoint();
    }

    onUpdateLive((prev) => {
      const prevSets =
        prev.sets.length > 0 ? [...prev.sets] : [{ setNumber: 1, scoreA: 0, scoreB: 0 }];
      const idx = prev.currentSetIndex ?? 0;
      const targetSet = { ...(prevSets[idx] ?? prevSets[0]) };

      if (isSetsMode) {
        if (side === 'A') targetSet.scoreA = Math.max(0, targetSet.scoreA + delta);
        else targetSet.scoreB = Math.max(0, targetSet.scoreB + delta);
        prevSets[idx] = targetSet;
      }

      let nextScoreA = isSetsMode ? prev.scoreA : Math.max(0, prev.scoreA + (side === 'A' ? delta : 0));
      let nextScoreB = isSetsMode ? prev.scoreB : Math.max(0, prev.scoreB + (side === 'B' ? delta : 0));

      let nextEvents = [...prev.events];
      if (delta > 0 && (playerId || statType !== 'point')) {
        nextEvents.push({
          id: createId('ev'),
          teamId,
          playerId,
          type: statType,
          value: 1,
          setNumber: isSetsMode ? targetSet.setNumber : undefined,
          timestamp: Date.now(),
        });
      } else if (delta < 0) {
        // Undo last matching event if removing a goal/point
        const revIdx = [...nextEvents]
          .reverse()
          .findIndex((e) => e.teamId === teamId && (e.type === 'goal' || e.type === 'point'));
        if (revIdx !== -1) {
          const removeIndex = nextEvents.length - 1 - revIdx;
          nextEvents.splice(removeIndex, 1);
        }
      }

      if (isSetsMode) {
        const totals = computeSetTotals(prevSets);
        nextScoreA = totals.winsA;
        nextScoreB = totals.winsB;
      }

      return {
        ...prev,
        scoreA: nextScoreA,
        scoreB: nextScoreB,
        sets: prevSets,
        events: nextEvents,
      };
    });
  };

  const addExtraStat = (side: 'A' | 'B', type: StatType, playerId?: string) => {
    const teamId = side === 'A' ? match.teamAId : match.teamBId;
    if (!teamId) return;
    soundEngine.playPoint();
    onUpdateLive((prev) => ({
      ...prev,
      events: [
        ...prev.events,
        {
          id: createId('ev'),
          teamId,
          playerId,
          type,
          value: 1,
          timestamp: Date.now(),
        },
      ],
    }));
  };

  const closeCurrentSetAndAdvance = () => {
    if (!isSetsMode || !match.teamAId || !match.teamBId) return;
    if (currentSet.scoreA === currentSet.scoreB) return;

    const setWinnerId =
      currentSet.scoreA > currentSet.scoreB ? match.teamAId : match.teamBId;
    const updatedSets = sets.map((s, idx) =>
      idx === currentSetIdx ? { ...s, winnerId: setWinnerId } : s,
    );
    const { winsA, winsB } = computeSetTotals(updatedSets);

    if (winsA >= tournament.sport.setsToWin || winsB >= tournament.sport.setsToWin) {
      soundEngine.playWhistle();
      const matchWinner = winsA > winsB ? match.teamAId : match.teamBId;
      onFinishMatch({
        winnerId: matchWinner,
        scoreA: winsA,
        scoreB: winsB,
        sets: updatedSets,
        events: match.events,
      });
      return;
    }

    soundEngine.playWhistle();
    const nextSet: SetScore = {
      setNumber: updatedSets.length + 1,
      scoreA: 0,
      scoreB: 0,
    };
    onUpdateLive((prev) => ({
      ...prev,
      scoreA: winsA,
      scoreB: winsB,
      sets: [...updatedSets, nextSet],
      currentSetIndex: updatedSets.length,
    }));
  };

  const handleFinishButton = () => {
    if (!match.teamAId || !match.teamBId) return;

    if (isSetsMode) {
      // Auto-close current set if one team is leading in points
      const finalizedSets = sets.map((s, idx) => {
        if (idx === currentSetIdx && !s.winnerId && s.scoreA !== s.scoreB) {
          return {
            ...s,
            winnerId: s.scoreA > s.scoreB ? match.teamAId! : match.teamBId!,
          };
        }
        return s;
      });

      const { winsA, winsB } = computeSetTotals(finalizedSets);
      if (winsA !== winsB) {
        soundEngine.playWhistle();
        onFinishMatch({
          winnerId: winsA > winsB ? match.teamAId : match.teamBId,
          scoreA: winsA,
          scoreB: winsB,
          sets: finalizedSets,
          events: match.events,
        });
        return;
      }

      if (currentSet.scoreA !== currentSet.scoreB) {
        soundEngine.playWhistle();
        const winnerId =
          currentSet.scoreA > currentSet.scoreB ? match.teamAId : match.teamBId;
        onFinishMatch({
          winnerId,
          scoreA: winnerId === match.teamAId ? 1 : 0,
          scoreB: winnerId === match.teamBId ? 1 : 0,
          sets: finalizedSets,
          events: match.events,
        });
        return;
      }

      setPickWinnerModal(true);
      return;
    }

    // Goals mode
    if (match.scoreA !== match.scoreB) {
      soundEngine.playWhistle();
      onFinishMatch({
        winnerId: match.scoreA > match.scoreB ? match.teamAId : match.teamBId,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        sets: match.sets,
        events: match.events,
      });
      return;
    }

    setPickWinnerModal(true);
  };

  const displayA = isSetsMode ? currentSet.scoreA : match.scoreA;
  const displayB = isSetsMode ? currentSet.scoreB : match.scoreB;

  const targetPts = tournament.sport.pointsPerSet;
  const winBy2 = tournament.sport.winByTwo;
  const isSetPointReached =
    isSetsMode &&
    targetPts > 0 &&
    ((displayA >= targetPts && (!winBy2 || displayA - displayB >= 2)) ||
      (displayB >= targetPts && (!winBy2 || displayB - displayA >= 2)));

  return (
    <main className="max-w-3xl mx-auto px-4 py-4 pb-28 space-y-4">
      {/* Match Status Bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 text-xs font-extrabold">
            Jogo {match.matchNumber}
          </span>
          {isSetsMode && (
            <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
              Set {currentSet.setNumber}
              {tournament.sport.setsToWin > 1
                ? ` • Sets: ${match.scoreA} x ${match.scoreB}`
                : ` • Alvo: ${targetPts} pts`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
            <Clock className="w-3.5 h-3.5" />
            {formatTimer(elapsedSec)}
          </span>
          <button
            type="button"
            onClick={() => soundEngine.playWhistle()}
            title="Tocar apito"
            className="h-8 px-2.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1"
          >
            <Volume2 className="w-3.5 h-3.5" /> Apito
          </button>
        </div>
      </div>

      {/* Big Outdoor Scoreboard */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { side: 'A' as const, team: teamA, score: displayA },
          { side: 'B' as const, team: teamB, score: displayB },
        ].map(({ side, team, score }) => (
          <div
            key={side}
            className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 p-4 flex flex-col items-center text-center shadow-md relative overflow-hidden"
          >
            <div
              className="absolute top-0 inset-x-0 h-2"
              style={{ backgroundColor: team?.color ?? '#10b981' }}
            />
            <div className="text-3xl mt-1">{team?.emblem ?? '⚽'}</div>
            <h2 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white line-clamp-2 min-h-[2.75rem] flex items-center justify-center mt-1">
              {team?.name ?? `Time ${side}`}
            </h2>

            <div
              className={`font-score text-7xl sm:text-8xl font-extrabold leading-none my-3 text-slate-950 dark:text-white select-none ${
                popSide === side ? 'animate-pop' : ''
              }`}
            >
              {score}
            </div>

            {/* Huge +1 / -1 buttons for sweaty hands */}
            <div className="w-full flex gap-2 mt-auto">
              <button
                type="button"
                onClick={() => addPoint(side, -1)}
                aria-label={`Remover ponto de ${team?.name}`}
                className="w-14 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 flex items-center justify-center active:scale-95 transition"
              >
                <Minus className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => addPoint(side, 1)}
                className="flex-1 h-16 rounded-2xl text-white font-extrabold text-2xl flex items-center justify-center gap-1 shadow-lg active:scale-95 transition"
                style={{ backgroundColor: team?.color ?? '#10b981' }}
              >
                <Plus className="w-7 h-7 stroke-[3]" />1
              </button>
            </div>

            {/* Player Goal Quick-Tap Buttons (Futsal / Goal sports) */}
            {tournament.sport.trackPlayerGoals && team && team.players.length > 0 && (
              <div className="w-full mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  +1 Gol por Jogador
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {team.players.map((pl) => {
                    const pGoals = match.events
                      .filter((e) => e.playerId === pl.id && e.type === 'goal')
                      .reduce((sum, e) => sum + e.value, 0);
                    return (
                      <button
                        key={pl.id}
                        type="button"
                        onClick={() => addPoint(side, 1, pl.id, 'goal')}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-900 dark:text-emerald-200 active:scale-95 transition"
                      >
                        ⚽ {pl.name.split(' ')[0]} {pGoals > 0 ? `(${pGoals})` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Extensible extra stats (aces / blocks) */}
            {!tournament.sport.trackPlayerGoals &&
              tournament.sport.extraStatsEnabled.length > 0 && (
                <div className="w-full mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1.5 justify-center">
                  {tournament.sport.extraStatsEnabled.map((st) => {
                    const count = match.events.filter(
                      (e) => e.teamId === team?.id && e.type === st,
                    ).length;
                    const label =
                      st === 'ace' ? 'Ace' : st === 'block' ? 'Bloqueio' : 'Assist';
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => addExtraStat(side, st, team?.players[0]?.id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300"
                      >
                        + {label} {count > 0 ? `(${count})` : ''}
                      </button>
                    );
                  })}
                </div>
              )}
          </div>
        ))}
      </div>

      {/* Set Completion Helper Banner */}
      {isSetPointReached && (
        <button
          type="button"
          onClick={closeCurrentSetAndAdvance}
          className="w-full h-14 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg animate-bounce"
        >
          <Sparkles className="w-5 h-5" />
          {tournament.sport.setsToWin > 1 &&
          match.scoreA + 1 < tournament.sport.setsToWin &&
          match.scoreB + 1 < tournament.sport.setsToWin
            ? `Fechar Set ${currentSet.setNumber} e Ir para Próximo Set`
            : 'Pontuação Atingida! Toque para Finalizar Jogo'}
        </button>
      )}

      {/* Previous sets strip if best of 3 */}
      {isSetsMode && sets.length > 1 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-center gap-3 text-xs font-bold">
          <span className="text-slate-400">Parciais:</span>
          {sets.map((s) => (
            <span
              key={s.setNumber}
              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              S{s.setNumber}: {s.scoreA}x{s.scoreB}
            </span>
          ))}
        </div>
      )}

      {/* Sticky Finish Button */}
      <div className="fixed bottom-0 inset-x-0 z-20 p-4 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-amber-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto">
          <button
            type="button"
            onClick={handleFinishButton}
            className="w-full h-14 rounded-2xl bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 font-extrabold text-base flex items-center justify-center gap-2 shadow-xl active:scale-[0.99] transition"
          >
            <Flag className="w-5 h-5" />
            Finalizar Jogo
          </button>
        </div>
      </div>

      {/* Tie / Manual Winner Selection Modal */}
      {pickWinnerModal && teamA && teamB && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                  Placar empatado — Definir vencedor
                </h3>
                <p className="text-xs text-slate-500">
                  Selecione quem venceu no desempate / pênaltis / critério da quadra:
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {[teamA, teamB].map((tm) => (
                <button
                  key={tm.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playWhistle();
                    onFinishMatch({
                      winnerId: tm.id,
                      scoreA: match.scoreA,
                      scoreB: match.scoreB,
                      sets,
                      events: match.events,
                    });
                  }}
                  className="w-full h-14 px-4 rounded-2xl border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 font-extrabold text-sm text-slate-900 dark:text-white flex items-center justify-between"
                >
                  <span>
                    {tm.emblem} {tm.name}
                  </span>
                  <Check className="w-5 h-5 text-emerald-600" />
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPickWinnerModal(false)}
              className="w-full h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm"
            >
              Voltar ao Placar
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
