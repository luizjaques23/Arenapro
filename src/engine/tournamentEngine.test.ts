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
  isPublicLinkActive,
  resetTournament,
  startTournament,
} from './tournamentEngine';
import type { Match, Team, Tournament } from '../types/tournament';

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

function getPlayableMatches(t: Tournament): Match[] {
  return getAllMatches(t).filter(
    (m) => m.status !== 'finished' && !m.isBye && Boolean(m.teamAId && m.teamBId),
  );
}

function playAllPending(
  initial: Tournament,
  pickMode: 'chronological' | 'last' | 'winners_first' | 'losers_first',
): Tournament {
  let t = initial;
  let guard = 0;
  while (t.status !== 'finished' && guard < 200) {
    guard += 1;
    const playable = getPlayableMatches(t);
    if (playable.length === 0) break;

    let match = playable[0];
    if (pickMode === 'last') {
      match = playable[playable.length - 1];
    } else if (pickMode === 'winners_first') {
      match = playable.find((m) => m.side === 'winners') ?? playable[0];
    } else if (pickMode === 'losers_first') {
      match = playable.find((m) => m.side === 'losers') ?? playable[0];
    }

    const winnerId = match.teamAId!;
    t = finishMatch(t, match.id, {
      winnerId,
      scoreA: 1,
      scoreB: 0,
      sets: [{ setNumber: 1, scoreA: 18, scoreB: 12, winnerId }],
    });
  }
  return t;
}

