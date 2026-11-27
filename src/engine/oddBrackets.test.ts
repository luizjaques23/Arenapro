import { describe, expect, it } from 'vitest';
import { SPORT_PRESETS } from './sports';
import {
  computeStandings,
  createTournament,
  finishMatch,
  getAllMatches,
  startTournament,
  updateTournamentTeamsInPlace,
} from './tournamentEngine';
import type { Match, Team, Tournament } from '../types/tournament';

function makeTeams(count: number): Team[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `team_${idx + 1}`,
    name: `Dupla ${idx + 1}`,
    color: '#10b981',
    emblem: '',
    players: [],
  }));
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulate(count: number, seed: number) {
  const rand = mulberry32(seed);
  const sport = SPORT_PRESETS[0].defaultConfig; // Futevôlei
  const base = createTournament({
    name: `Futevôlei ${count}`,
    sport,
    format: 'bracket',
    targetTeamsCount: count,
    teams: makeTeams(count),
  });
  let t: Tournament = startTournament(base, { shuffle: seed % 2 === 0 });
  const initial = t;
  const history: Array<{
    a: string;
    b: string;
    winner: string;
    loser: string;
    side: Match['side'];
  }> = [];
  const lastOpponent = new Map<string, string>();
  const immediateRematches: string[] = [];

  let guard = 0;
  while (t.status !== 'finished' && guard < 100) {
    guard += 1;
    const playable = getAllMatches(t).filter(
      (m) => m.status !== 'finished' && !m.isBye && m.teamAId && m.teamBId,
    );
    if (playable.length === 0) break;
    const match = playable[Math.floor(rand() * playable.length)];
    const a = match.teamAId!;
    const b = match.teamBId!;
    expect(a).not.toBe(b);
    if (lastOpponent.get(a) === b && lastOpponent.get(b) === a) {
      immediateRematches.push(`Jogo ${match.matchNumber}`);
    }
    const winnerId = rand() < 0.5 ? a : b;
    const loserId = winnerId === a ? b : a;
    t = finishMatch(t, match.id, { winnerId, scoreA: 0, scoreB: 0, sets: [] });
    history.push({ a, b, winner: winnerId, loser: loserId, side: match.side });
    lastOpponent.set(a, b);
    lastOpponent.set(b, a);
  }

  return { initial, final: t, history, immediateRematches };
}

