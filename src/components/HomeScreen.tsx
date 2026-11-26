import {
  ChevronRight,
  History,
  Lock,
  Plus,
  Smartphone,
  Trophy,
} from 'lucide-react';
import { getSportDisplayName } from '../engine/sports';
import type { Tournament } from '../types/tournament';
import { FutevoleiBall } from './FutevoleiBall';

const DEVELOPER_INSTAGRAM_URL =
  'https://www.instagram.com/luiz_jaques23?lqvp=MW5pamVsYXJveG05aA%3D%3D&utm_source=qr';

interface HomeScreenProps {
  tournaments: Tournament[];
  onNewTournament: () => void;
  onOpenTournament: (id: string) => void;
  onOpenHistory: () => void;
  showIosInstallHint: boolean;
}

export function HomeScreen({
  tournaments,
  onNewTournament,
  onOpenTournament,
  onOpenHistory,
  showIosInstallHint,
}: HomeScreenProps) {
  const activeTournaments = tournaments
    .filter((t) => t.status !== 'finished')
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const finishedCount = tournaments.filter((t) => t.status === 'finished').length;

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-12">
      {/* Hero Card - Arena / Sand Court aesthetic */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-6 sm:p-8 shadow-xl border border-emerald-500/30">
        {/* Court line accent */}
        <div className="absolute right-4 top-4 bottom-4 w-24 border-2 border-white/10 rounded-2xl pointer-events-none" />
        <div className="absolute -right-6 -bottom-6 opacity-15 pointer-events-none">
          <FutevoleiBall className="w-40 h-40" />
        </div>

        <div className="relative space-y-4">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-400/30">
            100% Offline • Tempo Real
          </span>
          <h2 className="font-score text-4xl sm:text-5xl font-extrabold uppercase tracking-wide leading-none">
            Gerencie seu Torneio na Quadra
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-md">
            Chaveamento vencedores x perdedores, Rei da Quadra, placar gigante para sol forte e relatório em PDF.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onNewTournament}
              className="h-14 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition"
            >
              <Plus className="w-6 h-6 stroke-[2.75]" />
              Novo Torneio
            </button>
            <button
              type="button"
              onClick={onOpenHistory}
              className="h-14 px-5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm flex items-center justify-center gap-2 border border-white/15 active:scale-[0.98] transition"
            >
              <History className="w-5 h-5 text-amber-400" />
              Histórico ({finishedCount})
            </button>
          </div>
        </div>
      </section>

      {/* Active / Saved Tournaments */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Torneios em Andamento ({activeTournaments.length})
          </h3>
        </div>

        {activeTournaments.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-amber-300/80 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 p-8 text-center space-y-2">
            <FutevoleiBall className="w-12 h-12 mx-auto opacity-80" />
            <p className="font-bold text-slate-800 dark:text-slate-200">
              Nenhum torneio ativo no momento
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Toque em &ldquo;Novo Torneio&rdquo; para cadastrar as duplas e começar os jogos.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTournaments.map((t) => {
              const sportName = getSportDisplayName(t.sport);
              const formatName =
                t.format === 'king_of_court' ? 'Rei da Quadra' : 'Vencedores x Perdedores';
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenTournament(t.id)}
                  className="w-full text-left rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 p-4 shadow-sm hover:border-emerald-500 dark:hover:border-emerald-500 flex items-center justify-between gap-4 active:scale-[0.99] transition"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <Trophy className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                          {t.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                          {t.status === 'setup' ? 'Cadastro' : 'Em jogo'}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                          <Lock className="w-2.5 h-2.5" /> Senha
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {sportName} • {formatName} • {t.teams.length} times
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {showIosInstallHint && (
        <section className="rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/70 p-4 flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs text-sky-900 dark:text-sky-200 space-y-1">
            <p className="font-bold">Dica para instalar no iPhone (Safari):</p>
            <p>
              Toque no botão <strong>Compartilhar</strong> e depois em{' '}
              <strong>Adicionar à Tela de Início</strong> para abrir em tela cheia mesmo sem internet.
            </p>
          </div>
        </section>
      )}

      {/* Developer Footer */}
      <footer className="mt-8 rounded-3xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border border-amber-200/80 dark:border-slate-800 p-5 flex flex-col items-center text-center gap-3 shadow-sm">
        <div className="flex items-center justify-center gap-2.5">
          <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
            Desenvolvido por
          </p>
          <a
            href={DEVELOPER_INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram do desenvolvedor"
            title="Instagram"
            className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-md hover:opacity-95 active:scale-[0.96] transition"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
            </svg>
          </a>
        </div>
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} ArenaPro - Torneios • Todos os direitos reservados.
        </p>
      </footer>
    </main>
  );
}
