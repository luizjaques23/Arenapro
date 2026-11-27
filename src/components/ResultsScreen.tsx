import confetti from 'canvas-confetti';
import {
  Award,
  Check,
  Copy,
  Download,
  FileText,
  GitFork,
  Home,
  Pencil,
  Share2,
  Trophy,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getSportDisplayName } from '../engine/sports';
import { computeStandings, computeTopScorers } from '../engine/tournamentEngine';
import { buildShareTournamentUrl, publishTournamentLive } from '../services/liveSync';
import { generateTournamentPdf } from '../services/pdfReport';
import { shareTournamentSummary } from '../services/share';
import { soundEngine } from '../services/sound';
import type { Tournament } from '../types/tournament';

interface ResultsScreenProps {
  tournament: Tournament;
  onViewBracket: () => void;
  onEditTeams?: () => void;
  onExportJson: () => void;
  onGoHome: () => void;
}

export function ResultsScreen({
  tournament,
  onViewBracket,
  onEditTeams,
  onExportJson,
  onGoHome,
}: ResultsScreenProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const isFutevolei = tournament.sport.id === 'futevolei';
  const shareUrl = buildShareTournamentUrl(tournament);

  const standings = computeStandings(tournament);
  const scorers = computeTopScorers(tournament);
  const champion = standings.find((s) => s.team.id === tournament.championId) ?? standings[0];
  const runnerUp = standings.find((s) => s.team.id === tournament.runnerUpId) ?? standings[1];
  const thirdPlace =
    (tournament.thirdPlaceId
      ? standings.find((s) => s.team.id === tournament.thirdPlaceId)
      : undefined) ??
    standings.find(
      (s) => s.team.id !== champion?.team.id && s.team.id !== runnerUp?.team.id,
    );

  useEffect(() => {
    soundEngine.playVictory();
    try {
      void confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
      });
    } catch {
      // Ignore confetti errors in headless/restricted environments
    }
  }, []);

  const showToast = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3200);
  };

  const handlePdf = () => {
    const filename = generateTournamentPdf(tournament);
    showToast(`PDF gerado: ${filename}`);
  };

  const handleShare = async () => {
    try {
      const mode = await shareTournamentSummary(tournament);
      showToast(
        mode === 'shared'
          ? 'Resumo compartilhado!'
          : 'Resumo copiado! Cole no WhatsApp.',
      );
    } catch {
      showToast('Não foi possível copiar automaticamente.');
    }
  };

  const handleCopyShareLink = async () => {
    void publishTournamentLive(tournament);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      showToast('Link exclusivo de visualização copiado!');
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast('Não foi possível copiar o link.');
    }
  };

  const formatTeamLabel = (emblem: string, name: string) =>
    isFutevolei || !emblem ? name : `${emblem} ${name}`;

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 pb-24 space-y-6">
      {feedback && (
        <div className="fixed top-20 inset-x-4 max-w-md mx-auto z-40 rounded-2xl bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 px-4 py-3 text-center text-sm font-extrabold shadow-2xl">
          {feedback}
        </div>
      )}

      {/* Champion Hero */}
      {champion && (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white p-6 sm:p-8 text-center border-2 border-amber-400/70 shadow-2xl space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-400/30">
            <Trophy className="w-9 h-9" />
          </div>
          <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-amber-400">
            Campeão • {getSportDisplayName(tournament.sport)}
          </p>
          <h2 className="font-score text-5xl sm:text-6xl font-extrabold uppercase tracking-wide">
            {formatTeamLabel(champion.team.emblem, champion.team.name)}
          </h2>
          {champion.team.players.length > 0 && (
            <p className="text-sm font-semibold text-emerald-300">
              {champion.team.players.map((p) => p.name).join('  •  ')}
            </p>
          )}
          <div className="pt-2 flex items-center justify-center gap-4 text-xs font-bold text-slate-300">
            <span>{champion.wins} vitórias</span>
            {!isFutevolei && (
              <>
                <span>•</span>
                <span>
                  Saldo: {champion.pointDiff > 0 ? `+${champion.pointDiff}` : champion.pointDiff}
                </span>
              </>
            )}
          </div>
        </section>
      )}

      {/* Primary Action Buttons */}
      <section className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handlePdf}
          className="h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-[0.98] transition"
        >
          <FileText className="w-5 h-5" />
          Gerar PDF
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition"
        >
          <Share2 className="w-5 h-5" />
          Compartilhar
        </button>
      </section>

      {/* Exclusive Share Link */}
      <section className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
              Link exclusivo do torneio (somente visualização)
            </p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 truncate">
              {shareUrl}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopyShareLink}
          className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedLink ? 'Copiado!' : 'Copiar Link'}
        </button>
      </section>

      {/* Podium 2nd & 3rd */}
      {(runnerUp || thirdPlace) && (
        <section className="grid sm:grid-cols-2 gap-3">
          {runnerUp && runnerUp.team.id !== champion?.team.id && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3">
              <span className="text-2xl">🥈</span>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase text-slate-400">
                  2º Lugar
                </p>
                <p className="font-extrabold text-slate-900 dark:text-white truncate">
                  {formatTeamLabel(runnerUp.team.emblem, runnerUp.team.name)}
                </p>
              </div>
            </div>
          )}
          {thirdPlace && (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex items-center gap-3">
              <span className="text-2xl">🥉</span>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase text-slate-400">
                  3º Lugar
                </p>
                <p className="font-extrabold text-slate-900 dark:text-white truncate">
                  {formatTeamLabel(thirdPlace.team.emblem, thirdPlace.team.name)}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Artilheiro (Goal sports) */}
      {tournament.sport.trackPlayerGoals && scorers.length > 0 && (
        <section className="rounded-3xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
              Artilharia do Campeonato
            </h3>
          </div>
          <div className="space-y-2">
            {scorers.slice(0, 5).map((sc) => (
              <div
                key={sc.player.id}
                className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl px-3.5 py-2.5 border border-emerald-100 dark:border-slate-800"
              >
                <div className="min-w-0">
                  <p className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                    {sc.rank}º {sc.player.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{sc.team.name}</p>
                </div>
                <span className="font-score text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {sc.goals} gol{sc.goals === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Standings Table */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 p-5 space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Classificação Geral
        </h3>
        <div className="space-y-2">
          {standings.map((row) => (
            <div
              key={row.team.id}
              className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-sm"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-score text-xl font-extrabold w-6 text-slate-500">
                  {row.rank}º
                </span>
                {!isFutevolei && <span>{row.team.emblem}</span>}
                <span className="font-bold text-slate-900 dark:text-white truncate">
                  {row.team.name}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
                <span>
                  {row.wins}V / {row.losses}D
                </span>
                {!isFutevolei && (
                  <span className="w-10 text-right">
                    {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Secondary Actions */}
      <div className={`grid ${onEditTeams ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-2.5`}>
        {onEditTeams && (
          <button
            type="button"
            onClick={onEditTeams}
            className="h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Pencil className="w-4 h-4" />
            EDITAR
          </button>
        )}
        <button
          type="button"
          onClick={onViewBracket}
          className="h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-xs flex items-center justify-center gap-1.5"
        >
          <GitFork className="w-4 h-4" />
          Chaves
        </button>
        <button
          type="button"
          onClick={onExportJson}
          className="h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-xs flex items-center justify-center gap-1.5"
        >
          <Download className="w-4 h-4" />
          Backup
        </button>
        <button
          type="button"
          onClick={onGoHome}
          className="h-12 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5"
        >
          <Home className="w-4 h-4" />
          Início
        </button>
      </div>
    </main>
  );
}