describe('Futevôlei odd formats (7, 9, 11, 13 duplas) — hybrid double elimination', () => {
  for (const count of [7, 9, 11, 13]) {
    it(`${count} duplas: 2N-2 jogos, 1 folga na abertura, sem slots fantasmas`, () => {
      const { initial } = simulate(count, 1);
      const matches = getAllMatches(initial);
      expect(initial.bracket?.isHybridGraph).toBe(true);
      expect(matches).toHaveLength(2 * count - 2);
      expect(new Set(matches.map((m) => m.matchNumber)).size).toBe(2 * count - 2);
      expect(matches.some((m) => m.isBye || m.slotAIsBye || m.slotBIsBye)).toBe(false);

      // Every team placed exactly once at the start
      const placed = matches.flatMap((m) => [m.teamAId, m.teamBId]).filter(Boolean);
      expect(placed).toHaveLength(count);
      expect(new Set(placed).size).toBe(count);

      // Minimum single opening folga: (count - 1) / 2 matches in R1, 1 team debuting in R2
      const round1 = matches.filter((m) => m.side === 'winners' && m.roundIndex === 0);
      expect(round1).toHaveLength((count - 1) / 2);
      expect(round1.every((m) => m.teamAId && m.teamBId)).toBe(true);
    });

    it(`${count} duplas: fluxo completo até o campeão sem duplas presas/órfãs (15 simulações)`, () => {
      for (let seed = 1; seed <= 15; seed += 1) {
        const { final, history, immediateRematches } = simulate(count, seed);
        const matches = getAllMatches(final);

        expect(final.status).toBe('finished');
        expect(matches.every((m) => m.status === 'finished' && !m.isBye)).toBe(true);
        expect(history).toHaveLength(2 * count - 2);
        expect(immediateRematches).toEqual([]);

        const podium = [
          final.championId,
          final.runnerUpId,
          final.thirdPlaceId,
          final.fourthPlaceId,
        ];
        expect(podium.every(Boolean)).toBe(true);
        expect(new Set(podium).size).toBe(4);

        const lossesBeforeFinals = new Map<string, number>();
        const played = new Map<string, number>();
        for (const h of history) {
          played.set(h.a, (played.get(h.a) ?? 0) + 1);
          played.set(h.b, (played.get(h.b) ?? 0) + 1);
          if (h.side !== 'finals') {
            lossesBeforeFinals.set(h.loser, (lossesBeforeFinals.get(h.loser) ?? 0) + 1);
          }
        }
        for (const team of final.teams) {
          expect(played.get(team.id) ?? 0).toBeGreaterThanOrEqual(2);
          const losses = lossesBeforeFinals.get(team.id) ?? 0;
          if (podium.includes(team.id)) {
            expect(losses).toBeLessThanOrEqual(1);
          } else {
            expect(losses).toBe(2);
          }
        }
        expect(final.bracket?.eliminated).toHaveLength(count - 4);
      }
    });
  }

  it('permite editar duplas, substituir jogadores e ajustar composição durante o torneio preservando resultados e chaveamento', () => {
    const sport = SPORT_PRESETS[0].defaultConfig;
    const initialTeams: Team[] = [
      {
        id: 't1',
        name: 'Lucas / Matheus',
        color: '#10b981',
        emblem: '',
        players: [
          { id: 'p1', name: 'Lucas' },
          { id: 'p2', name: 'Matheus' },
        ],
      },
      {
        id: 't2',
        name: 'Gabriel / Rafael',
        color: '#10b981',
        emblem: '',
        players: [
          { id: 'p3', name: 'Gabriel' },
          { id: 'p4', name: 'Rafael' },
        ],
      },
      {
        id: 't3',
        name: 'Bruno / Thiago',
        color: '#10b981',
        emblem: '',
        players: [
          { id: 'p5', name: 'Bruno' },
          { id: 'p6', name: 'Thiago' },
        ],
      },
      {
        id: 't4',
        name: 'Pedro / Felipe',
        color: '#10b981',
        emblem: '',
        players: [
          { id: 'p7', name: 'Pedro' },
          { id: 'p8', name: 'Felipe' },
        ],
      },
    ];

    const created = createTournament({
      name: 'Torneio Edição',
      sport,
      format: 'bracket',
      targetTeamsCount: 4,
      teams: initialTeams,
    });
    let t = startTournament(created, { shuffle: false });

    // Finish match 1 before editing teams
    const firstMatch = getAllMatches(t)[0];
    t = finishMatch(t, firstMatch.id, {
      winnerId: 't1',
      scoreA: 18,
      scoreB: 15,
      sets: [],
    });

    const matchesSnapshotBefore = getAllMatches(t).map((m) => ({
      id: m.id,
      status: m.status,
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      winnerId: m.winnerId,
      loserId: m.loserId,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
    }));

    // Now edit t1 (replace Matheus with Carlos) and swap players between t2 and t3
    const editedTeams: Team[] = [
      {
        ...t.teams[0],
        name: 'Lucas / Matheus', // auto-name should update to 'Lucas / Carlos'
        players: [
          { id: 'p1', name: 'Lucas' },
          { id: 'p2', name: 'Carlos' },
        ],
      },
      {
        ...t.teams[1],
        name: 'Gabriel / Thiago',
        players: [
          { id: 'p3', name: 'Gabriel' },
          { id: 'p6', name: 'Thiago' },
        ],
      },
      {
        ...t.teams[2],
        name: 'Bruno / Rafael',
        players: [
          { id: 'p5', name: 'Bruno' },
          { id: 'p4', name: 'Rafael' },
        ],
      },
      t.teams[3],
    ];

    const updated = updateTournamentTeamsInPlace(t, editedTeams);

    // 1. Names & players updated across the system
    expect(updated.teams[0].name).toBe('Lucas / Carlos');
    expect(updated.teams[0].players.map((p) => p.name)).toEqual(['Lucas', 'Carlos']);
    expect(updated.teams[1].name).toBe('Gabriel / Thiago');
    expect(updated.teams[2].name).toBe('Bruno / Rafael');

    // 2. All match results, IDs, scores and bracket structure 100% preserved
    const matchesSnapshotAfter = getAllMatches(updated).map((m) => ({
      id: m.id,
      status: m.status,
      teamAId: m.teamAId,
      teamBId: m.teamBId,
      winnerId: m.winnerId,
      loserId: m.loserId,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
    }));
    expect(matchesSnapshotAfter).toEqual(matchesSnapshotBefore);

    // 3. Standings reflect the new dupla names and keep the win count
    const standings = computeStandings(updated);
    const t1Standing = standings.find((s) => s.team.id === 't1');
    expect(t1Standing?.team.name).toBe('Lucas / Carlos');
    expect(t1Standing?.wins).toBe(1);
  });

  it('Futevôlei ignora sorteio aleatório e segue sequência automática organizada pelo sistema', () => {
    const sport = SPORT_PRESETS[0].defaultConfig; // Futevôlei
    const teams = makeTeams(8);
    const base = createTournament({
      name: 'Futevôlei Sequencial',
      sport,
      format: 'bracket',
      targetTeamsCount: 8,
      teams,
    });

    const startedWithShuffleFlag = startTournament(base, { shuffle: true });
    expect(startedWithShuffleFlag.teams.map((t) => t.id)).toEqual(
      teams.map((t) => t.id),
    );
    const r1Matches = startedWithShuffleFlag.bracket?.winnersRounds[0].matches ?? [];
    expect(r1Matches[0].teamAId).toBe('team_1');
    expect(r1Matches[0].teamBId).toBe('team_2');
    expect(r1Matches[1].teamAId).toBe('team_3');
    expect(r1Matches[1].teamBId).toBe('team_4');
  });
});
