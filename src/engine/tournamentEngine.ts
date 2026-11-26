import type {
  BracketRound,
  BracketState,
  KingOfCourtState,
  Match,
  MatchStatEvent,
  PlayerScorer,
  SetScore,
  SportConfig,
  Team,
  TeamStanding,
  Tournament,
  TournamentFormat,
} from '../types/tournament';

export function createId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface CreateTournamentInput {
  name: string;
  sport: SportConfig;
  format: TournamentFormat;
  targetTeamsCount: number;
  teams?: Team[];
}

export function createTournament(input: CreateTournamentInput): Tournament {
  const now = Date.now();
  return {
    id: createId('trn'),
    name: input.name.trim() || 'Torneio sem nome',
    sport: { ...input.sport },
    format: input.format,
    targetTeamsCount: Math.max(2, input.targetTeamsCount),
    teams: input.teams ? [...input.teams] : [],
    status: 'setup',
    createdAt: now,
    updatedAt: now,
  };
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeEmptySets(sport: SportConfig): SetScore[] {
  return sport.scoringMode === 'sets' ? [{ setNumber: 1, scoreA: 0, scoreB: 0 }] : [];
}

function createMatchObject(params: {
  matchNumber: number;
  side: Match['side'];
  roundIndex: number;
  teamAId: string | null;
  teamBId: string | null;
  isBye?: boolean;
  sport: SportConfig;
}): Match {
  const isBye = Boolean(params.isBye);
  return {
    id: createId('m'),
    matchNumber: params.matchNumber,
    side: params.side,
    roundIndex: params.roundIndex,
    teamAId: params.teamAId,
    teamBId: params.teamBId,
    isBye,
    status: isBye ? 'finished' : 'pending',
    scoreA: 0,
    scoreB: 0,
    sets: makeEmptySets(params.sport),
    currentSetIndex: 0,
    winnerId: isBye ? (params.teamAId ?? params.teamBId ?? undefined) : undefined,
    loserId: undefined,
    events: [],
    finishedAt: isBye ? Date.now() : undefined,
  };
}

/**
 * Picks one team to receive a BYE when teamIds.length is odd,
 * prioritizing teams that have not received a BYE yet.
 */
function pickByeTeamIndex(teamIds: string[], byeHistoryTeamIds: string[]): number {
  for (let i = teamIds.length - 1; i >= 0; i -= 1) {
    if (!byeHistoryTeamIds.includes(teamIds[i])) {
      return i;
    }
  }
  return teamIds.length - 1;
}

function getWinnersRoundName(roundIndex: number, teamCount: number): string {
  if (teamCount === 2) return 'Final dos Vencedores';
  if (teamCount <= 4) return 'Semifinal (Vencedores)';
  return `Rodada ${roundIndex + 1} (Vencedores)`;
}

function getLosersRoundName(roundIndex: number, teamCount: number, isWinnersDone: boolean): string {
  if (isWinnersDone && teamCount === 2) return 'Final da Repescagem';
  return `Repescagem ${roundIndex + 1}`;
}

function buildBracketRound(params: {
  teamIds: string[];
  side: 'winners' | 'losers';
  roundIndex: number;
  sport: SportConfig;
  byeHistoryTeamIds: string[];
  nextMatchNumber: number;
  isWinnersDone?: boolean;
}): {
  round: BracketRound;
  byeHistoryTeamIds: string[];
  nextMatchNumber: number;
} {
  const updatedByeHistory = [...params.byeHistoryTeamIds];
  const working = [...params.teamIds];
  let byeTeamId: string | null = null;

  if (working.length % 2 === 1) {
    const byeIdx = pickByeTeamIndex(working, updatedByeHistory);
    byeTeamId = working.splice(byeIdx, 1)[0];
    updatedByeHistory.push(byeTeamId);
  }

  let matchNumber = params.nextMatchNumber;
  const matches: Match[] = [];

  for (let i = 0; i < working.length; i += 2) {
    matches.push(
      createMatchObject({
        matchNumber: matchNumber++,
        side: params.side,
        roundIndex: params.roundIndex,
        teamAId: working[i],
        teamBId: working[i + 1],
        sport: params.sport,
      }),
    );
  }

  if (byeTeamId) {
    matches.push(
      createMatchObject({
        matchNumber: matchNumber++,
        side: params.side,
        roundIndex: params.roundIndex,
        teamAId: byeTeamId,
        teamBId: null,
        isBye: true,
        sport: params.sport,
      }),
    );
  }

  const name =
    params.side === 'winners'
      ? getWinnersRoundName(params.roundIndex, params.teamIds.length)
      : getLosersRoundName(
          params.roundIndex,
          params.teamIds.length,
          Boolean(params.isWinnersDone),
        );

  return {
    round: {
      roundIndex: params.roundIndex,
      name,
      side: params.side,
      matches,
      processed: false,
    },
    byeHistoryTeamIds: updatedByeHistory,
    nextMatchNumber: matchNumber,
  };
}

export function startTournament(
  tournament: Tournament,
  options?: { shuffle?: boolean },
): Tournament {
  if (tournament.teams.length < 2) {
    throw new Error('É necessário cadastrar pelo menos 2 times para iniciar.');
  }

  const orderedTeams = options?.shuffle
    ? shuffleArray(tournament.teams)
    : [...tournament.teams];
  const teamIds = orderedTeams.map((t) => t.id);
  const now = Date.now();

  if (tournament.format === 'king_of_court') {
    const [first, second, ...rest] = teamIds;
    const firstMatch = createMatchObject({
      matchNumber: 1,
      side: 'king_of_court',
      roundIndex: 0,
      teamAId: first,
      teamBId: second,
      sport: tournament.sport,
    });

    const kingOfCourt: KingOfCourtState = {
      courtTeamAId: first,
      courtTeamBId: second,
      queue: rest,
      currentMatchId: firstMatch.id,
      matches: [firstMatch],
      currentKingTeamId: null,
      currentStreak: 0,
      bestStreakByTeam: {},
      nextMatchNumber: 2,
    };

    return {
      ...tournament,
      teams: orderedTeams,
      status: 'in_progress',
      updatedAt: now,
      finishedAt: undefined,
      championId: undefined,
      runnerUpId: undefined,
      bracket: undefined,
      kingOfCourt,
    };
  }

  const { round, byeHistoryTeamIds, nextMatchNumber } = buildBracketRound({
    teamIds,
    side: 'winners',
    roundIndex: 0,
    sport: tournament.sport,
    byeHistoryTeamIds: [],
    nextMatchNumber: 1,
  });

  const bracket: BracketState = {
    winnersRounds: [round],
    losersRounds: [],
    losersAdvancingPool: [],
    losersStagingPool: [],
    byeHistoryTeamIds,
    eliminated: [],
    nextMatchNumber,
  };

  return {
    ...tournament,
    teams: orderedTeams,
    status: 'in_progress',
    updatedAt: now,
    finishedAt: undefined,
    championId: undefined,
    runnerUpId: undefined,
    bracket,
    kingOfCourt: undefined,
  };
}

export function getAllMatches(tournament: Tournament): Match[] {
  if (tournament.format === 'king_of_court') {
    return tournament.kingOfCourt?.matches ?? [];
  }
  const winners = tournament.bracket?.winnersRounds.flatMap((r) => r.matches) ?? [];
  const losers = tournament.bracket?.losersRounds.flatMap((r) => r.matches) ?? [];
  return [...winners, ...losers];
}

export function findMatch(tournament: Tournament, matchId: string): Match | undefined {
  return getAllMatches(tournament).find((m) => m.id === matchId);
}

function mapMatchInTournament(
  tournament: Tournament,
  matchId: string,
  updater: (match: Match) => Match,
): Tournament {
  const now = Date.now();
  if (tournament.format === 'king_of_court' && tournament.kingOfCourt) {
    return {
      ...tournament,
      updatedAt: now,
      kingOfCourt: {
        ...tournament.kingOfCourt,
        matches: tournament.kingOfCourt.matches.map((m) =>
          m.id === matchId ? updater(m) : m,
        ),
      },
    };
  }

  if (tournament.bracket) {
    return {
      ...tournament,
      updatedAt: now,
      bracket: {
        ...tournament.bracket,
        winnersRounds: tournament.bracket.winnersRounds.map((round) => ({
          ...round,
          matches: round.matches.map((m) => (m.id === matchId ? updater(m) : m)),
        })),
        losersRounds: tournament.bracket.losersRounds.map((round) => ({
          ...round,
          matches: round.matches.map((m) => (m.id === matchId ? updater(m) : m)),
        })),
      },
    };
  }

  return tournament;
}

export function updateLiveMatchState(
  tournament: Tournament,
  matchId: string,
  updater: (match: Match) => Match,
): Tournament {
  return mapMatchInTournament(tournament, matchId, (m) => ({
    ...updater(m),
    status: m.status === 'finished' ? 'finished' : 'live',
    startedAt: m.startedAt ?? Date.now(),
  }));
}

export interface FinishMatchPayload {
  winnerId: string;
  scoreA: number;
  scoreB: number;
  sets?: SetScore[];
  events?: MatchStatEvent[];
}

function advanceBracket(tournament: Tournament): Tournament {
  const bracket = tournament.bracket;
  if (!bracket) return tournament;

  let winnersRounds = bracket.winnersRounds.map((r) => ({ ...r }));
  let losersRounds = bracket.losersRounds.map((r) => ({ ...r }));
  let losersAdvancingPool = [...bracket.losersAdvancingPool];
  let losersStagingPool = [...bracket.losersStagingPool];
  let byeHistoryTeamIds = [...bracket.byeHistoryTeamIds];
  const eliminated = [...bracket.eliminated];
  let winnersChampionId = bracket.winnersChampionId;
  let losersChampionId = bracket.losersChampionId;
  let nextMatchNumber = bracket.nextMatchNumber;

  // 1. Process any newly completed Winners round
  for (let i = 0; i < winnersRounds.length; i += 1) {
    const round = winnersRounds[i];
    if (round.processed) continue;
    const allFinished = round.matches.every((m) => m.status === 'finished');
    if (!allFinished) break;

    round.processed = true;
    const roundWinners: string[] = [];
    const roundLosers: string[] = [];

    for (const m of round.matches) {
      if (m.winnerId) roundWinners.push(m.winnerId);
      if (!m.isBye && m.loserId) roundLosers.push(m.loserId);
    }

    losersStagingPool.push(...roundLosers);

    if (roundWinners.length === 1) {
      winnersChampionId = roundWinners[0];
    } else if (roundWinners.length >= 2) {
      const built = buildBracketRound({
        teamIds: roundWinners,
        side: 'winners',
        roundIndex: round.roundIndex + 1,
        sport: tournament.sport,
        byeHistoryTeamIds,
        nextMatchNumber,
      });
      winnersRounds.push(built.round);
      byeHistoryTeamIds = built.byeHistoryTeamIds;
      nextMatchNumber = built.nextMatchNumber;
    }
  }

  // 2. Process any newly completed Losers round
  for (let i = 0; i < losersRounds.length; i += 1) {
    const round = losersRounds[i];
    if (round.processed) continue;
    const allFinished = round.matches.every((m) => m.status === 'finished');
    if (!allFinished) break;

    round.processed = true;
    const lWinners: string[] = [];
    for (const m of round.matches) {
      if (m.winnerId) lWinners.push(m.winnerId);
      if (!m.isBye && m.loserId) {
        eliminated.push({
          teamId: m.loserId,
          roundIndex: round.roundIndex,
          side: 'losers',
          order: eliminated.length + 1,
        });
      }
    }
    losersAdvancingPool.push(...lWinners);
  }

  // 3. Spawn next Losers round if ready and not blocked waiting for Winners drops
  const hasActiveLosersRound = losersRounds.some((r) => !r.processed);
  if (!hasActiveLosersRound && !losersChampionId) {
    const unfinishedWinnersIdx = winnersRounds.findIndex((r) => !r.processed);
    const waitingForWinners =
      unfinishedWinnersIdx !== -1 && losersRounds.length >= unfinishedWinnersIdx;

    if (!waitingForWinners) {
      const pool = [...losersAdvancingPool, ...losersStagingPool];
      if (pool.length >= 2) {
        const built = buildBracketRound({
          teamIds: pool,
          side: 'losers',
          roundIndex: losersRounds.length,
          sport: tournament.sport,
          byeHistoryTeamIds,
          nextMatchNumber,
          isWinnersDone: unfinishedWinnersIdx === -1,
        });
        losersRounds.push(built.round);
        byeHistoryTeamIds = built.byeHistoryTeamIds;
        nextMatchNumber = built.nextMatchNumber;
        losersAdvancingPool = [];
        losersStagingPool = [];
      } else if (pool.length === 1 && unfinishedWinnersIdx === -1 && winnersChampionId) {
        losersChampionId = pool[0];
        losersAdvancingPool = [];
        losersStagingPool = [];
      }
    }
  }

  const isFullyFinished = Boolean(winnersChampionId && losersChampionId);

  return {
    ...tournament,
    status: isFullyFinished ? 'finished' : tournament.status,
    finishedAt: isFullyFinished ? Date.now() : tournament.finishedAt,
    championId: winnersChampionId ?? tournament.championId,
    runnerUpId: isFullyFinished ? losersChampionId : tournament.runnerUpId,
    bracket: {
      winnersRounds,
      losersRounds,
      losersAdvancingPool,
      losersStagingPool,
      byeHistoryTeamIds,
      eliminated,
      winnersChampionId,
      losersChampionId,
      nextMatchNumber,
    },
  };
}

function advanceKingOfCourt(
  tournament: Tournament,
  finishedMatch: Match,
): Tournament {
  const koc = tournament.kingOfCourt;
  if (!koc || !finishedMatch.winnerId || !finishedMatch.loserId) {
    return tournament;
  }

  const winnerId = finishedMatch.winnerId;
  const loserId = finishedMatch.loserId;
  const nextStreak =
    koc.currentKingTeamId === winnerId ? koc.currentStreak + 1 : 1;
  const prevBest = koc.bestStreakByTeam[winnerId] ?? 0;
  const bestStreakByTeam = {
    ...koc.bestStreakByTeam,
    [winnerId]: Math.max(prevBest, nextStreak),
  };

  // Winner stays on court, loser goes to end of queue, next challenger enters
  const updatedQueue = [...koc.queue, loserId];
  const nextChallenger = updatedQueue.shift() ?? loserId;

  const nextMatch = createMatchObject({
    matchNumber: koc.nextMatchNumber,
    side: 'king_of_court',
    roundIndex: koc.matches.length,
    teamAId: winnerId,
    teamBId: nextChallenger,
    sport: tournament.sport,
  });

  return {
    ...tournament,
    kingOfCourt: {
      courtTeamAId: winnerId,
      courtTeamBId: nextChallenger,
      queue: updatedQueue,
      currentMatchId: nextMatch.id,
      matches: [...koc.matches, nextMatch],
      currentKingTeamId: winnerId,
      currentStreak: nextStreak,
      bestStreakByTeam,
      nextMatchNumber: koc.nextMatchNumber + 1,
    },
  };
}

export function finishMatch(
  tournament: Tournament,
  matchId: string,
  payload: FinishMatchPayload,
): Tournament {
  const existing = findMatch(tournament, matchId);
  if (!existing || existing.status === 'finished') {
    return tournament;
  }
  if (!existing.teamAId || !existing.teamBId) {
    return tournament;
  }

  const loserId =
    payload.winnerId === existing.teamAId ? existing.teamBId : existing.teamAId;
  const now = Date.now();

  const updated = mapMatchInTournament(tournament, matchId, (m) => ({
    ...m,
    status: 'finished',
    scoreA: payload.scoreA,
    scoreB: payload.scoreB,
    sets: payload.sets ?? m.sets,
    events: payload.events ?? m.events,
    winnerId: payload.winnerId,
    loserId,
    finishedAt: now,
  }));

  if (updated.format === 'king_of_court') {
    const finishedMatch = findMatch(updated, matchId)!;
    return advanceKingOfCourt(updated, finishedMatch);
  }

  return advanceBracket(updated);
}

export function finishTournamentManually(tournament: Tournament): Tournament {
  const standings = computeStandings(tournament);
  let championId = tournament.championId;
  let runnerUpId = tournament.runnerUpId;

  if (tournament.format === 'bracket' && tournament.bracket?.winnersChampionId) {
    championId = tournament.bracket.winnersChampionId;
    const withoutChamp = standings.filter((s) => s.team.id !== championId);
    runnerUpId = tournament.bracket.losersChampionId ?? withoutChamp[0]?.team.id;
  } else {
    championId = standings[0]?.team.id;
    runnerUpId = standings[1]?.team.id;
  }

  const now = Date.now();
  let kingOfCourt = tournament.kingOfCourt;
  if (kingOfCourt) {
    // Drop the unplayed pending match on manual finish so history stays clean
    const playedMatches = kingOfCourt.matches.filter(
      (m) => m.status === 'finished' || m.scoreA > 0 || m.scoreB > 0,
    );
    kingOfCourt = {
      ...kingOfCourt,
      matches: playedMatches,
      currentMatchId: null,
    };
  }

  return {
    ...tournament,
    status: 'finished',
    updatedAt: now,
    finishedAt: now,
    championId,
    runnerUpId,
    kingOfCourt,
  };
}

export function resetTournament(
  tournament: Tournament,
  mode: 'matches_only' | 'all',
): Tournament {
  const now = Date.now();
  if (mode === 'all') {
    return {
      ...tournament,
      teams: [],
      status: 'setup',
      updatedAt: now,
      finishedAt: undefined,
      championId: undefined,
      runnerUpId: undefined,
      bracket: undefined,
      kingOfCourt: undefined,
    };
  }

  if (tournament.teams.length >= 2) {
    return startTournament(
      {
        ...tournament,
        status: 'setup',
        finishedAt: undefined,
        championId: undefined,
        runnerUpId: undefined,
      },
      { shuffle: false },
    );
  }

  return {
    ...tournament,
    status: 'setup',
    updatedAt: now,
    finishedAt: undefined,
    championId: undefined,
    runnerUpId: undefined,
    bracket: undefined,
    kingOfCourt: undefined,
  };
}

export function computeStandings(tournament: Tournament): TeamStanding[] {
  const matches = getAllMatches(tournament).filter(
    (m) => m.status === 'finished' && !m.isBye,
  );

  const statsMap = new Map<
    string,
    {
      played: number;
      wins: number;
      losses: number;
      pointsFor: number;
      pointsAgainst: number;
      setsWon: number;
      setsLost: number;
    }
  >();

  for (const team of tournament.teams) {
    statsMap.set(team.id, {
      played: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      setsWon: 0,
      setsLost: 0,
    });
  }

  for (const m of matches) {
    if (!m.teamAId || !m.teamBId) continue;
    const a = statsMap.get(m.teamAId);
    const b = statsMap.get(m.teamBId);
    if (!a || !b) continue;

    a.played += 1;
    b.played += 1;

    if (tournament.sport.scoringMode === 'sets' && m.sets.length > 0) {
      let setsA = 0;
      let setsB = 0;
      for (const s of m.sets) {
        a.pointsFor += s.scoreA;
        a.pointsAgainst += s.scoreB;
        b.pointsFor += s.scoreB;
        b.pointsAgainst += s.scoreA;
        if (s.scoreA > s.scoreB) setsA += 1;
        else if (s.scoreB > s.scoreA) setsB += 1;
      }
      a.setsWon += setsA;
      a.setsLost += setsB;
      b.setsWon += setsB;
      b.setsLost += setsA;
    } else {
      a.pointsFor += m.scoreA;
      a.pointsAgainst += m.scoreB;
      b.pointsFor += m.scoreB;
      b.pointsAgainst += m.scoreA;
    }

    if (m.winnerId === m.teamAId) {
      a.wins += 1;
      b.losses += 1;
    } else if (m.winnerId === m.teamBId) {
      b.wins += 1;
      a.losses += 1;
    }
  }

  const elimOrder = new Map<string, number>();
  if (tournament.bracket) {
    for (const rec of tournament.bracket.eliminated) {
      elimOrder.set(rec.teamId, rec.order);
    }
  }

  const standings: TeamStanding[] = tournament.teams.map((team) => {
    const s = statsMap.get(team.id)!;
    const bestStreak = tournament.kingOfCourt?.bestStreakByTeam[team.id];
    let statusLabel = 'Em disputa';
    if (tournament.championId === team.id || tournament.bracket?.winnersChampionId === team.id) {
      statusLabel = 'Campeão';
    } else if (
      tournament.runnerUpId === team.id ||
      tournament.bracket?.losersChampionId === team.id
    ) {
      statusLabel = 'Vice / Repescagem';
    } else if (elimOrder.has(team.id)) {
      statusLabel = 'Eliminado';
    } else if (tournament.status === 'finished') {
      statusLabel = 'Finalizado';
    }

    return {
      rank: 0,
      team,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      pointsFor: s.pointsFor,
      pointsAgainst: s.pointsAgainst,
      pointDiff: s.pointsFor - s.pointsAgainst,
      setsWon: s.setsWon,
      setsLost: s.setsLost,
      bestStreak,
      statusLabel,
    };
  });

  standings.sort((a, b) => {
    const champId = tournament.championId ?? tournament.bracket?.winnersChampionId;
    const runnerId = tournament.runnerUpId ?? tournament.bracket?.losersChampionId;
    if (a.team.id === champId) return -1;
    if (b.team.id === champId) return 1;
    if (a.team.id === runnerId) return -1;
    if (b.team.id === runnerId) return 1;

    if (tournament.format === 'bracket') {
      const aElim = elimOrder.get(a.team.id) ?? Number.MAX_SAFE_INTEGER;
      const bElim = elimOrder.get(b.team.id) ?? Number.MAX_SAFE_INTEGER;
      if (aElim !== bElim) return bElim - aElim;
    }

    if (b.wins !== a.wins) return b.wins - a.wins;
    if ((b.bestStreak ?? 0) !== (a.bestStreak ?? 0)) {
      return (b.bestStreak ?? 0) - (a.bestStreak ?? 0);
    }
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    return b.pointsFor - a.pointsFor;
  });

  return standings.map((item, idx) => ({ ...item, rank: idx + 1 }));
}

export function computeTopScorers(tournament: Tournament): PlayerScorer[] {
  const matches = getAllMatches(tournament);
  const playerMap = new Map<string, PlayerScorer>();

  for (const team of tournament.teams) {
    for (const player of team.players) {
      playerMap.set(player.id, {
        rank: 0,
        player,
        team,
        goals: 0,
        aces: 0,
        blocks: 0,
        assists: 0,
      });
    }
  }

  for (const m of matches) {
    for (const ev of m.events) {
      if (!ev.playerId) continue;
      const entry = playerMap.get(ev.playerId);
      if (!entry) continue;
      if (ev.type === 'goal') entry.goals += ev.value;
      else if (ev.type === 'ace') entry.aces += ev.value;
      else if (ev.type === 'block') entry.blocks += ev.value;
      else if (ev.type === 'assist') entry.assists += ev.value;
    }
  }

  const list = Array.from(playerMap.values()).filter(
    (p) => p.goals > 0 || p.aces > 0 || p.blocks > 0 || p.assists > 0,
  );

  list.sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (b.aces !== a.aces) return b.aces - a.aces;
    if (b.blocks !== a.blocks) return b.blocks - a.blocks;
    if (b.assists !== a.assists) return b.assists - a.assists;
    return a.player.name.localeCompare(b.player.name);
  });

  return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
}
