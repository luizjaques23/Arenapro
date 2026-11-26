import { Eye, EyeOff, KeyRound, Lock, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { getSportDisplayName } from '../engine/sports';
import {
  hasTournamentPin,
  hashPin,
  isValidNumericPin,
  MAX_PIN_LENGTH,
  MIN_PIN_LENGTH,
  sanitizeNumericPin,
  saveTournamentPinHash,
  unlockTournamentSession,
  verifyTournamentPin,
} from '../services/pinAuth';
import type { Tournament } from '../types/tournament';

interface PinUnlockModalProps {
  tournament: Tournament;
  onClose: () => void;
  onUnlocked: (tournamentId: string, newPinHash?: string) => void;
}

export function PinUnlockModal({
  tournament,
  onClose,
  onUnlocked,
}: PinUnlockModalProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLegacyWithoutPin = !hasTournamentPin(tournament);
  const sportName = getSportDisplayName(tournament.sport);

  const handlePinChange = (raw: string) => {
    const cleaned = sanitizeNumericPin(raw);
    setPin(cleaned);
    if (error) setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeNumericPin(pin);

    if (!isValidNumericPin(cleaned)) {
      setError(`Digite uma senha numérica com pelo menos ${MIN_PIN_LENGTH} dígitos.`);
      return;
    }

    if (isLegacyWithoutPin) {
      const newHash = hashPin(cleaned, tournament.id);
      saveTournamentPinHash(tournament.id, newHash);
      unlockTournamentSession(tournament.id);
      onUnlocked(tournament.id, newHash);
      return;
    }

    const isValid = verifyTournamentPin(tournament, cleaned);
    if (!isValid) {
      setError('Senha incorreta');
      setPin('');
      return;
    }

    unlockTournamentSession(tournament.id);
    onUnlocked(tournament.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-unlock-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-slate-700 p-6 shadow-2xl space-y-5">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            {isLegacyWithoutPin ? (
              <KeyRound className="w-6 h-6" />
            ) : (
              <Lock className="w-6 h-6" />
            )}
          </div>
          <div className="min-w-0">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-extrabold uppercase tracking-wider">
              {isLegacyWithoutPin ? 'Definir Senha' : 'Torneio Protegido'}
            </span>
            <h3
              id="pin-unlock-title"
              className="text-lg font-extrabold text-slate-900 dark:text-white truncate mt-1"
            >
              {tournament.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {sportName} • {tournament.teams.length} participantes
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="unlock-pin-input"
              className="block text-xs font-bold text-slate-700 dark:text-slate-300"
            >
              {isLegacyWithoutPin
                ? `Este torneio ainda não possui senha. Defina uma senha numérica (mín. ${MIN_PIN_LENGTH} dígitos):`
                : 'Digite a senha numérica deste torneio para entrar e gerenciar:'}
            </label>

            <div className="relative">
              <input
                id="unlock-pin-input"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                autoComplete="off"
                maxLength={MAX_PIN_LENGTH}
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                placeholder="••••"
                className={`w-full h-14 pl-4 pr-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 outline-none text-center text-2xl font-extrabold tracking-[0.35em] text-slate-900 dark:text-white transition ${
                  error
                    ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 focus:border-rose-500'
                    : 'border-slate-300 dark:border-slate-700 focus:border-emerald-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                aria-label={showPin ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center"
              >
                {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 px-3.5 py-2.5 flex items-center gap-2 text-rose-700 dark:text-rose-300"
              >
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span className="text-xs font-extrabold">{error}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition"
            >
              {isLegacyWithoutPin ? 'Salvar e Entrar' : 'Desbloquear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
