import { Lock, Radio, Trophy, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { subscribePublicTournament } from '../services/liveSync';
import type { Tournament } from '../types/tournament';
import { BracketDashboard } from './BracketDashboard';

interface PublicWatchScreenProps {
  tournamentId: string;
  token: string | null;
}

export function PublicWatchScreen({ tournamentId, token }: PublicWatchScreenProps) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribePublicTournament(tournamentId, token, (data) => {
      setTournament(data);
      setLoaded(true);
    });
    return unsubscribe;
  }, [tournamentId, token]);

  if (!loaded) {
    return (
      <main className="max-w-xl mx-auto px-4 py-16 text-center space-y-3">
        <Radio className="w-10 h-10 mx-auto text-emerald-500 animate-pulse" />
        <p className="font-bold text-slate-700 dark:text-slate-300">
          Conectando ao torneio ao vivo...
        </p>
      </main>
    );
  }

  if (!tournament) {
    return (
      <main className="max-w-lg mx-auto px-4 py-16">
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3 shadow-lg">
          <WifiOff className="w-12 h-12 mx-auto text-amber-500" />
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Torneio não encontrado
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Não foi possível carregar as informações deste campeonato. Verifique se o link compartilhado está completo ou aguarde a conexão com a rede.
          </p>
        </div>
      </main>
    );
  }

  // Automatic termination when this specific tournament is finished
  if (tournament.status === 'finished' || tournament.publicStatus === 'encerrado') {
    const champ = tournament.teams.find((t) => t.id === tournament.championId);
    return (
      <main className="max-w-lg mx-auto px-4 py-14">
        <div className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-amber-400/70 p-8 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Trophy className="w-8 h-8" />
          </div>
          <span className="inline-block px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-extrabold uppercase tracking-wider">
            Torneio Encerrado
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {tournament.name}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Este torneio já foi finalizado e o link de acompanhamento ao vivo foi desativado automaticamente.
          </p>
          {champ && (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-4">
              <p className="text-xs font-bold uppercase text-amber-700 dark:text-amber-400">
                Campeão Oficial
              </p>
              <p className="font-extrabold text-lg text-slate-900 dark:text-white mt-0.5">
                {tournament.sport.id === 'futevolei'
                  ? champ.name
                  : `${champ.emblem} ${champ.name}`}
              </p>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <div className="space-y-2">
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="rounded-2xl bg-emerald-600 text-white px-4 py-3 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <Radio className="w-4 h-4 shrink-0 animate-pulse" />
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-wider">
                Acompanhamento ao Vivo
              </p>
              <p className="text-[11px] text-emerald-100 truncate">
                {tournament.name} • Atualização automática em tempo real
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-bold shrink-0">
            <Lock className="w-3 h-3" /> Somente leitura
          </span>
        </div>
      </div>

      {tournament.status === 'setup' ? (
        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 p-6 text-center space-y-3">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Aguardando início dos jogos
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              O organizador está cadastrando os participantes ({tournament.teams.length}{' '}
              inscritos). O chaveamento aparecerá aqui automaticamente assim que iniciar.
            </p>
          </div>
        </main>
      ) : (
        <BracketDashboard
          tournament={tournament}
          readOnly
          onOpenMatch={() => { }}
          onFinishManually={() => { }}
          onOpenResults={() => { }}
          onExportJson={() => { }}
          onOpenReset={() => { }}
        />
      )}
    </div>
  );
}
