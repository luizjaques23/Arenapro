import {
  Calendar,
  Download,
  FileText,
  FolderOpen,
  History,
  Lock,
  Trash2,
  Trophy,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { getSportDisplayName } from '../engine/sports';
import { generateTournamentPdf } from '../services/pdfReport';
import { exportTournamentJson } from '../services/storage';
import type { Tournament } from '../types/tournament';

interface HistoryScreenProps {
  tournaments: Tournament[];
  onOpenTournament: (id: string) => void;
  onDeleteTournament: (id: string) => void;
  onImportJson: (raw: string) => void;
}

export function HistoryScreen({
  tournaments,
  onOpenTournament,
  onDeleteTournament,
  onImportJson,
}: HistoryScreenProps) {
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onImportJson(text);
    e.target.value = '';
  };

  const sorted = [...tournaments].sort((a, b) => b.updatedAt - a.updatedAt);

  const handlePdf = (t: Tournament) => {
    const filename = generateTournamentPdf(t);
    setPdfNotice(`PDF salvo: ${filename}`);
    window.setTimeout(() => setPdfNotice(null), 3000);
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 pb-20 space-y-4">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="h-10 px-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
        >
          <Upload className="w-3.5 h-3.5" />
          Importar Backup
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
      {pdfNotice && (
        <div className="rounded-2xl bg-emerald-600 text-white px-4 py-3 text-sm font-bold shadow-lg">
          {pdfNotice}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 p-10 text-center space-y-3">
          <History className="w-12 h-12 mx-auto text-slate-400" />
          <p className="font-extrabold text-slate-800 dark:text-slate-200">
            Nenhum torneio salvo ainda
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Todos os campeonatos criados e finalizados ficam salvos localmente no seu aparelho.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((t) => {
            const champ = t.teams.find((tm) => tm.id === t.championId);
            const sportName = getSportDisplayName(t.sport);
            const dateStr = new Date(t.finishedAt ?? t.createdAt).toLocaleDateString(
              'pt-BR',
            );

            return (
              <div
                key={t.id}
                className="rounded-3xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                        {t.name}
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          t.status === 'finished'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                        }`}
                      >
                        {t.status === 'finished' ? 'Finalizado' : 'Em andamento'}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <Lock className="w-2.5 h-2.5" /> Protegido por senha
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                      <span>{sportName}</span>
                      <span>•</span>
                      <span>
                        {t.format === 'king_of_court'
                          ? 'Rei da Quadra'
                          : 'Vencedores x Perdedores'}
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> {dateStr}
                      </span>
                    </p>
                  </div>
                </div>

                {champ && (
                  <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 px-3.5 py-2.5 flex items-center gap-2.5">
                    <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Campeão:{' '}
                      {t.sport.id === 'futevolei'
                        ? champ.name
                        : `${champ.emblem} ${champ.name}`}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenTournament(t.id)}
                    className="flex-1 min-w-[110px] h-11 px-3 rounded-xl bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Abrir
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePdf(t)}
                    className="flex-1 min-w-[110px] h-11 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-4 h-4" />
                    Gerar PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => exportTournamentJson(t)}
                    title="Exportar JSON"
                    className="h-11 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTournament(t.id)}
                    aria-label="Excluir torneio com senha"
                    title="Excluir torneio (exige senha)"
                    className="h-11 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Excluir</span>
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
