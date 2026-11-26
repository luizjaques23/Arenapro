import { describe, expect, it } from 'vitest';
import { SPORT_PRESETS } from './sports';
import {
  computeStandings,
  computeTopScorers,
  createId,
  createTournament,
  finishMatch,
  finishTournamentManually,
  getAllMatches,
  resetTournament,
  startTournament,
} from './tournamentEngine';
import type { Team, Tournament } from '../types/tournament';

function makeTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `team_${idx + 1}`,
    name: `Dupla ${idx + 1}`,
    color: '#10b981',
    emblem: '⚽',
    players: [
      { id: `p_${idx + 1}_1`, name: `Jogador ${idx + 1}A` },
      { id: `p_${idx + 1}_2`, name: `Jogador ${idx + 1}B` },
    ],
  }));
}

function playAllPending(
  initial: Tournament,
  pickMode: 'first' | 'last' | 'winners_first' | 'losers_first',
): Tournament {
  let t = initial;
  let guard = 0;
  while (t.status !== 'finished' && guard < 200) {
    guard += 1;
    const all = getAllMatches(t).filter((m) => m.status !== 'finished' && !m.isBye);
    if (all.length === 0) break;

    let match = all[0];
    if (pickMode === 'last') {
      match = all[all.length - 1];
    } else if (pickMode === 'winners_first') {
      match = all.find((m) => m.side === 'winners') ?? all[0];
    } else if (pickMode === 'losers_first') {
      match = all.find((m) => m.side === 'losers') ?? all[0];
    }

    const winnerId = match.teamAId!;
    t = finishMatch(t, match.id, {
      winnerId,
      scoreA: 18,
      scoreB: 12,
      sets: [{ setNumber: 1, scoreA: 18, scoreB: 12, winnerId }],
    });
  }
  return t;
}

describe('Bracket tournament engine (Vencedores x Perdedores)', () => {
  const sport = SPORT_PRESETS[0].defaultConfig;

  for (const count of [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16]) {
    for (const order of ['first', 'winners_first', 'losers_first'] as const) {
      it(`completes cleanly for ${count} teams (${order})`, () => {
        const base = createTournament({
          name: `Copa ${count}`,
          sport,
          format: 'bracket',
          targetTeamsCount: count,
          teams: makeTeams(count),
        });
        const started = startTournament(base);
        const done = playAllPending(started, order);

        expect(done.status).toBe('finished');
        expect(done.championId).toBeDefined();
        expect(done.runnerUpId).toBeDefined();
        expect(done.championId).not.toBe(done.runnerUpId);

        const standings = computeStandings(done);
        expect(standings).toHaveLength(count);
        expect(standings[0].team.id).toBe(done.championId);
        expect(standings[1].team.id).toBe(done.runnerUpId);
      });
    }
  }

  it('supports ending tournament as soon as Winners Champion is crowned', () => {
    const base = createTournament({
      name: 'Copa Rápida',
      sport,
      format: 'bracket',
      targetTeamsCount: 6,
      teams: makeTeams(6),
    });
    let t = startTournament(base);
    let guard = 0;
    while (!t.bracket?.winnersChampionId && guard < 50) {
      guard += 1;
      const m = getAllMatches(t).find(
        (item) => item.side === 'winners' && item.status !== 'finished',
      )!;
      t = finishMatch(t, m.id, {
        winnerId: m.teamAId!,
        scoreA: 18,
        scoreB: 10,
      });
    }
    expect(t.bracket?.winnersChampionId).toBeDefined();
    const finished = finishTournamentManually(t);
    expect(finished.status).toBe('finished');
    expect(finished.championId).toBe(t.bracket?.winnersChampionId);
  });
});

describe('King of the Court (Rei da Quadra)', () => {
  it('keeps winner on court, sends loser to end of queue, and tracks streak', () => {
    const sport = SPORT_PRESETS[0].defaultConfig;
    const base = createTournament({
      name: 'Rei da Areia',
      sport,
      format: 'king_of_court',
      targetTeamsCount: 4,
      teams: makeTeams(4),
    });
    let t = startTournament(base);
    expect(t.kingOfCourt?.courtTeamAId).toBe('team_1');
    expect(t.kingOfCourt?.courtTeamBId).toBe('team_2');
    expect(t.kingOfCourt?.queue).toEqual(['team_3', 'team_4']);

    // Match 1: team_1 beats team_2
    t = finishMatch(t, t.kingOfCourt!.currentMatchId!, {
      winnerId: 'team_1',
      scoreA: 18,
      scoreB: 14,
    });
    expect(t.kingOfCourt?.currentKingTeamId).toBe('team_1');
    expect(t.kingOfCourt?.currentStreak).toBe(1);
    expect(t.kingOfCourt?.courtTeamAId).toBe('team_1');
    expect(t.kingOfCourt?.courtTeamBId).toBe('team_3');
    expect(t.kingOfCourt?.queue).toEqual(['team_4', 'team_2']);

    // Match 2: team_1 beats team_3
    t = finishMatch(t, t.kingOfCourt!.currentMatchId!, {
      winnerId: 'team_1',
      scoreA: 18,
      scoreB: 15,
    });
    expect(t.kingOfCourt?.currentStreak).toBe(2);
    expect(t.kingOfCourt?.bestStreakByTeam['team_1']).toBe(2);

    const closed = finishTournamentManually(t);
    expect(closed.status).toBe('finished');
    expect(closed.championId).toBe('team_1');
  });
});

describe('Futsal goals & reset modes', () => {
  it('computes Artilheiro ranking and resets cleanly', () => {
    const futsal = SPORT_PRESETS[1].defaultConfig;
    const base = createTournament({
      name: 'Copa Futsal',
      sport: futsal,
      format: 'bracket',
      targetTeamsCount: 2,
      teams: makeTeams(2),
    });
    let t = startTournament(base);
    const match = getAllMatches(t)[0];
    t = finishMatch(t, match.id, {
      winnerId: 'team_1',
      scoreA: 3,
      scoreB: 1,
      events: [
        {
          id: createId('ev'),
          teamId: 'team_1',
          playerId: 'p_1_1',
          type: 'goal',
          value: 1,
          timestamp: Date.now(),
        },
        {
          id: createId('ev'),
          teamId: 'team_1',
          playerId: 'p_1_1',
          type: 'goal',
          value: 1,
          timestamp: Date.now(),
        },
        {
          id: createId('ev'),
          teamId: 'team_1',
          playerId: 'p_1_2',
          type: 'goal',
          value: 1,
          timestamp: Date.now(),
        },
      ],
    });

    const scorers = computeTopScorers(t);
    expect(scorers[0].player.id).toBe('p_1_1');
    expect(scorers[0].goals).toBe(2);

    const resetMatchesOnly = resetTournament(t, 'matches_only');
    expect(resetMatchesOnly.teams).toHaveLength(2);
    expect(resetMatchesOnly.status).toBe('in_progress');
    expect(getAllMatches(resetMatchesOnly)[0].status).toBe('pending');

    const resetAll = resetTournament(t, 'all');
    expect(resetAll.teams).toHaveLength(0);
    expect(resetAll.status).toBe('setup');
  });
});