describe('Official 16-Participant / 30-Match Hybrid Bracket Specification', () => {
  const sport = SPORT_PRESETS[0].defaultConfig;

  it('enforces exact match numbers 1..30, anti-revanche inversion/crossover, and Final Four (27..30)', () => {
    const base = createTournament({
      name: 'Copa Oficial 16',
      sport,
      format: 'bracket',
      targetTeamsCount: 16,
      teams: makeTeams(16),
    });

    // Keep deterministic entry order (Entrada 1 = team_1 ... Entrada 16 = team_16)
    let t = startTournament(base, { shuffle: false });
    const initialMatches = getAllMatches(t);
    expect(initialMatches).toHaveLength(30);
    expect(initialMatches.map((m) => m.matchNumber)).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1),
    );

    const byNum = (num: number) => getAllMatches(t).find((m) => m.matchNumber === num)!;
    const playMatch = (num: number, winSlot: 'A' | 'B' = 'A') => {
      const m = byNum(num);
      expect(m.teamAId).toBeTruthy();
      expect(m.teamBId).toBeTruthy();
      const winnerId = winSlot === 'A' ? m.teamAId! : m.teamBId!;
      t = finishMatch(t, m.id, {
        winnerId,
        scoreA: winSlot === 'A' ? 1 : 0,
        scoreB: winSlot === 'B' ? 1 : 0,
        sets: [
          {
            setNumber: 1,
            scoreA: winSlot === 'A' ? 18 : 14,
            scoreB: winSlot === 'B' ? 18 : 14,
            winnerId,
          },
        ],
      });
    };

    // Bloco 1: Jogos 1 a 8 (team_1, team_3, team_5, team_7, team_9, team_11, team_13, team_15 win)
    // Losers P1..P8 = team_2, team_4, team_6, team_8, team_10, team_12, team_14, team_16
    for (let n = 1; n <= 8; n += 1) playMatch(n, 'A');

    // Verify Rodada 2 Vencedores (Jogos 9..12): V1xV2, V3xV4, V5xV6, V7xV8
    expect([byNum(9).teamAId, byNum(9).teamBId]).toEqual(['team_1', 'team_3']);
    expect([byNum(10).teamAId, byNum(10).teamBId]).toEqual(['team_5', 'team_7']);
    expect([byNum(11).teamAId, byNum(11).teamBId]).toEqual(['team_9', 'team_11']);
    expect([byNum(12).teamAId, byNum(12).teamBId]).toEqual(['team_13', 'team_15']);

    // Verify Repescagem R1 Inverted (Jogos 13..16): P8xP7, P6xP5, P4xP3, P2xP1
    expect([byNum(13).teamAId, byNum(13).teamBId]).toEqual(['team_16', 'team_14']);
    expect([byNum(14).teamAId, byNum(14).teamBId]).toEqual(['team_12', 'team_10']);
    expect([byNum(15).teamAId, byNum(15).teamBId]).toEqual(['team_8', 'team_6']);
    expect([byNum(16).teamAId, byNum(16).teamBId]).toEqual(['team_4', 'team_2']);

    // Bloco 2: Play Jogos 9..12 and Jogos 13..16
    for (let n = 9; n <= 16; n += 1) playMatch(n, 'A');
    // Winners of 9..12: V9=team_1, V10=team_5, V11=team_9, V12=team_13
    // Losers of 9..12: P9=team_3, P10=team_7, P11=team_11, P12=team_15
    // Winners of 13..16: V13=team_16, V14=team_12, V15=team_8, V16=team_4

    // Verify Repescagem R2 (Jogos 17..20): V13xP9, V14xP10, V15xP11, V16xP12
    expect([byNum(17).teamAId, byNum(17).teamBId]).toEqual(['team_16', 'team_3']);
    expect([byNum(18).teamAId, byNum(18).teamBId]).toEqual(['team_12', 'team_7']);
    expect([byNum(19).teamAId, byNum(19).teamBId]).toEqual(['team_8', 'team_11']);
    expect([byNum(20).teamAId, byNum(20).teamBId]).toEqual(['team_4', 'team_15']);

    // Verify Classificatórios Vencedores (Jogos 21..22): V9xV10, V11xV12
    expect([byNum(21).teamAId, byNum(21).teamBId]).toEqual(['team_1', 'team_5']);
    expect([byNum(22).teamAId, byNum(22).teamBId]).toEqual(['team_9', 'team_13']);

    // Bloco 3: Play Jogos 17..22
    for (let n = 17; n <= 22; n += 1) playMatch(n, 'A');
    // V21=team_1, P21=team_5; V22=team_9, P22=team_13
    // V17=team_16, V18=team_12, V19=team_8, V20=team_4

    // Bloco 4: Jogos 23 (V17xV18) and 24 (V19xV20)
    expect([byNum(23).teamAId, byNum(23).teamBId]).toEqual(['team_16', 'team_12']);
    expect([byNum(24).teamAId, byNum(24).teamBId]).toEqual(['team_8', 'team_4']);
    playMatch(23, 'A'); // V23 = team_16
    playMatch(24, 'A'); // V24 = team_8

    // Bloco 5: Crossover in Classificatórios Repescagem: Jogo 25 = P22 x V23, Jogo 26 = P21 x V24
    expect([byNum(25).teamAId, byNum(25).teamBId]).toEqual(['team_13', 'team_16']);
    expect([byNum(26).teamAId, byNum(26).teamBId]).toEqual(['team_5', 'team_8']);
    playMatch(25, 'B'); // V25 = team_16
    playMatch(26, 'A'); // V26 = team_5

    // Bloco 6: Semifinais (Jogo 27 = V21 x V25, Jogo 28 = V22 x V26)
    expect([byNum(27).teamAId, byNum(27).teamBId]).toEqual(['team_1', 'team_16']);
    expect([byNum(28).teamAId, byNum(28).teamBId]).toEqual(['team_9', 'team_5']);
    playMatch(27, 'A'); // V27 = team_1, P27 = team_16
    playMatch(28, 'B'); // V28 = team_5, P28 = team_9

    // Bloco 7: Disputa 3º/4º (Jogo 29 = P27 x P28) & Final (Jogo 30 = V27 x V28)
    expect([byNum(29).teamAId, byNum(29).teamBId]).toEqual(['team_16', 'team_9']);
    expect([byNum(30).teamAId, byNum(30).teamBId]).toEqual(['team_1', 'team_5']);

    playMatch(29, 'B'); // 3rd = team_9, 4th = team_16
    expect(t.status).toBe('in_progress');
    playMatch(30, 'A'); // 1st = team_1, 2nd = team_5

    expect(t.status).toBe('finished');
    expect(t.championId).toBe('team_1');
    expect(t.runnerUpId).toBe('team_5');
    expect(t.thirdPlaceId).toBe('team_9');
    expect(t.fourthPlaceId).toBe('team_16');

    const standings = computeStandings(t);
    expect(standings.slice(0, 4).map((s) => s.team.id)).toEqual([
      'team_1',
      'team_5',
      'team_9',
      'team_16',
    ]);
  });
});

