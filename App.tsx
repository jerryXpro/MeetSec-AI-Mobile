import React from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import { LiveProvider } from './contexts/LiveContext';
import Transcript from './components/Transcript';
import Controls from './components/Controls';

import AudioVisualizer from './components/AudioVisualizer';
import RecorderView from './components/RecorderView';
import Sidebar from './components/Sidebar';
import AssistantPanel from './components/AssistantPanel';

const AppLayout: React.FC = () => {
  const { isSidebarOpen, setSidebarOpen, settings, viewMode } = useApp();

  // Map settings to Tailwind classes
  const fontFamilyClass = {
    'sans': 'font-sans',
    'serif': 'font-serif',
    'mono': 'font-mono'
  }[settings.fontFamily] || 'font-sans';

  const uiFontSizeClass = {
    'sm': 'text-xs',
    'md': 'text-sm',
    'lg': 'text-base'
  }[settings.uiFontSize] || 'text-sm';

  return (
    <div className={`flex h-screen bg-background text-zinc-100 overflow-hidden selection:bg-blue-500/30 ${fontFamilyClass} ${uiFontSizeClass}`}>

      {/* 1. Left Sidebar (History & Settings) */}
      <Sidebar />

      {/* Sidebar Toggle specific for when it is closed */}
      {!isSidebarOpen && (
        <div className="absolute top-4 left-4 z-50">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg bg-surface border border-zinc-800 text-zinc-400 hover:text-white transition-colors shadow-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      )}

      {/* 2. Main Stage (Live) */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-background">

        {/* Background Ambient */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 opacity-40">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]"></div>
        </div>

        {/* Header/Status Bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800/50 bg-background/50 backdrop-blur-sm z-10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
            <span className="text-xs font-mono text-zinc-500 tracking-wider">系統就緒 ({settings.appName})</span>
          </div>
          <div className="text-xs text-zinc-600 font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-700"></span>
            GEMINI-2.5-FLASH-NATIVE
          </div>
        </header>

        {/* Content Container - Added padding for floating controls */}
        <div className="flex-1 flex flex-col relative z-10 overflow-hidden min-h-0 pb-32 md:pb-24">

          {/* Visualizer Floating Overlay */}
          {/* Visualizer Floating Overlay */}
          {viewMode === 'meeting' && (
            <div className="absolute top-4 right-4 z-20 pointer-events-none opacity-50 mix-blend-screen">
              <AudioVisualizer />
            </div>
          )}

          {viewMode === 'recording' ? (
            <div className="flex-1 relative flex flex-col min-h-0 bg-zinc-950 z-30">
              <RecorderView />
            </div>
          ) : (
            <>
              {/* Transcript Area */}
              <div className="flex-1 relative flex flex-col min-h-0">
                <Transcript />
              </div>

              {/* Controls Bar */}
              <div className="shrink-0 z-30">
                <Controls />
              </div>
            </>
          )}
        </div>
      </main>

      {/* 3. Right Panel (Assistant) */}
      {viewMode === 'meeting' && <AssistantPanel />}

    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <LiveProvider>
        <AppLayout />
      </LiveProvider>
    </AppProvider>
  );
};

export default App;
