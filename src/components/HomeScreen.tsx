import {
  ChevronRight,
  History,
  Lock,
  Plus,
  Smartphone,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';
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
  const [filter, setFilter] = useState<'all' | 'active' | 'finished'>('all');

  const sortedTournaments = [...tournaments].sort(
    (a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0),
  );
  const activeCount = sortedTournaments.filter((t) => t.status !== 'finished').length;
  const finishedCount = sortedTournaments.filter((t) => t.status === 'finished').length;

  const visibleTournaments = sortedTournaments.filter((t) => {
    if (filter === 'active') return t.status !== 'finished';
    if (filter === 'finished') return t.status === 'finished';
    return true;
  });

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

      {/* Created / Saved Tournaments Listing */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Torneios Criados ({sortedTournaments.length})
          </h3>
          {sortedTournaments.length > 0 && (
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: `Todos (${sortedTournaments.length})` },
                { id: 'active', label: `Ativos (${activeCount})` },
                { id: 'finished', label: `Finalizados (${finishedCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id as typeof filter)}
                  className={`h-8 px-2.5 rounded-xl text-[11px] font-extrabold transition ${
                    filter === tab.id
                      ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {sortedTournaments.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-amber-300/80 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 p-8 text-center space-y-2">
            <FutevoleiBall className="w-12 h-12 mx-auto opacity-80" />
            <p className="font-bold text-slate-800 dark:text-slate-200">
              Nenhum torneio criado ainda
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Toque em &ldquo;Novo Torneio&rdquo; para cadastrar as duplas e começar os jogos.
            </p>
          </div>
        ) : visibleTournaments.length === 0 ? (
          <div className="rounded-3xl border border-amber-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-7 text-center space-y-2">
            <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
              {filter === 'active'
                ? 'Nenhum torneio em andamento no momento'
                : 'Nenhum torneio finalizado disponível'}
            </p>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Ver todos os torneios ({sortedTournaments.length})
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleTournaments.map((t) => {
              const sportName = getSportDisplayName(t.sport);
              const formatName =
                t.format === 'king_of_court' ? 'Rei da Quadra' : 'Vencedores x Perdedores';
              const statusLabel =
                t.status === 'finished'
                  ? 'Finalizado'
                  : t.status === 'setup'
                    ? 'Cadastro'
                    : 'Em jogo';

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
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            t.status === 'finished'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          }`}
                        >
                          {statusLabel}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                          <Lock className="w-2.5 h-2.5" /> Senha
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {sportName} • {formatName} • {t.teams.length} duplas/times
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
      <footer className="mt-14 sm:mt-16 pt-6 pb-6 flex flex-col items-center text-center gap-2.5">
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} ArenaPro - Torneios • Todos os direitos reservados.
        </p>
        <div className="flex items-center justify-center gap-2 pt-0.5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Desenvolvido por
          </p>
          <a
            href={DEVELOPER_INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram do desenvolvedor"
            title="Instagram"
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-sm hover:opacity-90 active:scale-95 transition"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
            </svg>
          </a>
        </div>
      </footer>
    </main>
  );
}
