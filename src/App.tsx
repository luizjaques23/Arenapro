import { useCallback, useEffect, useState } from 'react';
import { BracketDashboard } from './components/BracketDashboard';
import { CourtGridBackground } from './components/CourtGridBackground';
import { EditTeamsModal } from './components/EditTeamsModal';
import { HistoryScreen } from './components/HistoryScreen';
import { HomeScreen } from './components/HomeScreen';
import { LiveMatchScreen } from './components/LiveMatchScreen';
import { PinUnlockModal } from './components/PinUnlockModal';
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
  updateTournamentTeamsInPlace,
} from './engine/tournamentEngine';
import {
  deleteTournamentFromSync,
  fetchGlobalCreatedTournaments,
  parsePublicRouteFromLocation,
  publishTournamentLive,
  type PublicRouteParams,
} from './services/liveSync';
import {
  isTournamentUnlockedInSession,
  lockTournamentSession,
  removeTournamentPinData,
  unlockTournamentSession,
} from './services/pinAuth';
import { soundEngine } from './services/sound';
import {
  exportTournamentJson,
  loadDeletedTournamentIds,
  loadSettings,
  loadTournaments,
  markTournamentDeleted,
  parseImportedTournament,
  pruneExpiredTournaments,
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
  const [publicParams, setPublicParams] = useState<PublicRouteParams | null>(() =>
    parsePublicRouteFromLocation(),
  );

  const [showSplash, setShowSplash] = useState(!publicParams);
  const [screen, setScreen] = useState<Screen>('home');
  const [tournaments, setTournaments] = useState<Tournament[]>(() => loadTournaments());
  const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showEditTeamsModal, setShowEditTeamsModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [pendingPinRequest, setPendingPinRequest] = useState<{
    tournamentId: string;
    action: 'open' | 'delete';
  } | null>(null);

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
    if (active) {
      void publishTournamentLive(active);
    }
  }, [tournaments, publicParams, activeTournamentId]);

  // Automatic 24h history cleanup (runs periodically and on tab focus, zero manual action needed)
  useEffect(() => {
    if (publicParams) return;

    const cleanupExpired = () => {
      setTournaments((prev) => {
        const { active, removedIds } = pruneExpiredTournaments(prev);
        if (removedIds.length === 0) return prev;
        for (const id of removedIds) {
          removeTournamentPinData(id);
        }
        return active;
      });
    };

    cleanupExpired();
    const intervalId = window.setInterval(cleanupExpired, 60_000);
    window.addEventListener('focus', cleanupExpired);

    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key || e.key === 'arenapro_tournaments_v1') {
        setTournaments(loadTournaments());
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', cleanupExpired);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [publicParams]);

  // Cross-device discovery: sync created tournaments across computers/phones (protected by password)
  useEffect(() => {
    if (publicParams) return;
    let cancelled = false;

    const syncDirectory = async () => {
      try {
        const { tournaments: remoteList, deletedIds: remoteDeleted } =
          await fetchGlobalCreatedTournaments();
        if (cancelled) return;

        const localDeleted = loadDeletedTournamentIds();
        const combinedDeleted = new Set([...localDeleted, ...remoteDeleted]);
        for (const delId of remoteDeleted) {
          markTournamentDeleted(delId);
        }

        setTournaments((prev) => {
          const mergedMap = new Map<string, Tournament>();

          for (const localItem of prev) {
            if (!combinedDeleted.has(localItem.id)) {
              mergedMap.set(localItem.id, localItem);
            }
          }

          for (const remoteItem of remoteList) {
            if (combinedDeleted.has(remoteItem.id)) continue;
            const existing = mergedMap.get(remoteItem.id);
            if (!existing) {
              mergedMap.set(remoteItem.id, remoteItem);
            } else if (existing.id !== activeTournamentId) {
              const shouldTakeRemote =
                (remoteItem.updatedAt ?? 0) > (existing.updatedAt ?? 0);
              const preservedPinHash =
                existing.pinHash && existing.pinHash !== '__REMOTE_LOCKED__'
                  ? existing.pinHash
                  : remoteItem.pinHash;

              if (shouldTakeRemote) {
                mergedMap.set(remoteItem.id, {
                  ...remoteItem,
                  ...(preservedPinHash ? { pinHash: preservedPinHash } : {}),
                });
              } else if (
                (!existing.pinHash || existing.pinHash === '__REMOTE_LOCKED__') &&
                remoteItem.pinHash &&
                remoteItem.pinHash !== '__REMOTE_LOCKED__'
              ) {
                mergedMap.set(remoteItem.id, {
                  ...existing,
                  pinHash: remoteItem.pinHash,
                });
              }
            }
          }

          const { active } = pruneExpiredTournaments(Array.from(mergedMap.values()));
          saveTournaments(active);
          return active;
        });
      } catch {
        // Ignore temporary offline errors
      }
    };

    void syncDirectory();
    const timer = window.setInterval(() => {
      void syncDirectory();
    }, 15_000);
    const onFocusSync = () => {
      void syncDirectory();
    };
    window.addEventListener('focus', onFocusSync);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocusSync);
    };
  }, [publicParams, activeTournamentId]);

  useEffect(() => {
    const handlePopState = () => {
      setPublicParams(parsePublicRouteFromLocation());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
  const isActiveUnlocked = isTournamentUnlockedInSession(activeTournament);

  const activeMatch =
    activeTournament && activeMatchId && isActiveUnlocked
      ? findMatch(activeTournament, activeMatchId) ?? null
      : null;

  const pendingUnlockTournament = pendingPinRequest
    ? tournaments.find((t) => t.id === pendingPinRequest.tournamentId) ?? null
    : null;

  const enterTournamentDirect = (target: Tournament) => {
    setActiveTournamentId(target.id);
    if (target.status === 'setup') setScreen('teams');
    else if (target.status === 'finished') setScreen('results');
    else setScreen('bracket');
  };

  const updateActiveTournament = (updater: (t: Tournament) => Tournament) => {
    if (!activeTournamentId || !activeTournament) return;
    if (!isTournamentUnlockedInSession(activeTournament)) {
      setPendingPinRequest({ tournamentId: activeTournament.id, action: 'open' });
      return;
    }
    setTournaments((prev) => {
      const next = prev.map((t) => (t.id === activeTournamentId ? updater(t) : t));
      saveTournaments(next);
      return next;
    });
  };

  const handleCreateTournament = (setup: SetupResult) => {
    const created = createTournament(setup);
    // Automatically authorize the newly created tournament in the current sessionStorage
    unlockTournamentSession(created.id);
    setTournaments((prev) => {
      const next = [created, ...prev];
      saveTournaments(next);
      return next;
    });
    void publishTournamentLive(created);
    setActiveTournamentId(created.id);
    setScreen('teams');
  };

  const handleOpenTournament = (id: string) => {
    const target = tournaments.find((t) => t.id === id);
    if (!target) return;

    // Require the tournament's password before opening/managing from Home or History
    lockTournamentSession();
    setPendingPinRequest({ tournamentId: target.id, action: 'open' });
  };

  const handleDeleteTournament = (id: string) => {
    const target = tournaments.find((t) => t.id === id);
    if (!target) return;

    // Always require the tournament's created password before deleting
    setPendingPinRequest({ tournamentId: target.id, action: 'delete' });
  };

  const handlePinUnlocked = (tournamentId: string, newPinHash?: string) => {
    const req = pendingPinRequest;
    setPendingPinRequest(null);

    if (newPinHash) {
      setTournaments((prev) => {
        const next = prev.map((t) =>
          t.id === tournamentId ? { ...t, pinHash: newPinHash } : t,
        );
        saveTournaments(next);
        return next;
      });
    }

    const target = tournaments.find((t) => t.id === tournamentId);
    if (!target) return;

    if (req?.action === 'delete') {
      removeTournamentPinData(tournamentId);
      markTournamentDeleted(tournamentId);
      void deleteTournamentFromSync(target);
      setTournaments((prev) => {
        const next = prev.filter((t) => t.id !== tournamentId);
        saveTournaments(next);
        return next;
      });
      if (activeTournamentId === tournamentId) {
        lockTournamentSession();
        setActiveTournamentId(null);
        setActiveMatchId(null);
        setShowResetModal(false);
        setShowEditTeamsModal(false);
        setScreen('home');
      }
      showToastMessage('Torneio excluído.');
      return;
    }

    enterTournamentDirect(
      newPinHash ? { ...target, pinHash: newPinHash } : target,
    );
  };

  const handleImportJson = (rawText: string) => {
    try {
      const imported = parseImportedTournament(rawText);
      setTournaments((prev) => {
        const next = [imported, ...prev];
        saveTournaments(next);
        return next;
      });
      void publishTournamentLive(imported);
      showToastMessage(`Torneio "${imported.name}" importado!`);
      if (imported.status !== 'finished') {
        lockTournamentSession();
        setPendingPinRequest({ tournamentId: imported.id, action: 'open' });
      } else {
        enterTournamentDirect(imported);
      }
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

  const leaveToHome = () => {
    lockTournamentSession();
    setActiveTournamentId(null);
    setActiveMatchId(null);
    setScreen('home');
  };

  const handleBack = (): (() => void) | undefined => {
    if (screen === 'home') return undefined;
    if (screen === 'setup' || screen === 'history') return leaveToHome;
    if (screen === 'teams') return leaveToHome;
    if (screen === 'bracket') return leaveToHome;
    if (screen === 'live_match') return () => setScreen('bracket');
    if (screen === 'results') return () => setScreen('bracket');
    return undefined;
  };

  const exitPublicView = () => {
    if (typeof window !== 'undefined' && window.location.search) {
      const cleanedPath =
        window.location.pathname.replace(/\/acompanhar\/[^/]+\/?$/, '/') || '/';
      window.history.replaceState({}, '', cleanedPath);
    }
    setPublicParams(null);
    setTournaments(loadTournaments());
    setScreen('home');
  };

  const isInsideProtectedTournament =
    !publicParams &&
    Boolean(activeTournament) &&
    (screen === 'teams' ||
      screen === 'bracket' ||
      screen === 'live_match' ||
      screen === 'results');

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
    ? { title: 'ArenaPro - Visualização', subtitle: 'Acesso público (somente leitura)' }
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
          onDeleteTournament={
            isInsideProtectedTournament && activeTournament
              ? () => handleDeleteTournament(activeTournament.id)
              : undefined
          }
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
            onExitPublicView={exitPublicView}
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

            {screen === 'teams' && activeTournament && isActiveUnlocked && (
              <TeamsScreen
                tournament={activeTournament}
                onUpdateTeams={(teams: Team[]) =>
                  updateActiveTournament((t) => updateTournamentTeamsInPlace(t, teams))
                }
                onStartTournament={(shuffle) => {
                  updateActiveTournament((t) => startTournament(t, { shuffle }));
                  soundEngine.playWhistle();
                  setScreen('bracket');
                }}
                onDeleteTournament={() => handleDeleteTournament(activeTournament.id)}
              />
            )}

            {screen === 'bracket' && activeTournament && isActiveUnlocked && (
              <BracketDashboard
                tournament={activeTournament}
                onOpenMatch={(matchId) => {
                  if (!isTournamentUnlockedInSession(activeTournament)) return;
                  setActiveMatchId(matchId);
                  setScreen('live_match');
                }}
                onSelectDirectWinner={(matchId, winnerId) => {
                  if (!isTournamentUnlockedInSession(activeTournament)) return;
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
                  if (!isTournamentUnlockedInSession(activeTournament)) return;
                  updateActiveTournament((t) => finishTournamentManually(t));
                  setScreen('results');
                }}
                onOpenResults={() => setScreen('results')}
                onExportJson={() => {
                  exportTournamentJson(activeTournament);
                  showToastMessage('Backup JSON exportado!');
                }}
                onOpenReset={() => {
                  if (!isTournamentUnlockedInSession(activeTournament)) return;
                  setShowResetModal(true);
                }}
                onEditTeams={() => {
                  if (!isTournamentUnlockedInSession(activeTournament)) return;
                  setShowEditTeamsModal(true);
                }}
                onDeleteTournament={() => handleDeleteTournament(activeTournament.id)}
              />
            )}

            {screen === 'live_match' &&
              activeTournament &&
              activeMatch &&
              isActiveUnlocked && (
                <LiveMatchScreen
                  tournament={activeTournament}
                  match={activeMatch}
                  onUpdateLive={(updater) =>
                    updateActiveTournament((t) =>
                      updateLiveMatchState(t, activeMatch.id, updater),
                    )
                  }
                  onFinishMatch={(payload) => {
                    if (!isTournamentUnlockedInSession(activeTournament)) return;
                    const nextState = finishMatch(
                      activeTournament,
                      activeMatch.id,
                      payload,
                    );
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

            {screen === 'results' &&
              activeTournament &&
              (activeTournament.status === 'finished' || isActiveUnlocked) && (
                <ResultsScreen
                  tournament={activeTournament}
                  onViewBracket={() => {
                    if (
                      activeTournament.status !== 'finished' &&
                      !isTournamentUnlockedInSession(activeTournament)
                    ) {
                      setPendingPinRequest({
                        tournamentId: activeTournament.id,
                        action: 'open',
                      });
                      return;
                    }
                    setScreen('bracket');
                  }}
                  onEditTeams={
                    isActiveUnlocked
                      ? () => setShowEditTeamsModal(true)
                      : undefined
                  }
                  onExportJson={() => {
                    exportTournamentJson(activeTournament);
                    showToastMessage('Backup JSON exportado!');
                  }}
                  onGoHome={leaveToHome}
                />
              )}

            {screen === 'history' && (
              <HistoryScreen
                tournaments={tournaments}
                onOpenTournament={handleOpenTournament}
                onDeleteTournament={handleDeleteTournament}
                onImportJson={handleImportJson}
              />
            )}

            {showEditTeamsModal && activeTournament && isActiveUnlocked && (
              <EditTeamsModal
                tournament={activeTournament}
                onClose={() => setShowEditTeamsModal(false)}
                onSaveTeams={(updatedTeams) => {
                  if (!isTournamentUnlockedInSession(activeTournament)) return;
                  updateActiveTournament((t) =>
                    updateTournamentTeamsInPlace(t, updatedTeams),
                  );
                  setShowEditTeamsModal(false);
                  showToastMessage('Duplas atualizadas com sucesso!');
                }}
              />
            )}

            {showResetModal && activeTournament && isActiveUnlocked && (
              <ResetModal
                tournamentName={activeTournament.name}
                onClose={() => setShowResetModal(false)}
                onConfirmReset={(mode) => {
                  if (!isTournamentUnlockedInSession(activeTournament)) return;
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

            {pendingUnlockTournament && (
              <PinUnlockModal
                tournament={pendingUnlockTournament}
                action={pendingPinRequest?.action ?? 'open'}
                onClose={() => setPendingPinRequest(null)}
                onUnlocked={handlePinUnlocked}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
