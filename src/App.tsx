import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { Header } from './components/common/Header';
import { CyberBackground } from './components/common/CyberBackground';

import { HomeScreen } from './components/screens/HomeScreen';
import { LobbyScreen } from './components/screens/LobbyScreen';
import { VsScreen } from './components/screens/VsScreen';
import { QuizScreen } from './components/screens/QuizScreen';
import { ResultScreen } from './components/screens/ResultScreen';

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
      default:
        return <HomeScreen />;
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      <CyberBackground />
      <Header />
      
      <main className="flex-1 flex flex-col justify-center px-3 py-6 z-10">
        {renderScreen()}
      </main>

      {/* Footer Branding */}
      <footer className="z-10 py-3 text-center border-t border-slate-900 bg-[#070a12]/60 backdrop-blur-md">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-subheading">
          TEKNOFEST Üniversite Kulübü • 1v1 Arena v1.0
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
