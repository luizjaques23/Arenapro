import { ArrowLeft, Download, Lock, Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import { FutevoleiBall } from './FutevoleiBall';

interface TopBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onLockTournament?: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  muted: boolean;
  onToggleMute: () => void;
  canInstall?: boolean;
  onInstallClick?: () => void;
}

export function TopBar({
  title,
  subtitle,
  onBack,
  onLockTournament,
  theme,
  onToggleTheme,
  muted,
  onToggleMute,
  canInstall,
  onInstallClick,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-amber-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
      <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Voltar"
              className="w-11 h-11 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-900 dark:text-white active:scale-95 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-900 dark:bg-emerald-950/60 flex items-center justify-center border border-emerald-500/40">
              <FutevoleiBall className="w-7 h-7" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="font-bold text-base sm:text-lg leading-tight truncate text-slate-900 dark:text-white">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onLockTournament && (
            <button
              type="button"
              onClick={onLockTournament}
              title="Sair / Bloquear torneio"
              aria-label="Sair / Bloquear torneio"
              className="h-10 px-2.5 sm:px-3 rounded-xl bg-amber-100/90 dark:bg-amber-950/70 hover:bg-amber-200 dark:hover:bg-amber-900/70 text-amber-900 dark:text-amber-300 border border-amber-300/70 dark:border-amber-800/60 text-xs font-extrabold flex items-center gap-1.5 active:scale-95 transition"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair / Bloquear</span>
            </button>
          )}
          {canInstall && onInstallClick && (
            <button
              type="button"
              onClick={onInstallClick}
              className="h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 active:scale-95 transition"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Instalar</span>
            </button>
          )}
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Ativar sons' : 'Silenciar sons'}
            title={muted ? 'Ativar sons' : 'Silenciar sons'}
            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center active:scale-95 transition"
          >
            {muted ? <VolumeX className="w-5 h-5 text-rose-500" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Alternar tema claro ou escuro"
            title="Alternar tema"
            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center active:scale-95 transition"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </header>
  );
}