describe('Bracket tournament engine across team counts (2 to 18 teams)', () => {
  const sport = SPORT_PRESETS[0].defaultConfig;

  for (const count of [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18]) {
    for (const order of ['chronological', 'winners_first', 'losers_first'] as const) {
      it(`completes cleanly without deadlocks for ${count} teams (${order})`, () => {
        const base = createTournament({
          name: `Copa ${count}`,
          sport,
          format: 'bracket',
          targetTeamsCount: count,
          teams: makeTeams(count),
        });
        const started = startTournament(base, { shuffle: false });
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
});

describe('King of the Court & Futsal Goals & Resets', () => {
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
    t = finishMatch(t, t.kingOfCourt!.currentMatchId!, {
      winnerId: 'team_1',
      scoreA: 1,
      scoreB: 0,
    });
    expect(t.kingOfCourt?.currentKingTeamId).toBe('team_1');
    expect(t.kingOfCourt?.courtTeamAId).toBe('team_1');
    expect(t.kingOfCourt?.courtTeamBId).toBe('team_3');
    expect(t.kingOfCourt?.queue).toEqual(['team_4', 'team_2']);

    const closed = finishTournamentManually(t);
    expect(closed.status).toBe('finished');
    expect(closed.championId).toBe('team_1');
  });

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
      scoreA: 2,
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
      ],
    });

    const scorers = computeTopScorers(t);
    expect(scorers[0].player.id).toBe('p_1_1');
    expect(scorers[0].goals).toBe(2);

    const resetMatchesOnly = resetTournament(t, 'matches_only');
    expect(resetMatchesOnly.teams).toHaveLength(2);
    expect(resetMatchesOnly.status).toBe('in_progress');

    const resetAll = resetTournament(t, 'all');
    expect(resetAll.teams).toHaveLength(0);
    expect(resetAll.status).toBe('setup');
  });

  it('generates publicToken, advances Futevôlei directly without scores, and auto-deactivates public link on finish', () => {
    const futevolei = SPORT_PRESETS[0].defaultConfig;
    const base = createTournament({
      name: 'Futevôlei Sem Placar',
      sport: futevolei,
      format: 'bracket',
      targetTeamsCount: 4,
      teams: makeTeams(4),
    });

    expect(base.publicToken).toBeDefined();
    expect(isPublicLinkActive(base)).toBe(true);

    let t = startTournament(base, { shuffle: false });
    expect(isPublicLinkActive(t)).toBe(true);

    // Finish all 6 matches of the 4-team Hybrid Double-Elimination with direct winner selection (0x0, no sets)
    while (getPlayableMatches(t).length > 0) {
      const m = getPlayableMatches(t)[0];
      t = finishMatch(t, m.id, {
        winnerId: m.teamAId!,
        scoreA: 0,
        scoreB: 0,
        sets: [],
      });
    }

    expect(t.status).toBe('finished');
    expect(t.publicStatus).toBe('encerrado');
    expect(isPublicLinkActive(t)).toBe(false);
  });

  it('has ZERO BYEs and all teams play Round 1 for 4, 6, 8, 12, and 16 teams, and 0 ghost slots for 5 teams', () => {
    const futevolei = SPORT_PRESETS[0].defaultConfig;
    const expectedMatchCounts: Record<number, number> = {
      4: 6,
      5: 8,
      6: 10,
      8: 14,
      12: 22,
      16: 30,
    };

    for (const [countStr, expectedTotal] of Object.entries(expectedMatchCounts)) {
      const count = Number(countStr);
      const base = createTournament({
        name: `Copa ${count}`,
        sport: futevolei,
        format: 'bracket',
        targetTeamsCount: count,
        teams: makeTeams(count),
      });
      const started = startTournament(base, { shuffle: false });
      const matches = getAllMatches(started);

      expect(matches).toHaveLength(expectedTotal);
      expect(matches.some((m) => m.isBye)).toBe(false);

      if (count !== 5) {
        const r1 = started.bracket!.winnersRounds[0].matches;
        expect(r1).toHaveLength(count / 2);
        expect(r1.every((m) => Boolean(m.teamAId && m.teamBId))).toBe(true);
      }

      const done = playAllPending(started, 'chronological');
      expect(done.status).toBe('finished');
      expect(done.championId).toBeDefined();
      expect(done.runnerUpId).toBeDefined();
      expect(done.thirdPlaceId).toBeDefined();
      expect(done.fourthPlaceId).toBeDefined();
    }
  });

  it('keeps multiple simultaneous tournaments independent when one finishes', () => {
    const futevolei = SPORT_PRESETS[0].defaultConfig;
    const t1 = startTournament(
      createTournament({
        name: 'Torneio A',
        sport: futevolei,
        format: 'bracket',
        targetTeamsCount: 4,
        teams: makeTeams(4),
      }),
    );
    const t2 = startTournament(
      createTournament({
        name: 'Torneio B',
        sport: futevolei,
        format: 'bracket',
        targetTeamsCount: 4,
        teams: makeTeams(4),
      }),
    );

    expect(t1.id).not.toBe(t2.id);
    expect(t1.publicToken).not.toBe(t2.publicToken);
    expect(isPublicLinkActive(t1)).toBe(true);
    expect(isPublicLinkActive(t2)).toBe(true);

    const t1Done = playAllPending(t1, 'chronological');
    expect(isPublicLinkActive(t1Done)).toBe(false);
    expect(t1Done.publicStatus).toBe('encerrado');
    expect(isPublicLinkActive(t2)).toBe(true);
    expect(t2.publicStatus).toBe('ativo');
  });
});
