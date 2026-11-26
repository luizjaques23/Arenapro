import { Check, Crown, Eye, EyeOff, GitFork, KeyRound, Lock, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { SPORT_PRESETS } from '../engine/sports';
import {
  isValidNumericPin,
  MAX_PIN_LENGTH,
  MIN_PIN_LENGTH,
  sanitizeNumericPin,
} from '../services/pinAuth';
import type {
  ScoringMode,
  SportConfig,
  SportId,
  TournamentFormat,
} from '../types/tournament';

export interface SetupResult {
  name: string;
  sport: SportConfig;
  format: TournamentFormat;
  targetTeamsCount: number;
  pin: string;
}

interface SetupScreenProps {
  onCreate: (data: SetupResult) => void;
}

export function SetupScreen({ onCreate }: SetupScreenProps) {
  const [name, setName] = useState('');
  const [sportId, setSportId] = useState<SportId>('futevolei');
  const [customSportName, setCustomSportName] = useState('');
  const [scoringMode, setScoringMode] = useState<ScoringMode>('sets');
  const [setsToWin, setSetsToWin] = useState(1);
  const [pointsPerSet, setPointsPerSet] = useState(18);
  const [winByTwo, setWinByTwo] = useState(true);
  const [trackPlayerGoals, setTrackPlayerGoals] = useState(false);
  const [format, setFormat] = useState<TournamentFormat>('bracket');
  const [targetTeamsCount, setTargetTeamsCount] = useState(16);

  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);

  const handleSelectSport = (id: SportId) => {
    setSportId(id);
    const preset = SPORT_PRESETS.find((s) => s.id === id);
    if (preset) {
      setScoringMode(preset.defaultConfig.scoringMode);
      setSetsToWin(preset.defaultConfig.setsToWin);
      setPointsPerSet(preset.defaultConfig.pointsPerSet);
      setWinByTwo(preset.defaultConfig.winByTwo);
      setTrackPlayerGoals(preset.defaultConfig.trackPlayerGoals);
    }
  };

  const handlePinChange = (raw: string) => {
    const cleaned = sanitizeNumericPin(raw);
    setPin(cleaned);
    if (pinError && isValidNumericPin(cleaned)) {
      setPinError(null);
    }
  };

  const finalizeCreate = (validPin: string) => {
    const preset = SPORT_PRESETS.find((s) => s.id === sportId) ?? SPORT_PRESETS[0];
    const sport: SportConfig = {
      ...preset.defaultConfig,
      customName: sportId === 'outro' ? customSportName.trim() || 'Personalizado' : undefined,
      scoringMode,
      setsToWin: scoringMode === 'sets' ? setsToWin : 1,
      pointsPerSet: scoringMode === 'sets' ? pointsPerSet : 0,
      winByTwo: scoringMode === 'sets' ? winByTwo : false,
      trackPlayerGoals: scoringMode === 'goals' ? trackPlayerGoals : false,
    };

    onCreate({
      name: name.trim() || `Torneio de ${sportId === 'outro' ? sport.customName : preset.label}`,
      sport,
      format,
      targetTeamsCount,
      pin: validPin,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeNumericPin(pin);
    if (!isValidNumericPin(cleaned)) {
      setPinError(`A senha deve conter apenas números (mínimo de ${MIN_PIN_LENGTH} dígitos).`);
      setShowPinModal(true);
      return;
    }
    finalizeCreate(cleaned);
  };

  const handleConfirmPinModal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeNumericPin(pin);
    if (!isValidNumericPin(cleaned)) {
      setPinError(`Digite pelo menos ${MIN_PIN_LENGTH} números (0 a 9).`);
      return;
    }
    setShowPinModal(false);
    finalizeCreate(cleaned);
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 pb-24">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tournament Name */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 p-5 space-y-3 shadow-sm">
          <label
            htmlFor="tournament-name"
            className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            Nome do Campeonato
          </label>
          <input
            id="tournament-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Torneio Praia de Domingo"
            className="w-full h-14 px-4 rounded-2xl bg-amber-50/60 dark:bg-slate-800 border-2 border-amber-200 dark:border-slate-700 focus:border-emerald-500 outline-none text-base font-bold text-slate-900 dark:text-white"
          />
        </section>

        {/* Modality */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 p-5 space-y-4 shadow-sm">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Modalidade
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {SPORT_PRESETS.map((preset) => {
              const selected = sportId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectSport(preset.id)}
                  className={`p-3.5 rounded-2xl border-2 text-left transition active:scale-[0.98] ${
                    selected
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {preset.label}
                    </span>
                    {selected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {preset.tagline}
                  </p>
                </button>
              );
            })}
          </div>

          {sportId === 'outro' && (
            <div className="pt-2 space-y-3 border-t border-slate-200 dark:border-slate-800">
              <input
                type="text"
                value={customSportName}
                onChange={(e) => setCustomSportName(e.target.value)}
                placeholder="Nome da modalidade (ex: Altinha, Society)"
                className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setScoringMode('sets');
                    setTrackPlayerGoals(false);
                  }}
                  className={`h-11 rounded-xl text-xs font-bold border-2 ${
                    scoringMode === 'sets'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Pontos / Sets
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScoringMode('goals');
                    setTrackPlayerGoals(true);
                  }}
                  className={`h-11 rounded-xl text-xs font-bold border-2 ${
                    scoringMode === 'goals'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Gols + Artilheiro
                </button>
              </div>
            </div>
          )}

          {sportId === 'futevolei' && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Futevôlei: registro direto do vencedor por confronto (sem placar) e avanço imediato na chave.
              </p>
            </div>
          )}

          {sportId !== 'futevolei' && scoringMode === 'sets' && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Sets para vencer
                </label>
                <div className="flex gap-1.5">
                  {[1, 2].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSetsToWin(val)}
                      className={`flex-1 h-10 rounded-xl text-xs font-extrabold border-2 ${
                        setsToWin === val
                          ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {val === 1 ? '1 Set' : 'Melhor de 3'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Pontos por set
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPointsPerSet((p) => Math.max(5, p - 1))}
                    className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="flex-1 text-center font-score text-2xl font-extrabold">
                    {pointsPerSet}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPointsPerSet((p) => Math.min(30, p + 1))}
                    className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 flex items-end">
                <button
                  type="button"
                  onClick={() => setWinByTwo((v) => !v)}
                  className={`w-full h-10 rounded-xl text-xs font-bold border-2 px-3 ${
                    winByTwo
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  Vai a 2: {winByTwo ? 'Sim' : 'Não'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Format */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 p-5 space-y-3 shadow-sm">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Formato do Torneio
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormat('bracket')}
              className={`p-4 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                format === 'bracket'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                <GitFork className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Chaveamento Híbrido (Vencedores x Repescagem + Finais)
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Eliminatória dupla até as Semifinais (cruzamento anti-revanche) e Fase Final com 3º/4º e Grande Final (16 times = 30 jogos).
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormat('king_of_court')}
              className={`p-4 rounded-2xl border-2 text-left transition flex items-start gap-3 ${
                format === 'king_of_court'
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                  Rei da Quadra
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Jogo contínuo em quadra única: quem ganha fica, quem perde vai para o fim da fila.
                </p>
              </div>
            </button>
          </div>
        </section>

        {/* Number of Teams */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Quantidade Prevista de Times / Duplas
            </h2>
            <span className="font-score text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {targetTeamsCount}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {[4, 5, 6, 8, 10, 12, 16].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTargetTeamsCount(n)}
                className={`h-11 px-4 rounded-xl font-extrabold text-sm border-2 transition ${
                  targetTeamsCount === n
                    ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {n}
              </button>
            ))}
            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={() => setTargetTeamsCount((n) => Math.max(2, n - 1))}
                className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTargetTeamsCount((n) => Math.min(32, n + 1))}
                className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Mandatory Numeric Password Section */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-emerald-500/40 dark:border-emerald-500/30 p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="tournament-pin"
              className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400"
            >
              <Lock className="w-4 h-4" />
              Senha Numérica do Torneio (Obrigatória)
            </label>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {pin.length}/{MIN_PIN_LENGTH}+ dígitos
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            Defina uma senha apenas com números (mínimo de {MIN_PIN_LENGTH} dígitos) para proteger a edição e o gerenciamento deste campeonato.
          </p>

          <div className="relative">
            <input
              id="tournament-pin"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={MAX_PIN_LENGTH}
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              placeholder="Ex: 1234 (somente números)"
              className={`w-full h-14 pl-4 pr-12 rounded-2xl bg-amber-50/60 dark:bg-slate-800 border-2 outline-none text-lg font-extrabold tracking-widest text-slate-900 dark:text-white ${
                pinError
                  ? 'border-rose-500 focus:border-rose-500'
                  : isValidNumericPin(pin)
                    ? 'border-emerald-500 focus:border-emerald-500'
                    : 'border-amber-200 dark:border-slate-700 focus:border-emerald-500'
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

          {pinError && (
            <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
              {pinError}
            </p>
          )}
        </section>

        <button
          type="submit"
          className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base shadow-xl shadow-emerald-600/25 active:scale-[0.99] transition"
        >
          Salvar Torneio e Cadastrar Times
        </button>
      </form>

      {/* Mandatory PIN Modal if user submits without filling valid PIN */}
      {showPinModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border-2 border-emerald-500/60 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Defina a Senha do Torneio
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Obrigatório para proteger a edição deste campeonato
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmPinModal} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="modal-setup-pin"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  Senha numérica (mínimo {MIN_PIN_LENGTH} dígitos, apenas 0-9)
                </label>
                <div className="relative">
                  <input
                    id="modal-setup-pin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoFocus
                    autoComplete="off"
                    maxLength={MAX_PIN_LENGTH}
                    value={pin}
                    onChange={(e) => handlePinChange(e.target.value)}
                    placeholder="••••"
                    className="w-full h-14 pl-4 pr-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 focus:border-emerald-500 outline-none text-center text-2xl font-extrabold tracking-[0.35em] text-slate-900 dark:text-white"
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
                {pinError && (
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    {pinError}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/20"
                >
                  Salvar e Entrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
