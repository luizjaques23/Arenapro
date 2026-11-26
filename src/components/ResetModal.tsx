import { AlertTriangle, RotateCcw, Trash2, X } from 'lucide-react';
import { useState } from 'react';

interface ResetModalProps {
  tournamentName: string;
  onClose: () => void;
  onConfirmReset: (mode: 'matches_only' | 'all') => void;
}

export function ResetModal({ tournamentName, onClose, onConfirmReset }: ResetModalProps) {
  const [selectedMode, setSelectedMode] = useState<'matches_only' | 'all' | null>(null);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Reiniciar Torneio
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[230px]">
                {tournamentName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!selectedMode ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Escolha o que deseja reiniciar:
            </p>
            <button
              type="button"
              onClick={() => setSelectedMode('matches_only')}
              className="w-full text-left p-4 rounded-2xl border-2 border-amber-300 dark:border-amber-700/70 bg-amber-50/70 dark:bg-amber-950/30 hover:bg-amber-100/70 transition flex items-start gap-3"
            >
              <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  Zerar apenas jogos e placares
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Mantém todos os times/duplas cadastrados e gera os confrontos do zero.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode('all')}
              className="w-full text-left p-4 rounded-2xl border-2 border-rose-300 dark:border-rose-800/70 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100/70 transition flex items-start gap-3"
            >
              <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  Zerar tudo (times + histórico)
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Apaga jogos, placares e todos os times cadastrados neste torneio.
                </p>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-sm text-rose-900 dark:text-rose-200 font-medium">
              {selectedMode === 'matches_only'
                ? 'Tem certeza? Todos os placares e rodadas atuais serão apagados, mantendo apenas os times.'
                : 'Atenção! Isso apagará todos os times, placares e histórico deste torneio. Essa ação não pode ser desfeita.'}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedMode(null)}
                className="h-12 rounded-2xl font-bold text-sm bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => onConfirmReset(selectedMode)}
                className="h-12 rounded-2xl font-bold text-sm bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/25"
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
