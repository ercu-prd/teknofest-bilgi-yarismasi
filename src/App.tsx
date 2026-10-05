import React, { Suspense, lazy } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { Header } from './components/common/Header';
import { LogoSpinnerBlock } from './components/ui/LogoSpinner';
import { APP_CONFIG } from './config/appConfig';

import { HomeScreen } from './components/screens/HomeScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { VsScreen } from './components/screens/VsScreen';
import { QuizScreen } from './components/screens/QuizScreen';

// Screens that most players never open (or open once) are split into their own
// chunks so the first load on a phone at the stand stays small.
const ResultScreen = lazy(() => import('./components/screens/ResultScreen').then((m) => ({ default: m.ResultScreen })));
const MatchmakingScreen = lazy(() => import('./components/screens/MatchmakingScreen'));
const TournamentScreen = lazy(() => import('./components/screens/TournamentScreen'));
const LeaderboardScreen = lazy(() => import('./components/screens/LeaderboardScreen'));
const AdminScreen = lazy(() => import('./components/screens/AdminScreen'));

const ScreenFallback: React.FC = () => <LogoSpinnerBlock />;

const isStandMode = () => typeof window !== 'undefined' && window.location.hash.startsWith('#/leaderboard');

const MainContent: React.FC = () => {
  const { currentScreen } = useGame();

  const renderScreen = () => {
    switch (currentScreen) {
      case 'HOME':
        return <HomeScreen />;
      case 'LOBBY':
        return <LobbyScreen />;
      case 'VS':
        return <VsScreen />;
      case 'QUIZ':
        return <QuizScreen />;
      case 'RESULT':
        return <ResultScreen />;
      case 'MATCHMAKING':
        return <MatchmakingScreen />;
      case 'TOURNAMENT':
        return <TournamentScreen />;
      case 'LEADERBOARD':
        return <LeaderboardScreen standMode={isStandMode()} />;
      case 'ADMIN':
        return <AdminScreen />;
      default:
        return <HomeScreen />;
    }
  };

  const standMode = currentScreen === 'LEADERBOARD' && isStandMode();

  return (
    <div className="min-h-dvh flex flex-col bg-canvas">
      {!standMode && <Header />}

      <main className={`flex-1 w-full mx-auto px-4 py-5 ${standMode ? 'max-w-7xl' : currentScreen === 'ADMIN' ? 'max-w-3xl' : 'max-w-md'}`}>
        <Suspense fallback={<ScreenFallback />}>{renderScreen()}</Suspense>
      </main>

      {!standMode && (
        <footer className="safe-bottom border-t border-line bg-surface px-4 pt-3 text-center text-xs text-muted">
          {APP_CONFIG.universityName} · {APP_CONFIG.clubName}
        </footer>
      )}
    </div>
  );
};

export default function App() {
  return (
    <GameProvider>
      <MainContent />
    </GameProvider>
  );
}
