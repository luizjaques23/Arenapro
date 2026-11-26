export type SportId =
  | 'futevolei'
  | 'futsal'
  | 'volei_praia'
  | 'beach_tennis'
  | 'outro';

export type ScoringMode = 'sets' | 'goals';

export type TournamentFormat = 'bracket' | 'king_of_court';

export type StatType = 'goal' | 'point' | 'ace' | 'block' | 'assist';

export interface SportConfig {
  id: SportId;
  label: string;
  customName?: string;
  scoringMode: ScoringMode;
  setsToWin: number;
  pointsPerSet: number;
  winByTwo: boolean;
  trackPlayerGoals: boolean;
  extraStatsEnabled: StatType[];
}

export interface Player {
  id: string;
  name: string;
  number?: string;
}

export interface Team {
  id: string;
  name: string;
  players: Player[];
  color: string;
  emblem: string;
  seed?: number;
}

export interface SetScore {
  setNumber: number;
  scoreA: number;
  scoreB: number;
  winnerId?: string;
}

export interface MatchStatEvent {
  id: string;
  teamId: string;
  playerId?: string;
  type: StatType;
  value: number;
  setNumber?: number;
  timestamp: number;
}

export type BracketSide = 'winners' | 'losers' | 'king_of_court';

export type MatchStatus = 'pending' | 'live' | 'finished';

export interface Match {
  id: string;
  matchNumber: number;
  side: BracketSide;
  roundIndex: number;
  teamAId: string | null;
  teamBId: string | null;
  isBye: boolean;
  status: MatchStatus;
  scoreA: number;
  scoreB: number;
  sets: SetScore[];
  currentSetIndex: number;
  winnerId?: string;
  loserId?: string;
  events: MatchStatEvent[];
  startedAt?: number;
  finishedAt?: number;
}

export interface BracketRound {
  roundIndex: number;
  name: string;
  side: 'winners' | 'losers';
  matches: Match[];
  processed: boolean;
}

export interface EliminationRecord {
  teamId: string;
  roundIndex: number;
  side: 'winners' | 'losers';
  order: number;
}

export interface BracketState {
  winnersRounds: BracketRound[];
  losersRounds: BracketRound[];
  losersAdvancingPool: string[];
  losersStagingPool: string[];
  byeHistoryTeamIds: string[];
  eliminated: EliminationRecord[];
  winnersChampionId?: string;
  losersChampionId?: string;
  nextMatchNumber: number;
}

export interface KingOfCourtState {
  courtTeamAId: string | null;
  courtTeamBId: string | null;
  queue: string[];
  currentMatchId: string | null;
  matches: Match[];
  currentKingTeamId: string | null;
  currentStreak: number;
  bestStreakByTeam: Record<string, number>;
  nextMatchNumber: number;
}

export type TournamentStatus = 'setup' | 'in_progress' | 'finished';

export interface Tournament {
  id: string;
  name: string;
  sport: SportConfig;
  format: TournamentFormat;
  targetTeamsCount: number;
  teams: Team[];
  status: TournamentStatus;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  championId?: string;
  runnerUpId?: string;
  bracket?: BracketState;
  kingOfCourt?: KingOfCourtState;
}

export interface TeamStanding {
  rank: number;
  team: Team;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  setsWon: number;
  setsLost: number;
  bestStreak?: number;
  statusLabel: string;
}

export interface PlayerScorer {
  rank: number;
  player: Player;
  team: Team;
  goals: number;
  aces: number;
  blocks: number;
  assists: number;
}
