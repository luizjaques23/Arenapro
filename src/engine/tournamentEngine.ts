import {
  hashPin,
  isValidNumericPin,
  sanitizeNumericPin,
  saveTournamentPinHash,
} from '../services/pinAuth';
import type {
  BracketRound,
  BracketState,
  EliminationRecord,
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
  pin?: string;
  pinHash?: string;
}

export function createTournament(input: CreateTournamentInput): Tournament {
  const now = Date.now();
  const id = createId('trn');
  const cleanPin = input.pin ? sanitizeNumericPin(input.pin) : '';
  const computedPinHash =
    input.pinHash ||
    (isValidNumericPin(cleanPin) ? hashPin(cleanPin, id) : undefined);

  if (computedPinHash) {
    saveTournamentPinHash(id, computedPinHash);
  }

  return {
    id,
    publicToken: createId('pub'),
    publicStatus: 'ativo',
    pinHash: computedPinHash,
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
  stageLabel?: string;
  blockNumber?: number;
  teamAId: string | null;
  teamBId: string | null;
  slotALabel?: string;
  slotBLabel?: string;
  slotAIsBye?: boolean;
  slotBIsBye?: boolean;
  destWinnerLabel?: string;
  destLoserLabel?: string;
  nextWinnerMatchNumber?: number;
  nextWinnerSlot?: 'A' | 'B';
  nextLoserMatchNumber?: number;
  nextLoserSlot?: 'A' | 'B';
  placementOnWin?: 1 | 3;
  placementOnLoss?: 2 | 3 | 4;
  isBye?: boolean;
  sport: SportConfig;
}): Match {
  const isBye = Boolean(params.isBye);
  return {
    id: createId('m'),
    matchNumber: params.matchNumber,
    side: params.side,
    roundIndex: params.roundIndex,
    stageLabel: params.stageLabel,
    blockNumber: params.blockNumber,
    teamAId: params.teamAId,
    teamBId: params.teamBId,
    slotALabel: params.slotALabel,
    slotBLabel: params.slotBLabel,
    slotAIsBye: params.slotAIsBye,
    slotBIsBye: params.slotBIsBye,
    destWinnerLabel: params.destWinnerLabel,
    destLoserLabel: params.destLoserLabel,
    nextWinnerMatchNumber: params.nextWinnerMatchNumber,
    nextWinnerSlot: params.nextWinnerSlot,
    nextLoserMatchNumber: params.nextLoserMatchNumber,
    nextLoserSlot: params.nextLoserSlot,
    placementOnWin: params.placementOnWin,
    placementOnLoss: params.placementOnLoss,
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

interface HybridNodeSpec {
  matchNumber: number;
  side: 'winners' | 'losers' | 'finals';
  roundIndex: number;
  roundName: string;
  stageLabel: string;
  blockNumber: number;
  entryAIndex?: number; // 0-based index into initial bracket slots
  entryBIndex?: number;
  slotALabel: string;
  slotBLabel: string;
  destWinnerLabel: string;
  destLoserLabel: string;
  nextWinnerMatchNumber?: number;
  nextWinnerSlot?: 'A' | 'B';
  nextLoserMatchNumber?: number;
  nextLoserSlot?: 'A' | 'B';
  placementOnWin?: 1 | 3;
  placementOnLoss?: 2 | 3 | 4;
}

/**
 * Official 16-Team / 30-Match Hybrid Double-Elimination -> Single-Elimination Final Four Blueprint
 * Matches 1–26: Double Elimination (Winners Left, Repescagem Right with anti-revanche inversion & crossover)
 * Matches 27–30: Single Elimination Semifinals, 3rd/4th Match, and Grand Final (1st/2nd)
 */
const HYBRID_16_SPECS: HybridNodeSpec[] = [
  // 1. Chave dos Vencedores — Rodada 1 (Jogos 1 a 8) — Bloco 1
  {
    matchNumber: 1,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 0,
    entryBIndex: 1,
    slotALabel: 'Entrada 1',
    slotBLabel: 'Entrada 2',
    destWinnerLabel: 'V1 → Jogo 9',
    destLoserLabel: 'P1 → Jogo 16',
    nextWinnerMatchNumber: 9,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 16,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 2,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 2,
    entryBIndex: 3,
    slotALabel: 'Entrada 3',
    slotBLabel: 'Entrada 4',
    destWinnerLabel: 'V2 → Jogo 9',
    destLoserLabel: 'P2 → Jogo 16',
    nextWinnerMatchNumber: 9,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 16,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 3,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 4,
    entryBIndex: 5,
    slotALabel: 'Entrada 5',
    slotBLabel: 'Entrada 6',
    destWinnerLabel: 'V3 → Jogo 10',
    destLoserLabel: 'P3 → Jogo 15',
    nextWinnerMatchNumber: 10,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 15,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 4,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 6,
    entryBIndex: 7,
    slotALabel: 'Entrada 7',
    slotBLabel: 'Entrada 8',
    destWinnerLabel: 'V4 → Jogo 10',
    destLoserLabel: 'P4 → Jogo 15',
    nextWinnerMatchNumber: 10,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 15,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 5,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 8,
    entryBIndex: 9,
    slotALabel: 'Entrada 9',
    slotBLabel: 'Entrada 10',
    destWinnerLabel: 'V5 → Jogo 11',
    destLoserLabel: 'P5 → Jogo 14',
    nextWinnerMatchNumber: 11,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 14,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 6,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 10,
    entryBIndex: 11,
    slotALabel: 'Entrada 11',
    slotBLabel: 'Entrada 12',
    destWinnerLabel: 'V6 → Jogo 11',
    destLoserLabel: 'P6 → Jogo 14',
    nextWinnerMatchNumber: 11,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 14,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 7,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 12,
    entryBIndex: 13,
    slotALabel: 'Entrada 13',
    slotBLabel: 'Entrada 14',
    destWinnerLabel: 'V7 → Jogo 12',
    destLoserLabel: 'P7 → Jogo 13',
    nextWinnerMatchNumber: 12,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 13,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 8,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 14,
    entryBIndex: 15,
    slotALabel: 'Entrada 15',
    slotBLabel: 'Entrada 16',
    destWinnerLabel: 'V8 → Jogo 12',
    destLoserLabel: 'P8 → Jogo 13',
    nextWinnerMatchNumber: 12,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 13,
    nextLoserSlot: 'A',
  },

  // Chave dos Vencedores — Rodada 2 (Jogos 9 a 12) — Bloco 2
  {
    matchNumber: 9,
    side: 'winners',
    roundIndex: 1,
    roundName: 'Rodada 2',
    stageLabel: 'Rodada 2',
    blockNumber: 2,
    slotALabel: 'V1',
    slotBLabel: 'V2',
    destWinnerLabel: 'V9 → Jogo 21',
    destLoserLabel: 'P9 → Jogo 17',
    nextWinnerMatchNumber: 21,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 17,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 10,
    side: 'winners',
    roundIndex: 1,
    roundName: 'Rodada 2',
    stageLabel: 'Rodada 2',
    blockNumber: 2,
    slotALabel: 'V3',
    slotBLabel: 'V4',
    destWinnerLabel: 'V10 → Jogo 21',
    destLoserLabel: 'P10 → Jogo 18',
    nextWinnerMatchNumber: 21,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 18,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 11,
    side: 'winners',
    roundIndex: 1,
    roundName: 'Rodada 2',
    stageLabel: 'Rodada 2',
    blockNumber: 2,
    slotALabel: 'V5',
    slotBLabel: 'V6',
    destWinnerLabel: 'V11 → Jogo 22',
    destLoserLabel: 'P11 → Jogo 19',
    nextWinnerMatchNumber: 22,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 19,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 12,
    side: 'winners',
    roundIndex: 1,
    roundName: 'Rodada 2',
    stageLabel: 'Rodada 2',
    blockNumber: 2,
    slotALabel: 'V7',
    slotBLabel: 'V8',
    destWinnerLabel: 'V12 → Jogo 22',
    destLoserLabel: 'P12 → Jogo 20',
    nextWinnerMatchNumber: 22,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 20,
    nextLoserSlot: 'B',
  },

  // Chave dos Vencedores — Classificatórios A e B (Jogos 21 e 22) — Bloco 3
  {
    matchNumber: 21,
    side: 'winners',
    roundIndex: 2,
    roundName: 'Classificatórios Vencedores',
    stageLabel: 'Classificatório A',
    blockNumber: 3,
    slotALabel: 'V9',
    slotBLabel: 'V10',
    destWinnerLabel: 'V21 → Semifinal A (27)',
    destLoserLabel: 'P21 → Repescagem B (26)',
    nextWinnerMatchNumber: 27,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 26,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 22,
    side: 'winners',
    roundIndex: 2,
    roundName: 'Classificatórios Vencedores',
    stageLabel: 'Classificatório B',
    blockNumber: 3,
    slotALabel: 'V11',
    slotBLabel: 'V12',
    destWinnerLabel: 'V22 → Semifinal B (28)',
    destLoserLabel: 'P22 → Repescagem A (25)',
    nextWinnerMatchNumber: 28,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 25,
    nextLoserSlot: 'A',
  },

  // 2. Chave da Repescagem — R1 Invertida (Jogos 13 a 16) — Bloco 2
  {
    matchNumber: 13,
    side: 'losers',
    roundIndex: 0,
    roundName: 'Repescagem R1',
    stageLabel: 'Repescagem R1',
    blockNumber: 2,
    slotALabel: 'P8',
    slotBLabel: 'P7',
    destWinnerLabel: 'V13 → Jogo 17',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 17,
    nextWinnerSlot: 'A',
  },
  {
    matchNumber: 14,
    side: 'losers',
    roundIndex: 0,
    roundName: 'Repescagem R1',
    stageLabel: 'Repescagem R1',
    blockNumber: 2,
    slotALabel: 'P6',
    slotBLabel: 'P5',
    destWinnerLabel: 'V14 → Jogo 18',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 18,
    nextWinnerSlot: 'A',
  },
  {
    matchNumber: 15,
    side: 'losers',
    roundIndex: 0,
    roundName: 'Repescagem R1',
    stageLabel: 'Repescagem R1',
    blockNumber: 2,
    slotALabel: 'P4',
    slotBLabel: 'P3',
    destWinnerLabel: 'V15 → Jogo 19',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 19,
    nextWinnerSlot: 'A',
  },
  {
    matchNumber: 16,
    side: 'losers',
    roundIndex: 0,
    roundName: 'Repescagem R1',
    stageLabel: 'Repescagem R1',
    blockNumber: 2,
    slotALabel: 'P2',
    slotBLabel: 'P1',
    destWinnerLabel: 'V16 → Jogo 20',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 20,
    nextWinnerSlot: 'A',
  },

  // Repescagem R2 (Jogos 17 a 20) — Bloco 3
  {
    matchNumber: 17,
    side: 'losers',
    roundIndex: 1,
    roundName: 'Repescagem R2',
    stageLabel: 'Repescagem R2',
    blockNumber: 3,
    slotALabel: 'V13',
    slotBLabel: 'P9',
    destWinnerLabel: 'V17 → Jogo 23',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 23,
    nextWinnerSlot: 'A',
  },
  {
    matchNumber: 18,
    side: 'losers',
    roundIndex: 1,
    roundName: 'Repescagem R2',
    stageLabel: 'Repescagem R2',
    blockNumber: 3,
    slotALabel: 'V14',
    slotBLabel: 'P10',
    destWinnerLabel: 'V18 → Jogo 23',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 23,
    nextWinnerSlot: 'B',
  },
  {
    matchNumber: 19,
    side: 'losers',
    roundIndex: 1,
    roundName: 'Repescagem R2',
    stageLabel: 'Repescagem R2',
    blockNumber: 3,
    slotALabel: 'V15',
    slotBLabel: 'P11',
    destWinnerLabel: 'V19 → Jogo 24',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 24,
    nextWinnerSlot: 'A',
  },
  {
    matchNumber: 20,
    side: 'losers',
    roundIndex: 1,
    roundName: 'Repescagem R2',
    stageLabel: 'Repescagem R2',
    blockNumber: 3,
    slotALabel: 'V16',
    slotBLabel: 'P12',
    destWinnerLabel: 'V20 → Jogo 24',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 24,
    nextWinnerSlot: 'B',
  },

  // Repescagem R3 (Jogos 23 e 24) — Bloco 4
  {
    matchNumber: 23,
    side: 'losers',
    roundIndex: 2,
    roundName: 'Repescagem R3',
    stageLabel: 'Repescagem R3',
    blockNumber: 4,
    slotALabel: 'V17',
    slotBLabel: 'V18',
    destWinnerLabel: 'V23 → Jogo 25',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 25,
    nextWinnerSlot: 'B',
  },
  {
    matchNumber: 24,
    side: 'losers',
    roundIndex: 2,
    roundName: 'Repescagem R3',
    stageLabel: 'Repescagem R3',
    blockNumber: 4,
    slotALabel: 'V19',
    slotBLabel: 'V20',
    destWinnerLabel: 'V24 → Jogo 26',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 26,
    nextWinnerSlot: 'B',
  },

  // Classificatórios Repescagem A e B com cruzamento P22/P21 (Jogos 25 e 26) — Bloco 5
  {
    matchNumber: 25,
    side: 'losers',
    roundIndex: 3,
    roundName: 'Classificatórios Repescagem',
    stageLabel: 'Classif. Repescagem A',
    blockNumber: 5,
    slotALabel: 'P22',
    slotBLabel: 'V23',
    destWinnerLabel: 'V25 → Semifinal A (27)',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 27,
    nextWinnerSlot: 'B',
  },
  {
    matchNumber: 26,
    side: 'losers',
    roundIndex: 3,
    roundName: 'Classificatórios Repescagem',
    stageLabel: 'Classif. Repescagem B',
    blockNumber: 5,
    slotALabel: 'P21',
    slotBLabel: 'V24',
    destWinnerLabel: 'V26 → Semifinal B (28)',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 28,
    nextWinnerSlot: 'B',
  },

  // 3. Fase Final Eliminatória Simples (Jogos 27 a 30) — Blocos 6 e 7
  {
    matchNumber: 27,
    side: 'finals',
    roundIndex: 0,
    roundName: 'Semifinais',
    stageLabel: 'Semifinal A',
    blockNumber: 6,
    slotALabel: 'V21',
    slotBLabel: 'V25',
    destWinnerLabel: 'V27 → Final (30)',
    destLoserLabel: 'P27 → 3º/4º (29)',
    nextWinnerMatchNumber: 30,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 29,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 28,
    side: 'finals',
    roundIndex: 0,
    roundName: 'Semifinais',
    stageLabel: 'Semifinal B',
    blockNumber: 6,
    slotALabel: 'V22',
    slotBLabel: 'V26',
    destWinnerLabel: 'V28 → Final (30)',
    destLoserLabel: 'P28 → 3º/4º (29)',
    nextWinnerMatchNumber: 30,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 29,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 29,
    side: 'finals',
    roundIndex: 1,
    roundName: 'Finais (1º ao 4º)',
    stageLabel: 'Disputa de 3º/4º',
    blockNumber: 7,
    slotALabel: 'P27',
    slotBLabel: 'P28',
    destWinnerLabel: '3º Lugar',
    destLoserLabel: '4º Lugar',
    placementOnWin: 3,
    placementOnLoss: 4,
  },
  {
    matchNumber: 30,
    side: 'finals',
    roundIndex: 1,
    roundName: 'Finais (1º ao 4º)',
    stageLabel: 'Final (1º/2º)',
    blockNumber: 7,
    slotALabel: 'V27',
    slotBLabel: 'V28',
    destWinnerLabel: 'Campeão (1º)',
    destLoserLabel: 'Vice (2º)',
    placementOnWin: 1,
    placementOnLoss: 2,
  },
];

/**
 * Analogous 8-Team / 14-Match Hybrid Double-Elimination -> Semifinals -> 3rd/4th + Final
 */
const HYBRID_8_SPECS: HybridNodeSpec[] = [
  {
    matchNumber: 1,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 0,
    entryBIndex: 1,
    slotALabel: 'Entrada 1',
    slotBLabel: 'Entrada 2',
    destWinnerLabel: 'V1 → Jogo 7',
    destLoserLabel: 'P1 → Jogo 6',
    nextWinnerMatchNumber: 7,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 6,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 2,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 2,
    entryBIndex: 3,
    slotALabel: 'Entrada 3',
    slotBLabel: 'Entrada 4',
    destWinnerLabel: 'V2 → Jogo 7',
    destLoserLabel: 'P2 → Jogo 6',
    nextWinnerMatchNumber: 7,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 6,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 3,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 4,
    entryBIndex: 5,
    slotALabel: 'Entrada 5',
    slotBLabel: 'Entrada 6',
    destWinnerLabel: 'V3 → Jogo 8',
    destLoserLabel: 'P3 → Jogo 5',
    nextWinnerMatchNumber: 8,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 5,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 4,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 6,
    entryBIndex: 7,
    slotALabel: 'Entrada 7',
    slotBLabel: 'Entrada 8',
    destWinnerLabel: 'V4 → Jogo 8',
    destLoserLabel: 'P4 → Jogo 5',
    nextWinnerMatchNumber: 8,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 5,
    nextLoserSlot: 'A',
  },
  // Repescagem R1 invertida (Jogos 5 e 6) — Bloco 2
  {
    matchNumber: 5,
    side: 'losers',
    roundIndex: 0,
    roundName: 'Repescagem R1',
    stageLabel: 'Repescagem R1',
    blockNumber: 2,
    slotALabel: 'P4',
    slotBLabel: 'P3',
    destWinnerLabel: 'V5 → Jogo 9',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 9,
    nextWinnerSlot: 'B',
  },
  {
    matchNumber: 6,
    side: 'losers',
    roundIndex: 0,
    roundName: 'Repescagem R1',
    stageLabel: 'Repescagem R1',
    blockNumber: 2,
    slotALabel: 'P2',
    slotBLabel: 'P1',
    destWinnerLabel: 'V6 → Jogo 10',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 10,
    nextWinnerSlot: 'B',
  },
  // Classificatórios Vencedores (Jogos 7 e 8) — Bloco 2
  {
    matchNumber: 7,
    side: 'winners',
    roundIndex: 1,
    roundName: 'Classificatórios Vencedores',
    stageLabel: 'Classificatório A',
    blockNumber: 2,
    slotALabel: 'V1',
    slotBLabel: 'V2',
    destWinnerLabel: 'V7 → Semifinal A (11)',
    destLoserLabel: 'P7 → Repescagem B (10)',
    nextWinnerMatchNumber: 11,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 10,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 8,
    side: 'winners',
    roundIndex: 1,
    roundName: 'Classificatórios Vencedores',
    stageLabel: 'Classificatório B',
    blockNumber: 2,
    slotALabel: 'V3',
    slotBLabel: 'V4',
    destWinnerLabel: 'V8 → Semifinal B (12)',
    destLoserLabel: 'P8 → Repescagem A (9)',
    nextWinnerMatchNumber: 12,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 9,
    nextLoserSlot: 'A',
  },
  // Classificatórios Repescagem cruzados (Jogos 9 e 10) — Bloco 3
  {
    matchNumber: 9,
    side: 'losers',
    roundIndex: 1,
    roundName: 'Classificatórios Repescagem',
    stageLabel: 'Classif. Repescagem A',
    blockNumber: 3,
    slotALabel: 'P8',
    slotBLabel: 'V5',
    destWinnerLabel: 'V9 → Semifinal A (11)',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 11,
    nextWinnerSlot: 'B',
  },
  {
    matchNumber: 10,
    side: 'losers',
    roundIndex: 1,
    roundName: 'Classificatórios Repescagem',
    stageLabel: 'Classif. Repescagem B',
    blockNumber: 3,
    slotALabel: 'P7',
    slotBLabel: 'V6',
    destWinnerLabel: 'V10 → Semifinal B (12)',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 12,
    nextWinnerSlot: 'B',
  },
  // Fase Final (Jogos 11 a 14) — Blocos 4 e 5
  {
    matchNumber: 11,
    side: 'finals',
    roundIndex: 0,
    roundName: 'Semifinais',
    stageLabel: 'Semifinal A',
    blockNumber: 4,
    slotALabel: 'V7',
    slotBLabel: 'V9',
    destWinnerLabel: 'V11 → Final (14)',
    destLoserLabel: 'P11 → 3º/4º (13)',
    nextWinnerMatchNumber: 14,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 13,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 12,
    side: 'finals',
    roundIndex: 0,
    roundName: 'Semifinais',
    stageLabel: 'Semifinal B',
    blockNumber: 4,
    slotALabel: 'V8',
    slotBLabel: 'V10',
    destWinnerLabel: 'V12 → Final (14)',
    destLoserLabel: 'P12 → 3º/4º (13)',
    nextWinnerMatchNumber: 14,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 13,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 13,
    side: 'finals',
    roundIndex: 1,
    roundName: 'Finais (1º ao 4º)',
    stageLabel: 'Disputa de 3º/4º',
    blockNumber: 5,
    slotALabel: 'P11',
    slotBLabel: 'P12',
    destWinnerLabel: '3º Lugar',
    destLoserLabel: '4º Lugar',
    placementOnWin: 3,
    placementOnLoss: 4,
  },
  {
    matchNumber: 14,
    side: 'finals',
    roundIndex: 1,
    roundName: 'Finais (1º ao 4º)',
    stageLabel: 'Final (1º/2º)',
    blockNumber: 5,
    slotALabel: 'V11',
    slotBLabel: 'V12',
    destWinnerLabel: 'Campeão (1º)',
    destLoserLabel: 'Vice (2º)',
    placementOnWin: 1,
    placementOnLoss: 2,
  },
];

/**
 * 4-Team Hybrid Double-Elimination (6 Matches, 0 BYEs)
 * All 4 teams play Round 1; losers play Repescagem; V1xV2 winner goes to Final, loser crosses into Repescagem Final.
 */
const HYBRID_4_SPECS: HybridNodeSpec[] = [
  {
    matchNumber: 1,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 0,
    entryBIndex: 1,
    slotALabel: 'Entrada 1',
    slotBLabel: 'Entrada 2',
    destWinnerLabel: 'V1 → Jogo 4',
    destLoserLabel: 'P1 → Repescagem (3)',
    nextWinnerMatchNumber: 4,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 3,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 2,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 2,
    entryBIndex: 3,
    slotALabel: 'Entrada 3',
    slotBLabel: 'Entrada 4',
    destWinnerLabel: 'V2 → Jogo 4',
    destLoserLabel: 'P2 → Repescagem (3)',
    nextWinnerMatchNumber: 4,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 3,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 3,
    side: 'losers',
    roundIndex: 0,
    roundName: 'Repescagem R1',
    stageLabel: 'Repescagem R1',
    blockNumber: 2,
    slotALabel: 'P2',
    slotBLabel: 'P1',
    destWinnerLabel: 'V3 → Jogo 5',
    destLoserLabel: '4º Lugar',
    nextWinnerMatchNumber: 5,
    nextWinnerSlot: 'B',
    placementOnLoss: 4,
  },
  {
    matchNumber: 4,
    side: 'winners',
    roundIndex: 1,
    roundName: 'Classificatório Vencedores',
    stageLabel: 'Classif. Vencedores',
    blockNumber: 2,
    slotALabel: 'V1',
    slotBLabel: 'V2',
    destWinnerLabel: 'V4 → Final (6)',
    destLoserLabel: 'P4 → Repescagem (5)',
    nextWinnerMatchNumber: 6,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 5,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 5,
    side: 'losers',
    roundIndex: 1,
    roundName: 'Classificatório Repescagem',
    stageLabel: 'Classif. Repescagem',
    blockNumber: 3,
    slotALabel: 'P4',
    slotBLabel: 'V3',
    destWinnerLabel: 'V5 → Final (6)',
    destLoserLabel: '3º Lugar',
    nextWinnerMatchNumber: 6,
    nextWinnerSlot: 'B',
    placementOnLoss: 3,
  },
  {
    matchNumber: 6,
    side: 'finals',
    roundIndex: 0,
    roundName: 'Grande Final',
    stageLabel: 'Final (1º/2º)',
    blockNumber: 4,
    slotALabel: 'V4',
    slotBLabel: 'V5',
    destWinnerLabel: 'Campeão (1º)',
    destLoserLabel: 'Vice (2º)',
    placementOnWin: 1,
    placementOnLoss: 2,
  },
];

/**
 * 5-Team Lean Hybrid Double-Elimination (8 Matches, 0 ghost slots)
 * E1xE2 and E3xE4 play R1; E5 enters R2 against V1; losers play Repescagem -> Semifinals -> 3rd/4th + Final.
 */
const HYBRID_5_SPECS: HybridNodeSpec[] = [
  {
    matchNumber: 1,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 0,
    entryBIndex: 1,
    slotALabel: 'Entrada 1',
    slotBLabel: 'Entrada 2',
    destWinnerLabel: 'V1 → Jogo 3',
    destLoserLabel: 'P1 → Repescagem (4)',
    nextWinnerMatchNumber: 3,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 4,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 2,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 2,
    entryBIndex: 3,
    slotALabel: 'Entrada 3',
    slotBLabel: 'Entrada 4',
    destWinnerLabel: 'V2 → Semifinal B (6)',
    destLoserLabel: 'P2 → Repescagem (4)',
    nextWinnerMatchNumber: 6,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 4,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 3,
    side: 'winners',
    roundIndex: 1,
    roundName: 'Rodada 2',
    stageLabel: 'Classif. Vencedores',
    blockNumber: 2,
    entryBIndex: 4,
    slotALabel: 'V1',
    slotBLabel: 'Entrada 5',
    destWinnerLabel: 'V3 → Semifinal A (5)',
    destLoserLabel: 'P3 → Semifinal B (6)',
    nextWinnerMatchNumber: 5,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 6,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 4,
    side: 'losers',
    roundIndex: 0,
    roundName: 'Repescagem',
    stageLabel: 'Repescagem R1',
    blockNumber: 2,
    slotALabel: 'P2',
    slotBLabel: 'P1',
    destWinnerLabel: 'V4 → Semifinal A (5)',
    destLoserLabel: 'Eliminado (5º)',
    nextWinnerMatchNumber: 5,
    nextWinnerSlot: 'B',
  },
  {
    matchNumber: 5,
    side: 'finals',
    roundIndex: 0,
    roundName: 'Semifinais',
    stageLabel: 'Semifinal A',
    blockNumber: 3,
    slotALabel: 'V3',
    slotBLabel: 'V4',
    destWinnerLabel: 'V5 → Final (8)',
    destLoserLabel: 'P5 → 3º/4º (7)',
    nextWinnerMatchNumber: 8,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 7,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 6,
    side: 'finals',
    roundIndex: 0,
    roundName: 'Semifinais',
    stageLabel: 'Semifinal B',
    blockNumber: 3,
    slotALabel: 'V2',
    slotBLabel: 'P3',
    destWinnerLabel: 'V6 → Final (8)',
    destLoserLabel: 'P6 → 3º/4º (7)',
    nextWinnerMatchNumber: 8,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 7,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 7,
    side: 'finals',
    roundIndex: 1,
    roundName: 'Finais (1º ao 4º)',
    stageLabel: 'Disputa de 3º/4º',
    blockNumber: 4,
    slotALabel: 'P5',
    slotBLabel: 'P6',
    destWinnerLabel: '3º Lugar',
    destLoserLabel: '4º Lugar',
    placementOnWin: 3,
    placementOnLoss: 4,
  },
  {
    matchNumber: 8,
    side: 'finals',
    roundIndex: 1,
    roundName: 'Finais (1º ao 4º)',
    stageLabel: 'Final (1º/2º)',
    blockNumber: 4,
    slotALabel: 'V5',
    slotBLabel: 'V6',
    destWinnerLabel: 'Campeão (1º)',
    destLoserLabel: 'Vice (2º)',
    placementOnWin: 1,
    placementOnLoss: 2,
  },
];

/**
 * 6-Team Hybrid Double-Elimination (10 Matches, 0 BYEs)
 * All 6 teams play R1; P1..P3 enter Repescagem R1/R2; V5, V3, V6, P5 contest Semifinals -> 3rd/4th + Final.
 */
const HYBRID_6_SPECS: HybridNodeSpec[] = [
  {
    matchNumber: 1,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 0,
    entryBIndex: 1,
    slotALabel: 'Entrada 1',
    slotBLabel: 'Entrada 2',
    destWinnerLabel: 'V1 → Jogo 5',
    destLoserLabel: 'P1 → Repescagem (4)',
    nextWinnerMatchNumber: 5,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 4,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 2,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 2,
    entryBIndex: 3,
    slotALabel: 'Entrada 3',
    slotBLabel: 'Entrada 4',
    destWinnerLabel: 'V2 → Jogo 5',
    destLoserLabel: 'P2 → Repescagem (4)',
    nextWinnerMatchNumber: 5,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 4,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 3,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 4,
    entryBIndex: 5,
    slotALabel: 'Entrada 5',
    slotBLabel: 'Entrada 6',
    destWinnerLabel: 'V3 → Semifinal B (8)',
    destLoserLabel: 'P3 → Repescagem (6)',
    nextWinnerMatchNumber: 8,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 6,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 4,
    side: 'losers',
    roundIndex: 0,
    roundName: 'Repescagem R1',
    stageLabel: 'Repescagem R1',
    blockNumber: 2,
    slotALabel: 'P2',
    slotBLabel: 'P1',
    destWinnerLabel: 'V4 → Jogo 6',
    destLoserLabel: 'Eliminado (6º)',
    nextWinnerMatchNumber: 6,
    nextWinnerSlot: 'B',
  },
  {
    matchNumber: 5,
    side: 'winners',
    roundIndex: 1,
    roundName: 'Classificatório Vencedores',
    stageLabel: 'Classif. Vencedores',
    blockNumber: 2,
    slotALabel: 'V1',
    slotBLabel: 'V2',
    destWinnerLabel: 'V5 → Semifinal A (7)',
    destLoserLabel: 'P5 → Semifinal B (8)',
    nextWinnerMatchNumber: 7,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 8,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 6,
    side: 'losers',
    roundIndex: 1,
    roundName: 'Classificatório Repescagem',
    stageLabel: 'Repescagem R2',
    blockNumber: 3,
    slotALabel: 'P3',
    slotBLabel: 'V4',
    destWinnerLabel: 'V6 → Semifinal A (7)',
    destLoserLabel: 'Eliminado (5º)',
    nextWinnerMatchNumber: 7,
    nextWinnerSlot: 'B',
  },
  {
    matchNumber: 7,
    side: 'finals',
    roundIndex: 0,
    roundName: 'Semifinais',
    stageLabel: 'Semifinal A',
    blockNumber: 4,
    slotALabel: 'V5',
    slotBLabel: 'V6',
    destWinnerLabel: 'V7 → Final (10)',
    destLoserLabel: 'P7 → 3º/4º (9)',
    nextWinnerMatchNumber: 10,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 9,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 8,
    side: 'finals',
    roundIndex: 0,
    roundName: 'Semifinais',
    stageLabel: 'Semifinal B',
    blockNumber: 4,
    slotALabel: 'V3',
    slotBLabel: 'P5',
    destWinnerLabel: 'V8 → Final (10)',
    destLoserLabel: 'P8 → 3º/4º (9)',
    nextWinnerMatchNumber: 10,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 9,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 9,
    side: 'finals',
    roundIndex: 1,
    roundName: 'Finais (1º ao 4º)',
    stageLabel: 'Disputa de 3º/4º',
    blockNumber: 5,
    slotALabel: 'P7',
    slotBLabel: 'P8',
    destWinnerLabel: '3º Lugar',
    destLoserLabel: '4º Lugar',
    placementOnWin: 3,
    placementOnLoss: 4,
  },
  {
    matchNumber: 10,
    side: 'finals',
    roundIndex: 1,
    roundName: 'Finais (1º ao 4º)',
    stageLabel: 'Final (1º/2º)',
    blockNumber: 5,
    slotALabel: 'V7',
    slotBLabel: 'V8',
    destWinnerLabel: 'Campeão (1º)',
    destLoserLabel: 'Vice (2º)',
    placementOnWin: 1,
    placementOnLoss: 2,
  },
];

/**
 * 12-Team Hybrid Double-Elimination (22 Matches, 0 BYEs)
 * All 12 teams play R1; inverted Repescagem R1; anti-revanche crossover into Semifinals -> 3rd/4th + Final.
 */
const HYBRID_12_SPECS: HybridNodeSpec[] = [
  // R1 Vencedores (1..6)
  {
    matchNumber: 1,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 0,
    entryBIndex: 1,
    slotALabel: 'Entrada 1',
    slotBLabel: 'Entrada 2',
    destWinnerLabel: 'V1 → Jogo 10',
    destLoserLabel: 'P1 → Jogo 9',
    nextWinnerMatchNumber: 10,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 9,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 2,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 2,
    entryBIndex: 3,
    slotALabel: 'Entrada 3',
    slotBLabel: 'Entrada 4',
    destWinnerLabel: 'V2 → Jogo 10',
    destLoserLabel: 'P2 → Jogo 9',
    nextWinnerMatchNumber: 10,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 9,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 3,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 4,
    entryBIndex: 5,
    slotALabel: 'Entrada 5',
    slotBLabel: 'Entrada 6',
    destWinnerLabel: 'V3 → Jogo 11',
    destLoserLabel: 'P3 → Jogo 8',
    nextWinnerMatchNumber: 11,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 8,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 4,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 6,
    entryBIndex: 7,
    slotALabel: 'Entrada 7',
    slotBLabel: 'Entrada 8',
    destWinnerLabel: 'V4 → Jogo 11',
    destLoserLabel: 'P4 → Jogo 8',
    nextWinnerMatchNumber: 11,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 8,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 5,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 8,
    entryBIndex: 9,
    slotALabel: 'Entrada 9',
    slotBLabel: 'Entrada 10',
    destWinnerLabel: 'V5 → Jogo 12',
    destLoserLabel: 'P5 → Jogo 7',
    nextWinnerMatchNumber: 12,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 7,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 6,
    side: 'winners',
    roundIndex: 0,
    roundName: 'Rodada 1',
    stageLabel: 'Rodada 1',
    blockNumber: 1,
    entryAIndex: 10,
    entryBIndex: 11,
    slotALabel: 'Entrada 11',
    slotBLabel: 'Entrada 12',
    destWinnerLabel: 'V6 → Jogo 12',
    destLoserLabel: 'P6 → Jogo 7',
    nextWinnerMatchNumber: 12,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 7,
    nextLoserSlot: 'A',
  },
  // Repescagem R1 invertida (7..9)
  {
    matchNumber: 7,
    side: 'losers',
    roundIndex: 0,
    roundName: 'Repescagem R1',
    stageLabel: 'Repescagem R1',
    blockNumber: 2,
    slotALabel: 'P6',
    slotBLabel: 'P5',
    destWinnerLabel: 'V7 → Jogo 13',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 13,
    nextWinnerSlot: 'A',
  },
  {
    matchNumber: 8,
    side: 'losers',
    roundIndex: 0,
    roundName: 'Repescagem R1',
    stageLabel: 'Repescagem R1',
    blockNumber: 2,
    slotALabel: 'P4',
    slotBLabel: 'P3',
    destWinnerLabel: 'V8 → Jogo 14',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 14,
    nextWinnerSlot: 'A',
  },
  {
    matchNumber: 9,
    side: 'losers',
    roundIndex: 0,
    roundName: 'Repescagem R1',
    stageLabel: 'Repescagem R1',
    blockNumber: 2,
    slotALabel: 'P2',
    slotBLabel: 'P1',
    destWinnerLabel: 'V9 → Jogo 15',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 15,
    nextWinnerSlot: 'A',
  },
  // R2 Vencedores (10..12)
  {
    matchNumber: 10,
    side: 'winners',
    roundIndex: 1,
    roundName: 'Rodada 2',
    stageLabel: 'Rodada 2',
    blockNumber: 2,
    slotALabel: 'V1',
    slotBLabel: 'V2',
    destWinnerLabel: 'V10 → Jogo 16',
    destLoserLabel: 'P10 → Jogo 13',
    nextWinnerMatchNumber: 16,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 13,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 11,
    side: 'winners',
    roundIndex: 1,
    roundName: 'Rodada 2',
    stageLabel: 'Rodada 2',
    blockNumber: 2,
    slotALabel: 'V3',
    slotBLabel: 'V4',
    destWinnerLabel: 'V11 → Jogo 16',
    destLoserLabel: 'P11 → Jogo 14',
    nextWinnerMatchNumber: 16,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 14,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 12,
    side: 'winners',
    roundIndex: 1,
    roundName: 'Rodada 2',
    stageLabel: 'Rodada 2',
    blockNumber: 2,
    slotALabel: 'V5',
    slotBLabel: 'V6',
    destWinnerLabel: 'V12 → Semifinal B (20)',
    destLoserLabel: 'P12 → Jogo 15',
    nextWinnerMatchNumber: 20,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 15,
    nextLoserSlot: 'B',
  },
  // Repescagem R2 (13..15)
  {
    matchNumber: 13,
    side: 'losers',
    roundIndex: 1,
    roundName: 'Repescagem R2',
    stageLabel: 'Repescagem R2',
    blockNumber: 3,
    slotALabel: 'V7',
    slotBLabel: 'P10',
    destWinnerLabel: 'V13 → Jogo 17',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 17,
    nextWinnerSlot: 'A',
  },
  {
    matchNumber: 14,
    side: 'losers',
    roundIndex: 1,
    roundName: 'Repescagem R2',
    stageLabel: 'Repescagem R2',
    blockNumber: 3,
    slotALabel: 'V8',
    slotBLabel: 'P11',
    destWinnerLabel: 'V14 → Jogo 17',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 17,
    nextWinnerSlot: 'B',
  },
  {
    matchNumber: 15,
    side: 'losers',
    roundIndex: 1,
    roundName: 'Repescagem R2',
    stageLabel: 'Repescagem R2',
    blockNumber: 3,
    slotALabel: 'V9',
    slotBLabel: 'P12',
    destWinnerLabel: 'V15 → Semifinal A (19)',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 19,
    nextWinnerSlot: 'B',
  },
  // Classificatório Vencedores (16) & Repescagem R3 (17)
  {
    matchNumber: 16,
    side: 'winners',
    roundIndex: 2,
    roundName: 'Classificatório Vencedores',
    stageLabel: 'Classif. Vencedores',
    blockNumber: 3,
    slotALabel: 'V10',
    slotBLabel: 'V11',
    destWinnerLabel: 'V16 → Semifinal A (19)',
    destLoserLabel: 'P16 → Jogo 18',
    nextWinnerMatchNumber: 19,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 18,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 17,
    side: 'losers',
    roundIndex: 2,
    roundName: 'Repescagem R3',
    stageLabel: 'Repescagem R3',
    blockNumber: 4,
    slotALabel: 'V13',
    slotBLabel: 'V14',
    destWinnerLabel: 'V17 → Jogo 18',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 18,
    nextWinnerSlot: 'B',
  },
  {
    matchNumber: 18,
    side: 'losers',
    roundIndex: 3,
    roundName: 'Classificatório Repescagem',
    stageLabel: 'Classif. Repescagem',
    blockNumber: 5,
    slotALabel: 'P16',
    slotBLabel: 'V17',
    destWinnerLabel: 'V18 → Semifinal B (20)',
    destLoserLabel: 'Eliminado',
    nextWinnerMatchNumber: 20,
    nextWinnerSlot: 'B',
  },
  // Fase Final (19..22)
  {
    matchNumber: 19,
    side: 'finals',
    roundIndex: 0,
    roundName: 'Semifinais',
    stageLabel: 'Semifinal A',
    blockNumber: 6,
    slotALabel: 'V16',
    slotBLabel: 'V15',
    destWinnerLabel: 'V19 → Final (22)',
    destLoserLabel: 'P19 → 3º/4º (21)',
    nextWinnerMatchNumber: 22,
    nextWinnerSlot: 'A',
    nextLoserMatchNumber: 21,
    nextLoserSlot: 'A',
  },
  {
    matchNumber: 20,
    side: 'finals',
    roundIndex: 0,
    roundName: 'Semifinais',
    stageLabel: 'Semifinal B',
    blockNumber: 6,
    slotALabel: 'V12',
    slotBLabel: 'V18',
    destWinnerLabel: 'V20 → Final (22)',
    destLoserLabel: 'P20 → 3º/4º (21)',
    nextWinnerMatchNumber: 22,
    nextWinnerSlot: 'B',
    nextLoserMatchNumber: 21,
    nextLoserSlot: 'B',
  },
  {
    matchNumber: 21,
    side: 'finals',
    roundIndex: 1,
    roundName: 'Finais (1º ao 4º)',
    stageLabel: 'Disputa de 3º/4º',
    blockNumber: 7,
    slotALabel: 'P19',
    slotBLabel: 'P20',
    destWinnerLabel: '3º Lugar',
    destLoserLabel: '4º Lugar',
    placementOnWin: 3,
    placementOnLoss: 4,
  },
  {
    matchNumber: 22,
    side: 'finals',
    roundIndex: 1,
    roundName: 'Finais (1º ao 4º)',
    stageLabel: 'Final (1º/2º)',
    blockNumber: 7,
    slotALabel: 'V19',
    slotBLabel: 'V20',
    destWinnerLabel: 'Campeão (1º)',
    destLoserLabel: 'Vice (2º)',
    placementOnWin: 1,
    placementOnLoss: 2,
  },
];

/**
 * Compact definition used to declare the odd-sized hybrid graphs (7, 9, 11, 13).
 * Sources: a number = 0-based entry index (team enters directly in this match),
 * `V{n}` = winner of match n, `P{n}` = loser of match n.
 * Routing (nextWinner/nextLoser) and all labels are derived automatically,
 * which guarantees every outcome has exactly one destination (no orphans).
 */
type CompactSource = number | `V${number}` | `P${number}`;

interface CompactHybridDef {
  n: number;
  side: 'winners' | 'losers' | 'finals';
  round: number;
  roundName: string;
  stage: string;
  block: number;
  a: CompactSource;
  b: CompactSource;
  place?: 'final' | 'third';
}

function buildCompactHybridSpecs(defs: CompactHybridDef[]): HybridNodeSpec[] {
  const byNumber = new Map(defs.map((d) => [d.n, d]));
  const winnerDest = new Map<number, { match: number; slot: 'A' | 'B' }>();
  const loserDest = new Map<number, { match: number; slot: 'A' | 'B' }>();

  for (const d of defs) {
    (['a', 'b'] as const).forEach((key) => {
      const src = d[key];
      if (typeof src === 'number') return;
      const from = Number(src.slice(1));
      const target = src.startsWith('V') ? winnerDest : loserDest;
      if (target.has(from)) {
        throw new Error(`Hybrid spec: outcome ${src} routed twice`);
      }
      target.set(from, { match: d.n, slot: key === 'a' ? 'A' : 'B' });
    });
  }

  const labelOf = (src: CompactSource) =>
    typeof src === 'number' ? `Entrada ${src + 1}` : src;
  const destText = (prefix: string, n: number, dest: { match: number }) => {
    const target = byNumber.get(dest.match);
    const suffix =
      target?.side === 'losers'
        ? ' (Repescagem)'
        : target?.side === 'finals'
          ? ` (${target.stage})`
          : '';
    return `${prefix}${n} → Jogo ${dest.match}${suffix}`;
  };

  return defs.map((d) => {
    const w = winnerDest.get(d.n);
    const l = loserDest.get(d.n);
    let destWinnerLabel = w ? destText('V', d.n, w) : '';
    let destLoserLabel = l ? destText('P', d.n, l) : 'Eliminado';
    if (d.place === 'final') {
      destWinnerLabel = 'Campeão (1º)';
      destLoserLabel = 'Vice (2º)';
    } else if (d.place === 'third') {
      destWinnerLabel = '3º Lugar';
      destLoserLabel = '4º Lugar';
    }

    return {
      matchNumber: d.n,
      side: d.side,
      roundIndex: d.round,
      roundName: d.roundName,
      stageLabel: d.stage,
      blockNumber: d.block,
      entryAIndex: typeof d.a === 'number' ? d.a : undefined,
      entryBIndex: typeof d.b === 'number' ? d.b : undefined,
      slotALabel: labelOf(d.a),
      slotBLabel: labelOf(d.b),
      destWinnerLabel,
      destLoserLabel,
      nextWinnerMatchNumber: w?.match,
      nextWinnerSlot: w?.slot,
      nextLoserMatchNumber: l?.match,
      nextLoserSlot: l?.slot,
      placementOnWin: d.place === 'final' ? 1 : d.place === 'third' ? 3 : undefined,
      placementOnLoss: d.place === 'final' ? 2 : d.place === 'third' ? 4 : undefined,
    };
  });
}

const W = 'winners' as const;
const L = 'losers' as const;
const F = 'finals' as const;

function finalFour(
  first: number,
  block: number,
  semiA: [CompactSource, CompactSource],
  semiB: [CompactSource, CompactSource],
): CompactHybridDef[] {
  const sA = first;
  const sB = first + 1;
  return [
    { n: sA, side: F, round: 0, roundName: 'Semifinais', stage: 'Semifinal A', block, a: semiA[0], b: semiA[1] },
    { n: sB, side: F, round: 0, roundName: 'Semifinais', stage: 'Semifinal B', block, a: semiB[0], b: semiB[1] },
    { n: first + 2, side: F, round: 1, roundName: 'Finais (1º ao 4º)', stage: 'Disputa de 3º/4º', block: block + 1, a: `P${sA}`, b: `P${sB}`, place: 'third' },
    { n: first + 3, side: F, round: 1, roundName: 'Finais (1º ao 4º)', stage: 'Final (1º/2º)', block: block + 1, a: `V${sA}`, b: `V${sB}`, place: 'final' },
  ];
}

/**
 * 7 duplas — 12 jogos (2N-2), 1 única folga na abertura (Entrada 7 estreia na Rodada 2).
 * Vencedores: 3 jogos R1 + 2 jogos R2 → 2 invictos. Repescagem: P2xP1, depois cruzamento
 * (V6xP5 / P3xP4) evitando revanche imediata. Semis cruzadas: V4xV7 e V5xV8.
 */
const HYBRID_7_SPECS: HybridNodeSpec[] = buildCompactHybridSpecs([
  { n: 1, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 0, b: 1 },
  { n: 2, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 2, b: 3 },
  { n: 3, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 4, b: 5 },
  { n: 4, side: W, round: 1, roundName: 'Classificatórios', stage: 'Classificatório A', block: 2, a: 'V1', b: 'V2' },
  { n: 5, side: W, round: 1, roundName: 'Classificatórios', stage: 'Classificatório B', block: 2, a: 'V3', b: 6 },
  { n: 6, side: L, round: 0, roundName: 'Repescagem R1', stage: 'Repescagem R1', block: 2, a: 'P2', b: 'P1' },
  { n: 7, side: L, round: 1, roundName: 'Classif. Repescagem', stage: 'Classif. Repescagem A', block: 3, a: 'V6', b: 'P5' },
  { n: 8, side: L, round: 1, roundName: 'Classif. Repescagem', stage: 'Classif. Repescagem B', block: 3, a: 'P3', b: 'P4' },
  ...finalFour(9, 4, ['V4', 'V7'], ['V5', 'V8']),
]);

/**
 * 9 duplas — 16 jogos, 1 folga na abertura (Entrada 9 estreia na Rodada 2).
 * Vencedores: 4 R1 + 2 R2 + 1 classificatório → 2 invictos (V6 e V7).
 * Repescagem: P4xP3 / P2xP1 (ordem invertida), cruzamento com P5/P6 e P7 → 2 sobreviventes.
 */
const HYBRID_9_SPECS: HybridNodeSpec[] = buildCompactHybridSpecs([
  { n: 1, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 0, b: 1 },
  { n: 2, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 2, b: 3 },
  { n: 3, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 4, b: 5 },
  { n: 4, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 6, b: 7 },
  { n: 5, side: W, round: 1, roundName: 'Rodada 2', stage: 'Rodada 2', block: 2, a: 'V1', b: 'V2' },
  { n: 6, side: W, round: 1, roundName: 'Rodada 2', stage: 'Classificatório B', block: 2, a: 'V3', b: 8 },
  { n: 7, side: W, round: 2, roundName: 'Classificatório', stage: 'Classificatório A', block: 3, a: 'V4', b: 'V5' },
  { n: 8, side: L, round: 0, roundName: 'Repescagem R1', stage: 'Repescagem R1', block: 2, a: 'P4', b: 'P3' },
  { n: 9, side: L, round: 0, roundName: 'Repescagem R1', stage: 'Repescagem R1', block: 2, a: 'P2', b: 'P1' },
  { n: 10, side: L, round: 1, roundName: 'Repescagem R2', stage: 'Repescagem R2', block: 3, a: 'V8', b: 'P5' },
  { n: 11, side: L, round: 1, roundName: 'Repescagem R2', stage: 'Repescagem R2', block: 3, a: 'V9', b: 'P6' },
  { n: 12, side: L, round: 2, roundName: 'Classif. Repescagem', stage: 'Classif. Repescagem B', block: 4, a: 'V11', b: 'P7' },
  ...finalFour(13, 5, ['V7', 'V10'], ['V6', 'V12']),
]);

/**
 * 11 duplas — 20 jogos, 1 folga na abertura (Entrada 11 estreia na Rodada 2).
 * Vencedores: 5 R1 + 3 R2 + 1 classificatório → 2 invictos (V6 e V9).
 * Repescagem: P5xP4 / P3xP2, P1 entra na R2 contra P7; cruzamentos evitam revanche imediata.
 */
const HYBRID_11_SPECS: HybridNodeSpec[] = buildCompactHybridSpecs([
  { n: 1, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 0, b: 1 },
  { n: 2, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 2, b: 3 },
  { n: 3, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 4, b: 5 },
  { n: 4, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 6, b: 7 },
  { n: 5, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 8, b: 9 },
  { n: 6, side: W, round: 1, roundName: 'Rodada 2', stage: 'Classificatório A', block: 2, a: 'V1', b: 'V2' },
  { n: 7, side: W, round: 1, roundName: 'Rodada 2', stage: 'Rodada 2', block: 2, a: 'V3', b: 'V4' },
  { n: 8, side: W, round: 1, roundName: 'Rodada 2', stage: 'Rodada 2', block: 2, a: 'V5', b: 10 },
  { n: 9, side: W, round: 2, roundName: 'Classificatório', stage: 'Classificatório B', block: 3, a: 'V7', b: 'V8' },
  { n: 10, side: L, round: 0, roundName: 'Repescagem R1', stage: 'Repescagem R1', block: 2, a: 'P5', b: 'P4' },
  { n: 11, side: L, round: 0, roundName: 'Repescagem R1', stage: 'Repescagem R1', block: 2, a: 'P3', b: 'P2' },
  { n: 12, side: L, round: 1, roundName: 'Repescagem R2', stage: 'Repescagem R2', block: 3, a: 'V10', b: 'P6' },
  { n: 13, side: L, round: 1, roundName: 'Repescagem R2', stage: 'Repescagem R2', block: 3, a: 'V11', b: 'P8' },
  { n: 14, side: L, round: 1, roundName: 'Repescagem R2', stage: 'Repescagem R2', block: 3, a: 'P1', b: 'P7' },
  { n: 15, side: L, round: 2, roundName: 'Classif. Repescagem', stage: 'Classif. Repescagem A', block: 4, a: 'P9', b: 'V12' },
  { n: 16, side: L, round: 2, roundName: 'Classif. Repescagem', stage: 'Classif. Repescagem B', block: 4, a: 'V13', b: 'V14' },
  ...finalFour(17, 5, ['V6', 'V15'], ['V9', 'V16']),
]);

/**
 * 13 duplas — 24 jogos, 1 folga na abertura (Entrada 13 estreia na Rodada 2).
 * Vencedores: 6 R1 + 3 R2 + 2 classificatórios → 2 invictos (V10 e V11).
 * Repescagem: P6xP5 / P4xP3 / P2xP1, cruzamento rotativo com P7..P9, e P10/P11
 * cruzam de lado (como P21/P22 no formato de 16) para evitar revanche nas semifinais.
 */
const HYBRID_13_SPECS: HybridNodeSpec[] = buildCompactHybridSpecs([
  { n: 1, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 0, b: 1 },
  { n: 2, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 2, b: 3 },
  { n: 3, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 4, b: 5 },
  { n: 4, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 6, b: 7 },
  { n: 5, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 8, b: 9 },
  { n: 6, side: W, round: 0, roundName: 'Rodada 1', stage: 'Rodada 1', block: 1, a: 10, b: 11 },
  { n: 7, side: W, round: 1, roundName: 'Rodada 2', stage: 'Rodada 2', block: 2, a: 'V1', b: 'V2' },
  { n: 8, side: W, round: 1, roundName: 'Rodada 2', stage: 'Rodada 2', block: 2, a: 'V3', b: 'V4' },
  { n: 9, side: W, round: 1, roundName: 'Rodada 2', stage: 'Rodada 2', block: 2, a: 'V5', b: 12 },
  { n: 10, side: W, round: 2, roundName: 'Classificatórios', stage: 'Classificatório A', block: 3, a: 'V7', b: 'V8' },
  { n: 11, side: W, round: 2, roundName: 'Classificatórios', stage: 'Classificatório B', block: 3, a: 'V6', b: 'V9' },
  { n: 12, side: L, round: 0, roundName: 'Repescagem R1', stage: 'Repescagem R1', block: 2, a: 'P6', b: 'P5' },
  { n: 13, side: L, round: 0, roundName: 'Repescagem R1', stage: 'Repescagem R1', block: 2, a: 'P4', b: 'P3' },
  { n: 14, side: L, round: 0, roundName: 'Repescagem R1', stage: 'Repescagem R1', block: 2, a: 'P2', b: 'P1' },
  { n: 15, side: L, round: 1, roundName: 'Repescagem R2', stage: 'Repescagem R2', block: 3, a: 'V12', b: 'P7' },
  { n: 16, side: L, round: 1, roundName: 'Repescagem R2', stage: 'Repescagem R2', block: 3, a: 'V13', b: 'P9' },
  { n: 17, side: L, round: 1, roundName: 'Repescagem R2', stage: 'Repescagem R2', block: 3, a: 'V14', b: 'P8' },
  { n: 18, side: L, round: 2, roundName: 'Repescagem R3', stage: 'Repescagem R3', block: 4, a: 'V15', b: 'V16' },
  { n: 19, side: L, round: 3, roundName: 'Classif. Repescagem', stage: 'Classif. Repescagem A', block: 5, a: 'P10', b: 'V18' },
  { n: 20, side: L, round: 3, roundName: 'Classif. Repescagem', stage: 'Classif. Repescagem B', block: 5, a: 'P11', b: 'V17' },
  ...finalFour(21, 6, ['V10', 'V20'], ['V11', 'V19']),
]);

function buildEntrySlots(teamIds: string[], size: number): Array<string | 'BYE'> {
  if (teamIds.length === size) {
    return [...teamIds];
  }
  const matchCount = Math.floor(size / 2);
  const slots: Array<string | 'BYE'> = Array.from({ length: size }, () => 'BYE');

  const spreadOrder =
    matchCount === 8
      ? [0, 4, 2, 6, 1, 5, 3, 7]
      : matchCount === 4
        ? [0, 2, 1, 3]
        : Array.from({ length: matchCount }, (_, i) => i);

  let idx = 0;
  for (let m = 0; m < matchCount && idx < teamIds.length; m += 1) {
    const matchIdx = spreadOrder[m];
    slots[matchIdx * 2] = teamIds[idx++];
  }
  for (let m = 0; m < matchCount && idx < teamIds.length; m += 1) {
    const matchIdx = spreadOrder[m];
    slots[matchIdx * 2 + 1] = teamIds[idx++];
  }
  return slots;
}

function buildHybridBracketState(
  teamIds: string[],
  size: number,
  specs: HybridNodeSpec[],
  sport: SportConfig,
): BracketState {
  const entries = buildEntrySlots(teamIds, size);

  const matches: Match[] = specs.map((spec) => {
    const entryA = spec.entryAIndex !== undefined ? entries[spec.entryAIndex] : undefined;
    const entryB = spec.entryBIndex !== undefined ? entries[spec.entryBIndex] : undefined;

    return createMatchObject({
      matchNumber: spec.matchNumber,
      side: spec.side,
      roundIndex: spec.roundIndex,
      stageLabel: spec.stageLabel,
      blockNumber: spec.blockNumber,
      teamAId: entryA && entryA !== 'BYE' ? entryA : null,
      teamBId: entryB && entryB !== 'BYE' ? entryB : null,
      slotAIsBye: entryA === 'BYE',
      slotBIsBye: entryB === 'BYE',
      slotALabel: spec.slotALabel,
      slotBLabel: spec.slotBLabel,
      destWinnerLabel: spec.destWinnerLabel,
      destLoserLabel: spec.destLoserLabel,
      nextWinnerMatchNumber: spec.nextWinnerMatchNumber,
      nextWinnerSlot: spec.nextWinnerSlot,
      nextLoserMatchNumber: spec.nextLoserMatchNumber,
      nextLoserSlot: spec.nextLoserSlot,
      placementOnWin: spec.placementOnWin,
      placementOnLoss: spec.placementOnLoss,
      sport,
    });
  });

  const groupRounds = (side: 'winners' | 'losers' | 'finals'): BracketRound[] => {
    const sideSpecs = specs.filter((s) => s.side === side);
    const roundIndices = Array.from(new Set(sideSpecs.map((s) => s.roundIndex))).sort(
      (a, b) => a - b,
    );
    return roundIndices.map((rIdx) => {
      const roundName =
        sideSpecs.find((s) => s.roundIndex === rIdx)?.roundName ?? `Rodada ${rIdx + 1}`;
      const roundMatches = matches
        .filter((m) => m.side === side && m.roundIndex === rIdx)
        .sort((a, b) => a.matchNumber - b.matchNumber);
      return {
        roundIndex: rIdx,
        name: roundName,
        side,
        matches: roundMatches,
        processed: false,
      };
    });
  };

  return {
    isHybridGraph: true,
    bracketSize: size,
    winnersRounds: groupRounds('winners'),
    losersRounds: groupRounds('losers'),
    finalsRounds: groupRounds('finals'),
    losersAdvancingPool: [],
    losersStagingPool: [],
    byeHistoryTeamIds: [],
    eliminated: [],
    nextMatchNumber: specs.length + 1,
  };
}

/**
 * Propagates winners, losers, BYEs, eliminations, and final 1st–4th placements
 * through the Hybrid DAG bracket until reaching a fixed point.
 */
function propagateHybridBracket(tournament: Tournament): Tournament {
  const bracket = tournament.bracket;
  if (!bracket || !bracket.isHybridGraph) return tournament;

  const winnersRounds = bracket.winnersRounds.map((r) => ({
    ...r,
    matches: r.matches.map((m) => ({ ...m })),
  }));
  const losersRounds = bracket.losersRounds.map((r) => ({
    ...r,
    matches: r.matches.map((m) => ({ ...m })),
  }));
  const finalsRounds = (bracket.finalsRounds ?? []).map((r) => ({
    ...r,
    matches: r.matches.map((m) => ({ ...m })),
  }));

  const allMatches = [
    ...winnersRounds.flatMap((r) => r.matches),
    ...losersRounds.flatMap((r) => r.matches),
    ...finalsRounds.flatMap((r) => r.matches),
  ];
  const byNumber = new Map<number, Match>();
  for (const m of allMatches) {
    byNumber.set(m.matchNumber, m);
  }

  const eliminated: EliminationRecord[] = [...bracket.eliminated];
  const hasEliminated = (teamId: string) => eliminated.some((e) => e.teamId === teamId);

  let championId = tournament.championId;
  let runnerUpId = tournament.runnerUpId;
  let thirdPlaceId = tournament.thirdPlaceId;
  let fourthPlaceId = tournament.fourthPlaceId;

  const assignSlot = (
    target: Match,
    slot: 'A' | 'B',
    outcome: { kind: 'team'; teamId: string } | { kind: 'bye' },
  ): boolean => {
    if (slot === 'A') {
      if (outcome.kind === 'team') {
        if (target.teamAId === outcome.teamId && !target.slotAIsBye) return false;
        target.teamAId = outcome.teamId;
        target.slotAIsBye = false;
        return true;
      }
      if (target.slotAIsBye && target.teamAId === null) return false;
      target.teamAId = null;
      target.slotAIsBye = true;
      return true;
    }

    if (outcome.kind === 'team') {
      if (target.teamBId === outcome.teamId && !target.slotBIsBye) return false;
      target.teamBId = outcome.teamId;
      target.slotBIsBye = false;
      return true;
    }
    if (target.slotBIsBye && target.teamBId === null) return false;
    target.teamBId = null;
    target.slotBIsBye = true;
    return true;
  };

  let changed = true;
  let guard = 0;
  while (changed && guard < 100) {
    changed = false;
    guard += 1;

    // Auto-finish any pending match where both slots are resolved and at least one is BYE
    for (const m of allMatches) {
      if (m.status !== 'pending') continue;
      const aResolved = m.teamAId !== null || Boolean(m.slotAIsBye);
      const bResolved = m.teamBId !== null || Boolean(m.slotBIsBye);
      if (aResolved && bResolved && (m.slotAIsBye || m.slotBIsBye)) {
        m.isBye = true;
        m.status = 'finished';
        m.winnerId = m.teamAId ?? m.teamBId ?? undefined;
        m.loserId = undefined;
        m.finishedAt = Date.now();
        changed = true;
      }
    }

    // Route outcomes from finished matches
    for (const m of allMatches) {
      if (m.status !== 'finished') continue;

      const winOutcome: { kind: 'team'; teamId: string } | { kind: 'bye' } = m.winnerId
        ? { kind: 'team', teamId: m.winnerId }
        : { kind: 'bye' };

      const loseOutcome: { kind: 'team'; teamId: string } | { kind: 'bye' } =
        !m.isBye && m.loserId ? { kind: 'team', teamId: m.loserId } : { kind: 'bye' };

      if (m.nextWinnerMatchNumber && m.nextWinnerSlot) {
        const nextW = byNumber.get(m.nextWinnerMatchNumber);
        if (nextW && assignSlot(nextW, m.nextWinnerSlot, winOutcome)) {
          changed = true;
        }
      }

      if (m.nextLoserMatchNumber && m.nextLoserSlot) {
        const nextL = byNumber.get(m.nextLoserMatchNumber);
        if (nextL && assignSlot(nextL, m.nextLoserSlot, loseOutcome)) {
          changed = true;
        }
      } else if (
        !m.nextLoserMatchNumber &&
        !m.placementOnLoss &&
        !m.isBye &&
        m.loserId &&
        !hasEliminated(m.loserId)
      ) {
        eliminated.push({
          teamId: m.loserId,
          roundIndex: m.roundIndex,
          side: m.side === 'king_of_court' ? 'losers' : m.side,
          matchNumber: m.matchNumber,
          order: eliminated.length + 1,
        });
        changed = true;
      }

      if (m.placementOnWin === 1 && m.winnerId) championId = m.winnerId;
      if (m.placementOnLoss === 2 && m.loserId) runnerUpId = m.loserId;
      if (m.placementOnWin === 3 && m.winnerId) thirdPlaceId = m.winnerId;
      if (m.placementOnLoss === 3 && m.loserId) thirdPlaceId = m.loserId;
      if (m.placementOnLoss === 4 && m.loserId) fourthPlaceId = m.loserId;
    }
  }

  for (const r of [...winnersRounds, ...losersRounds, ...finalsRounds]) {
    r.processed = r.matches.every((m) => m.status === 'finished');
  }

  const allDone = allMatches.every((m) => m.status === 'finished');

  return {
    ...tournament,
    status: allDone ? 'finished' : tournament.status,
    publicStatus: allDone ? 'encerrado' : 'ativo',
    finishedAt: allDone ? (tournament.finishedAt ?? Date.now()) : tournament.finishedAt,
    championId,
    runnerUpId,
    thirdPlaceId,
    fourthPlaceId,
    bracket: {
      ...bracket,
      winnersRounds,
      losersRounds,
      finalsRounds,
      eliminated,
    },
  };
}

// --- Fallback Dynamic Bracket for 2 teams or >16 teams ---

function pickByeTeamIndex(teamIds: string[], byeHistoryTeamIds: string[]): number {
  for (let i = teamIds.length - 1; i >= 0; i -= 1) {
    if (!byeHistoryTeamIds.includes(teamIds[i])) {
      return i;
    }
  }
  return teamIds.length - 1;
}

function buildDynamicBracketRound(params: {
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
      ? params.teamIds.length === 2
        ? 'Final'
        : `Rodada ${params.roundIndex + 1} (Vencedores)`
      : params.isWinnersDone && params.teamIds.length === 2
        ? 'Final da Repescagem'
        : `Repescagem ${params.roundIndex + 1}`;

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

  // Futevôlei sempre segue a sequência automática e organizada definida pelo sistema, sem sorteio aleatório
  const shouldShuffle =
    tournament.sport.id === 'futevolei' ? false : Boolean(options?.shuffle);
  const orderedTeams = shouldShuffle
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
      thirdPlaceId: undefined,
      fourthPlaceId: undefined,
      bracket: undefined,
      kingOfCourt,
    };
  }

  // Exact Hybrid Fixed Graphs for 4, 5, 6, 8, 12, and 16 teams (zero ghost slots / zero undeserved BYEs)
  const hybridMap: Record<number, HybridNodeSpec[]> = {
    4: HYBRID_4_SPECS,
    5: HYBRID_5_SPECS,
    6: HYBRID_6_SPECS,
    7: HYBRID_7_SPECS,
    8: HYBRID_8_SPECS,
    9: HYBRID_9_SPECS,
    11: HYBRID_11_SPECS,
    12: HYBRID_12_SPECS,
    13: HYBRID_13_SPECS,
    16: HYBRID_16_SPECS,
  };
  const exactSpecs = hybridMap[teamIds.length];

  if (exactSpecs) {
    const bracket = buildHybridBracketState(
      teamIds,
      teamIds.length,
      exactSpecs,
      tournament.sport,
    );

    const initialized: Tournament = {
      ...tournament,
      teams: orderedTeams,
      status: 'in_progress',
      publicStatus: 'ativo',
      updatedAt: now,
      finishedAt: undefined,
      championId: undefined,
      runnerUpId: undefined,
      thirdPlaceId: undefined,
      fourthPlaceId: undefined,
      bracket,
      kingOfCourt: undefined,
    };
    return propagateHybridBracket(initialized);
  }

  // 2 teams or >16 teams fallback
  const { round, byeHistoryTeamIds, nextMatchNumber } = buildDynamicBracketRound({
    teamIds,
    side: 'winners',
    roundIndex: 0,
    sport: tournament.sport,
    byeHistoryTeamIds: [],
    nextMatchNumber: 1,
  });

  const bracket: BracketState = {
    isHybridGraph: false,
    winnersRounds: [round],
    losersRounds: [],
    finalsRounds: [],
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
    thirdPlaceId: undefined,
    fourthPlaceId: undefined,
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
  const finals = tournament.bracket?.finalsRounds?.flatMap((r) => r.matches) ?? [];
  return [...winners, ...losers, ...finals].sort((a, b) => a.matchNumber - b.matchNumber);
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
        finalsRounds: (tournament.bracket.finalsRounds ?? []).map((round) => ({
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

function advanceDynamicBracket(tournament: Tournament): Tournament {
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
      const built = buildDynamicBracketRound({
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

  const hasActiveLosersRound = losersRounds.some((r) => !r.processed);
  if (!hasActiveLosersRound && !losersChampionId) {
    const unfinishedWinnersIdx = winnersRounds.findIndex((r) => !r.processed);
    const waitingForWinners =
      unfinishedWinnersIdx !== -1 && losersRounds.length >= unfinishedWinnersIdx;

    if (!waitingForWinners) {
      const pool = [...losersAdvancingPool, ...losersStagingPool];
      if (pool.length >= 2) {
        const built = buildDynamicBracketRound({
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
      ...bracket,
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

  if (updated.bracket?.isHybridGraph) {
    return propagateHybridBracket(updated);
  }

  return advanceDynamicBracket(updated);
}

export function finishTournamentManually(tournament: Tournament): Tournament {
  const standings = computeStandings(tournament);
  const championId =
    tournament.championId ?? tournament.bracket?.winnersChampionId ?? standings[0]?.team.id;
  const withoutChamp = standings.filter((s) => s.team.id !== championId);
  const runnerUpId =
    tournament.runnerUpId ??
    tournament.bracket?.losersChampionId ??
    withoutChamp[0]?.team.id;

  const now = Date.now();
  let kingOfCourt = tournament.kingOfCourt;
  if (kingOfCourt) {
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
    publicStatus: 'encerrado',
    updatedAt: now,
    finishedAt: now,
    championId,
    runnerUpId,
    kingOfCourt,
  };
}

export function isPublicLinkActive(tournament: Tournament): boolean {
  return (
    tournament.status !== 'finished' &&
    tournament.publicStatus !== 'encerrado' &&
    Boolean(tournament.publicToken)
  );
}

export function resetTournament(
  tournament: Tournament,
  mode: 'matches_only' | 'all',
): Tournament {
  const now = Date.now();
  if (mode === 'all') {
    return {
      ...tournament,
      publicToken: createId('pub'),
      teams: [],
      status: 'setup',
      updatedAt: now,
      finishedAt: undefined,
      championId: undefined,
      runnerUpId: undefined,
      thirdPlaceId: undefined,
      fourthPlaceId: undefined,
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
        thirdPlaceId: undefined,
        fourthPlaceId: undefined,
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
    thirdPlaceId: undefined,
    fourthPlaceId: undefined,
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

  const champId = tournament.championId ?? tournament.bracket?.winnersChampionId;
  const runnerId = tournament.runnerUpId ?? tournament.bracket?.losersChampionId;
  const thirdId = tournament.thirdPlaceId;
  const fourthId = tournament.fourthPlaceId;

  const standings: TeamStanding[] = tournament.teams.map((team) => {
    const s = statsMap.get(team.id)!;
    const bestStreak = tournament.kingOfCourt?.bestStreakByTeam[team.id];
    let statusLabel = 'Em disputa';
    if (champId === team.id) {
      statusLabel = 'Campeão (1º)';
    } else if (runnerId === team.id) {
      statusLabel = 'Vice-campeão (2º)';
    } else if (thirdId === team.id) {
      statusLabel = '3º Lugar';
    } else if (fourthId === team.id) {
      statusLabel = '4º Lugar';
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

  const fixedRank = (id: string): number => {
    if (id === champId) return 1;
    if (id === runnerId) return 2;
    if (id === thirdId) return 3;
    if (id === fourthId) return 4;
    return 999;
  };

  standings.sort((a, b) => {
    const rA = fixedRank(a.team.id);
    const rB = fixedRank(b.team.id);
    if (rA !== rB) return rA - rB;

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

export function formatAutoTeamName(playerNames: string[], fallbackNumber = 1): string {
  const cleaned = playerNames.map((n) => n.trim()).filter(Boolean);
  if (cleaned.length > 0) {
    return cleaned.map((n) => n.split(/\s+/)[0]).join(' / ');
  }
  return `Dupla ${fallbackNumber}`;
}

export function isAutoGeneratedTeamName(
  teamName: string,
  playerNames: string[],
): boolean {
  const trimmed = teamName.trim();
  if (!trimmed) return true;
  if (/^(Dupla|Time)\s+\d+$/i.test(trimmed)) return true;

  const cleaned = playerNames.map((n) => n.trim()).filter(Boolean);
  if (cleaned.length === 0) return false;

  const firstNamesJoin = cleaned.map((n) => n.split(/\s+/)[0]).join(' / ');
  const fullNamesJoin = cleaned.join(' / ');

  return (
    trimmed.toLowerCase() === firstNamesJoin.toLowerCase() ||
    trimmed.toLowerCase() === fullNamesJoin.toLowerCase()
  );
}

/**
 * Updates teams/duplas in place without regenerating the bracket or resetting matches,
 * scores, history, or tournament progression.
 */
export function updateTournamentTeamsInPlace(
  tournament: Tournament,
  updatedTeams: Team[],
): Tournament {
  const existingById = new Map(tournament.teams.map((t) => [t.id, t]));

  const mergedTeams: Team[] = tournament.teams.map((originalTeam, idx) => {
    const incoming =
      updatedTeams.find((u) => u.id === originalTeam.id) ?? updatedTeams[idx];
    if (!incoming) return originalTeam;

    const cleanedPlayers = (incoming.players ?? [])
      .map((p) => ({ ...p, name: p.name.trim() }))
      .filter((p) => Boolean(p.name))
      .map((p, pIdx) => ({
        id: p.id || originalTeam.players[pIdx]?.id || createId('pl'),
        name: p.name,
        ...(p.number ? { number: p.number } : {}),
      }));

    const prevPlayerNames = originalTeam.players.map((p) => p.name);
    const newPlayerNames = cleanedPlayers.map((p) => p.name);
    const shouldAutoRefreshName =
      !incoming.name.trim() ||
      (incoming.name.trim() === originalTeam.name.trim() &&
        isAutoGeneratedTeamName(originalTeam.name, prevPlayerNames));

    const finalName = shouldAutoRefreshName
      ? formatAutoTeamName(newPlayerNames, idx + 1)
      : incoming.name.trim();

    return {
      ...originalTeam,
      ...incoming,
      id: originalTeam.id,
      name: finalName,
      players: cleanedPlayers,
    };
  });

  // If the tournament is still in 'setup', allow adding or removing teams as well
  if (tournament.status === 'setup') {
    const setupTeams: Team[] = updatedTeams.map((incoming, idx) => {
      const orig = existingById.get(incoming.id);
      const cleanedPlayers = (incoming.players ?? [])
        .map((p) => ({ ...p, name: p.name.trim() }))
        .filter((p) => Boolean(p.name))
        .map((p, pIdx) => ({
          id: p.id || orig?.players[pIdx]?.id || createId('pl'),
          name: p.name,
          ...(p.number ? { number: p.number } : {}),
        }));
      const finalName =
        incoming.name.trim() ||
        formatAutoTeamName(
          cleanedPlayers.map((p) => p.name),
          idx + 1,
        );
      return {
        ...incoming,
        id: orig?.id ?? incoming.id ?? createId('tm'),
        name: finalName,
        players: cleanedPlayers,
      };
    });

    return {
      ...tournament,
      teams: setupTeams,
      updatedAt: Date.now(),
    };
  }

  return {
    ...tournament,
    teams: mergedTeams,
    updatedAt: Date.now(),
  };
}

