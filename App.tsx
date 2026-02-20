import React, { useState } from 'react';
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

  // Mobile Tab State: 'transcript' (default) or 'assistant'
  // using boolean: false = transcript, true = assistant
  const [isMobileAssistantOpen, setIsMobileAssistantOpen] = useState(false);

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

      {/* Sidebar Toggle for when it is closed (Desktop/Mobile) */}
      {!isSidebarOpen && (
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg bg-surface border border-zinc-800 text-zinc-400 hover:text-white transition-colors shadow-lg backdrop-blur-sm bg-zinc-900/80"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      )}

      {/* 2. Main Stage (Live) */}
      {/* On Mobile: Hidden if Assistant is OPEN */}
      <main className={`flex-1 flex flex-col relative min-w-0 bg-background ${isMobileAssistantOpen ? 'hidden md:flex' : 'flex'}`}>

        {/* Background Ambient */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 opacity-40">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]"></div>
        </div>

        {/* Header/Status Bar */}
        {/* Added pl-16 to avoid collision with hamburger button on mobile */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800/50 bg-background/50 backdrop-blur-sm z-10 shrink-0 pl-16 md:pl-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
            <span className="text-xs font-mono text-zinc-500 tracking-wider">系統就緒 ({settings.appName})</span>
          </div>
          <div className="text-xs text-zinc-600 font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-700"></span>
            LIVE-2.5-FLASH-NATIVE-AUDIO
          </div>
        </header>

        {/* Content Container */}
        <div className="flex-1 flex flex-col relative z-10 overflow-hidden min-h-0 pb-0">

          {/* Visualizer Floating Overlay */}
          {viewMode === 'meeting' && (
            <div className="absolute top-4 right-4 z-20 pointer-events-none opacity-50 mix-blend-screen hidden md:block">
              {/* Hidden visualizer on mobile to save space/performance */}
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
              {/* Added padding bottom on mobile to account for the bottom nav bar + raised controls */}
              <div className="shrink-0 z-30 pb-24 md:pb-0">
                <Controls />
              </div>
            </>
          )}
        </div>
      </main>

      {/* 3. Right Panel (Assistant) */}
      {/* On Mobile: Visible ONLY if Assistant is OPEN */}
      {viewMode === 'meeting' && (
        <div className={`
             md:flex md:static md:z-auto md:bg-transparent
             ${isMobileAssistantOpen ? 'fixed inset-0 z-40 bg-background flex flex-col' : 'hidden'}
         `}>
          <AssistantPanel />
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Visible ONLY on Mobile + Meeting Mode) */}
      {viewMode === 'meeting' && (
        <div className="md:hidden fixed bottom-0 left-0 w-full z-[100] bg-zinc-900 border-t border-white/10 pb-6 pt-1">
          <div className="flex items-center p-2 gap-2">
            <button
              onClick={() => setIsMobileAssistantOpen(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${!isMobileAssistantOpen ? 'bg-zinc-800 text-white' : 'text-zinc-500 active:bg-zinc-800/50'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              <span className="text-sm font-medium">即時逐字稿</span>
            </button>
            <button
              onClick={() => setIsMobileAssistantOpen(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${isMobileAssistantOpen ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-zinc-500 active:bg-zinc-800/50'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <span className="text-sm font-medium">AI 助手</span>
            </button>
          </div>
        </div>
      )}

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
