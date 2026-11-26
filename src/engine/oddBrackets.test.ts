import { describe, expect, it } from 'vitest';
import { SPORT_PRESETS } from './sports';
import {
  createTournament,
  finishMatch,
  getAllMatches,
  startTournament,
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
});
