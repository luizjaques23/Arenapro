import { useCallback, useEffect, useState } from 'react';
import { BracketDashboard } from './components/BracketDashboard';
import { CourtGridBackground } from './components/CourtGridBackground';
import { HistoryScreen } from './components/HistoryScreen';
import { HomeScreen } from './components/HomeScreen';
import { LiveMatchScreen } from './components/LiveMatchScreen';
import { PublicWatchScreen } from './components/PublicWatchScreen';
import { ResetModal } from './components/ResetModal';
import { ResultsScreen } from './components/ResultsScreen';
import { SetupScreen, type SetupResult } from './components/SetupScreen';
import { SplashScreen } from './components/SplashScreen';
import { TeamsScreen } from './components/TeamsScreen';
import { TopBar } from './components/TopBar';
import { getSportDisplayName } from './engine/sports';
import {
  createTournament,
  findMatch,
  finishMatch,
  finishTournamentManually,
  resetTournament,
  startTournament,
  updateLiveMatchState,
} from './engine/tournamentEngine';
import { broadcastTournamentUpdate } from './services/liveSync';
import { soundEngine } from './services/sound';
import {
  exportTournamentJson,
  loadSettings,
  loadTournaments,
  parseImportedTournament,
  saveSettings,
  saveTournaments,
} from './services/storage';
import type { Team, Tournament } from './types/tournament';

