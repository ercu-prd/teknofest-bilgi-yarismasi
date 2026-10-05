import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { GameProvider, useGame } from './context/GameContext';
import { Header } from './components/common/Header';
import { CyberBackground } from './components/common/CyberBackground';

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

const ScreenFallback: React.FC = () => (
  <div className="flex items-center justify-center py-20 text-cyan-400" role="status" aria-label="Yükleniyor">
    <Loader2 className="w-8 h-8 animate-spin" />
  </div>
);

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

  return (
    <div className="relative min-h-screen flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      <CyberBackground />
      <Header />

      <main className="flex-1 flex flex-col justify-center px-3 py-6 z-10">
        <Suspense fallback={<ScreenFallback />}>{renderScreen()}</Suspense>
      </main>

      {/* Footer Branding */}
      <footer className="z-10 py-3 text-center border-t border-slate-900 bg-[#070a12]/60 backdrop-blur-md">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-subheading">
          TEKNOFEST Üniversite Kulübü • 1v1 Arena v2.0
        </p>
      </footer>
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
