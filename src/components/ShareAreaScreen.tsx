import {
  Check,
  Copy,
  Eye,
  Plus,
  Share2,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';
import { getSportDisplayName } from '../engine/sports';
import { buildShareTournamentUrl, publishTournamentLive } from '../services/liveSync';
import type { Tournament } from '../types/tournament';
import { FutevoleiBall } from './FutevoleiBall';

interface ShareAreaScreenProps {
  tournaments: Tournament[];
  onPreviewTournament: (tournament: Tournament) => void;
  onCreateTournament: () => void;
}

export function ShareAreaScreen({
  tournaments,
  onPreviewTournament,
  onCreateTournament,
}: ShareAreaScreenProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'finished'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sorted = [...tournaments].sort((a, b) => b.updatedAt - a.updatedAt);
  const filtered = sorted.filter((t) => {
    if (filter === 'active') return t.status !== 'finished';
    if (filter === 'finished') return t.status === 'finished';
    return true;
  });

  const activeCount = sorted.filter((t) => t.status !== 'finished').length;
  const finishedCount = sorted.filter((t) => t.status === 'finished').length;

  const handleCopy = async (t: Tournament) => {
    void publishTournamentLive(t);
    const url = buildShareTournamentUrl(t);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(t.id);
      window.setTimeout(() => setCopiedId((curr) => (curr === t.id ? null : curr)), 2500);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleShare = async (t: Tournament) => {
    void publishTournamentLive(t);
    const url = buildShareTournamentUrl(t);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: t.name,
          text: `Acompanhe o torneio ${t.name} (somente visualização):`,
          url,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await handleCopy(t);
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 pb-20 space-y-5">
      {/* Intro Banner */}
      <section className="rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 p-4 sm:p-5 flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
          <Share2 className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm sm:text-base font-extrabold text-emerald-950 dark:text-emerald-200">
            Área de Compartilhamento
          </h2>
          <p className="text-xs text-emerald-800 dark:text-emerald-300/90">
            Todos os seus torneios geram um link exclusivo para acompanhamento público (sem senha e somente visualização), atualizado automaticamente.
          </p>
        </div>
      </section>

      {/* Filter Pills */}
      {sorted.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: `Todos (${sorted.length})` },
            { id: 'active', label: `Em andamento (${activeCount})` },
            { id: 'finished', label: `Finalizados (${finishedCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as typeof filter)}
              className={`h-9 px-3.5 rounded-xl text-xs font-extrabold transition ${
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

      {/* List or Empty State */}
      {sorted.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-amber-300/80 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 p-8 text-center space-y-3">
          <FutevoleiBall className="w-12 h-12 mx-auto opacity-80" />
          <p className="font-extrabold text-slate-800 dark:text-slate-200">
            Nenhum torneio disponível para compartilhar
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Crie um torneio primeiro para gerar seu link exclusivo de compartilhamento e acompanhamento em tempo real.
          </p>
          <button
            type="button"
            onClick={onCreateTournament}
            className="inline-flex h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Criar Novo Torneio
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-2">
          <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
            {filter === 'active'
              ? 'Nenhum torneio em andamento nesta lista'
              : 'Nenhum torneio finalizado nesta lista'}
          </p>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Mostrar todos os torneios ({sorted.length})
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const sportName = getSportDisplayName(t.sport);
            const formatName =
              t.format === 'king_of_court' ? 'Rei da Quadra' : 'Vencedores x Perdedores';
            const statusText =
              t.status === 'finished'
                ? 'Finalizado'
                : t.status === 'setup'
                  ? 'Cadastro'
                  : 'Em jogo';
            const isCopied = copiedId === t.id;
            const shareUrl = buildShareTournamentUrl(t);

            return (
              <div
                key={t.id}
                className="rounded-3xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                          {t.name}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            t.status === 'finished'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          }`}
                        >
                          {statusText}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {sportName} • {formatName} • {t.teams.length} duplas/times
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 px-3 py-2">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                    {shareUrl}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(t)}
                    className="h-10 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {isCopied ? 'Copiado!' : 'Copiar Link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShare(t)}
                    className="h-10 px-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:opacity-90 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Enviar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void publishTournamentLive(t);
                      onPreviewTournament(t);
                    }}
                    className="h-10 px-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Visualizar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