type Screen =
  | 'home'
  | 'setup'
  | 'teams'
  | 'bracket'
  | 'live_match'
  | 'results'
  | 'history';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function App() {
  const [publicParams] = useState<{ tournamentId: string; token: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('acompanhar');
    const token = params.get('token');
    return id && token ? { tournamentId: id, token } : null;
  });

  const [showSplash, setShowSplash] = useState(!publicParams);
  const [screen, setScreen] = useState<Screen>('home');
  const [tournaments, setTournaments] = useState<Tournament[]>(() => loadTournaments());
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [settings, setSettings] = useState(() => loadSettings());
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    soundEngine.setMuted(settings.muted);
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (publicParams) return;
    saveTournaments(tournaments);
    const active = tournaments.find((t) => t.id === activeTournamentId);
    if (active) broadcastTournamentUpdate(active);
  }, [tournaments, publicParams, activeTournamentId]);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const showToastMessage = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const activeTournament = tournaments.find((t) => t.id === activeTournamentId) ?? null;
  const activeMatch =
    activeTournament && activeMatchId
      ? findMatch(activeTournament, activeMatchId) ?? null
      : null;

  const updateActiveTournament = (updater: (t: Tournament) => Tournament) => {
    if (!activeTournamentId) return;
    setTournaments((prev) =>
      prev.map((t) => (t.id === activeTournamentId ? updater(t) : t)),
    );
  };

  const handleCreateTournament = (setup: SetupResult) => {
    const created = createTournament(setup);
    setTournaments((prev) => [created, ...prev]);
    setActiveTournamentId(created.id);
    setScreen('teams');
  };

  const handleOpenTournament = (id: string) => {
    const target = tournaments.find((t) => t.id === id);
    if (!target) return;
    setActiveTournamentId(id);
    if (target.status === 'setup') setScreen('teams');
    else if (target.status === 'finished') setScreen('results');
    else setScreen('bracket');
  };

  const handleImportJson = (rawText: string) => {
    try {
      const imported = parseImportedTournament(rawText);
      setTournaments((prev) => [imported, ...prev]);
      setActiveTournamentId(imported.id);
      showToastMessage(`Torneio "${imported.name}" importado!`);
      if (imported.status === 'setup') setScreen('teams');
      else if (imported.status === 'finished') setScreen('results');
      else setScreen('bracket');
    } catch (err) {
      showToastMessage(
        err instanceof Error ? err.message : 'Falha ao importar JSON.',
      );
    }
  };

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const res = await installPrompt.userChoice;
    if (res.outcome === 'accepted') setInstallPrompt(null);
  };

  const handleBack = (): (() => void) | undefined => {
    if (screen === 'home') return undefined;
    if (screen === 'setup' || screen === 'history') return () => setScreen('home');
    if (screen === 'teams') return () => setScreen('home');
    if (screen === 'bracket') return () => setScreen('home');
    if (screen === 'live_match') return () => setScreen('bracket');
    if (screen === 'results') return () => setScreen('bracket');
    return undefined;
  };

  const getHeaderMeta = () => {
    switch (screen) {
      case 'home':
        return { title: 'ArenaPro', subtitle: 'Torneios de Quadra & Areia' };
      case 'setup':
        return { title: 'Novo Torneio', subtitle: 'Configuração da competição' };
      case 'teams':
        return {
          title: activeTournament?.name ?? 'Times',
          subtitle: 'Cadastro de Times e Duplas',
        };
      case 'bracket':
        return {
          title: activeTournament?.name ?? 'Painel',
          subtitle: activeTournament
            ? getSportDisplayName(activeTournament.sport)
            : 'Chaveamento',
        };
      case 'live_match':
        return {
          title: activeTournament?.name ?? 'Partida ao Vivo',
          subtitle: activeMatch ? `Placar • Jogo ${activeMatch.matchNumber}` : 'Ao Vivo',
        };
      case 'results':
        return {
          title: activeTournament?.name ?? 'Resultado',
          subtitle: 'Pódio e Relatório Final',
        };
      case 'history':
        return { title: 'Histórico', subtitle: 'Torneios salvos neste dispositivo' };
    }
  };

  const headerMeta = publicParams
    ? { title: 'ArenaPro - Ao Vivo', subtitle: 'Acompanhamento público (somente leitura)' }
    : getHeaderMeta();

  return (
    <div className="relative min-h-screen court-lines-light text-slate-900 dark:text-slate-100 transition-colors">
      <CourtGridBackground />
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      <div className="relative z-10">
      <TopBar
        title={headerMeta.title}
        subtitle={headerMeta.subtitle}
        onBack={publicParams ? undefined : handleBack()}
        theme={settings.theme}
        onToggleTheme={() =>
          setSettings((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }))
        }
        muted={settings.muted}
        onToggleMute={() => setSettings((s) => ({ ...s, muted: !s.muted }))}
        canInstall={Boolean(installPrompt) && !isStandalone}
        onInstallClick={handleInstallClick}
      />

      {publicParams ? (
        <PublicWatchScreen
          tournamentId={publicParams.tournamentId}
          token={publicParams.token}
        />
      ) : (
        <>

      {toast && (
        <div className="fixed bottom-24 inset-x-4 max-w-sm mx-auto z-50 rounded-2xl bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 px-4 py-3 text-center text-xs font-extrabold shadow-2xl">
          {toast}
        </div>
      )}

      {screen === 'home' && (
        <HomeScreen
          tournaments={tournaments}
          onNewTournament={() => setScreen('setup')}
          onOpenTournament={handleOpenTournament}
          onOpenHistory={() => setScreen('history')}
          showIosInstallHint={isIos && !isStandalone}
        />
      )}

      {screen === 'setup' && <SetupScreen onCreate={handleCreateTournament} />}

      {screen === 'teams' && activeTournament && (
        <TeamsScreen
          tournament={activeTournament}
          onUpdateTeams={(teams: Team[]) =>
            updateActiveTournament((t) => ({ ...t, teams, updatedAt: Date.now() }))
          }
          onStartTournament={(shuffle) => {
            updateActiveTournament((t) => startTournament(t, { shuffle }));
            soundEngine.playWhistle();
            setScreen('bracket');
          }}
        />
      )}

      {screen === 'bracket' && activeTournament && (
        <BracketDashboard
          tournament={activeTournament}
          onOpenMatch={(matchId) => {
            setActiveMatchId(matchId);
            setScreen('live_match');
          }}
          onSelectDirectWinner={(matchId, winnerId) => {
            const nextState = finishMatch(activeTournament, matchId, {
              winnerId,
              scoreA: 0,
              scoreB: 0,
              sets: [],
            });
            soundEngine.playWhistle();
            updateActiveTournament(() => nextState);
            if (nextState.status === 'finished') {
              setScreen('results');
            }
          }}
          onFinishManually={() => {
            updateActiveTournament((t) => finishTournamentManually(t));
            setScreen('results');
          }}
          onOpenResults={() => setScreen('results')}
          onExportJson={() => {
            exportTournamentJson(activeTournament);
            showToastMessage('Backup JSON exportado!');
          }}
          onOpenReset={() => setShowResetModal(true)}
        />
      )}

      {screen === 'live_match' && activeTournament && activeMatch && (
        <LiveMatchScreen
          tournament={activeTournament}
          match={activeMatch}
          onUpdateLive={(updater) =>
            updateActiveTournament((t) =>
              updateLiveMatchState(t, activeMatch.id, updater),
            )
          }
          onFinishMatch={(payload) => {
            const nextState = finishMatch(activeTournament, activeMatch.id, payload);
            updateActiveTournament(() => nextState);
            setActiveMatchId(null);
            if (nextState.status === 'finished') {
              setScreen('results');
            } else {
              setScreen('bracket');
            }
          }}
        />
      )}

      {screen === 'results' && activeTournament && (
        <ResultsScreen
          tournament={activeTournament}
          onViewBracket={() => setScreen('bracket')}
          onExportJson={() => {
            exportTournamentJson(activeTournament);
            showToastMessage('Backup JSON exportado!');
          }}
          onGoHome={() => setScreen('home')}
        />
      )}

      {screen === 'history' && (
        <HistoryScreen
          tournaments={tournaments}
          onOpenTournament={handleOpenTournament}
          onDeleteTournament={(id) => {
            setTournaments((prev) => prev.filter((t) => t.id !== id));
            if (activeTournamentId === id) setActiveTournamentId(null);
          }}
          onImportJson={handleImportJson}
        />
      )}

      {showResetModal && activeTournament && (
        <ResetModal
          tournamentName={activeTournament.name}
          onClose={() => setShowResetModal(false)}
          onConfirmReset={(mode) => {
            updateActiveTournament((t) => resetTournament(t, mode));
            setShowResetModal(false);
            if (mode === 'all') {
              setScreen('teams');
              showToastMessage('Times e histórico zerados.');
            } else {
              setScreen(activeTournament.teams.length >= 2 ? 'bracket' : 'teams');
              showToastMessage('Placares e rodadas reiniciados.');
            }
          }}
        />
      )}
        </>
      )}
      </div>
    </div>
  );
}

export default App;
