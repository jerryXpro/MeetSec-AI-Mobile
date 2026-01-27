import React, { useState, useRef } from 'react';
import { useLive } from '../hooks/useLive';
import { useApp } from '../contexts/AppContext';
import { ConnectionState } from '../types';
import { downloadTranscriptAsText } from '../utils/downloadUtils';

const Controls: React.FC = () => {
    const {
        connect,
        disconnect,
        connectionState,
        error,
        sessionDuration,
        uploadFile,
        isProcessingFile,
        meetingTitle,
        setMeetingTitle,
        messages,
        isMuted,
        toggleMute,
        isAiMuted,
        toggleAiMute,

        fullAudioUrl, // New: Audio download URL
        resetSession,
        sendTextMessage
    } = useLive();

    const { settings, updateSettings, setSidebarOpen, setSidebarTab } = useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [useSystemAudio, setUseSystemAudio] = useState(false);
    const [showEndConfirm, setShowEndConfirm] = useState(false);

    // Chat Input State
    const [chatInput, setChatInput] = useState("");

    const handleToggle = () => {
        if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING || connectionState === ConnectionState.RECONNECTING) {
            if (!showEndConfirm) {
                setShowEndConfirm(true);
                // Reset confirmation after 3 seconds if not confirmed
                setTimeout(() => setShowEndConfirm(false), 3000);
            } else {
                disconnect();
                setShowEndConfirm(false);
            }
        } else {
            connect(useSystemAudio);
        }
    };

    const handleSendText = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (chatInput.trim()) {
            await sendTextMessage(chatInput);
            setChatInput("");
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadFile(file);
        }
        // Reset input so same file can be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const openSettings = () => {
        setSidebarOpen(true);
        setSidebarTab('settings');
    };

    const handleDownloadTranscript = () => {
        const title = meetingTitle.trim() || `Meeting_${new Date().toISOString().slice(0, 10)}`;
        downloadTranscriptAsText(messages, title);
    };

    const handleDownloadAudio = () => {
        if (!fullAudioUrl) return;
        const title = meetingTitle.trim() || `Meeting_${new Date().toISOString().slice(0, 10)}`;
        const a = document.createElement('a');
        a.href = fullAudioUrl;
        a.download = `${title}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };


    const isConnected = connectionState === ConnectionState.CONNECTED;
    const isConnecting = connectionState === ConnectionState.CONNECTING || connectionState === ConnectionState.RECONNECTING;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full z-30 pointer-events-none flex flex-col items-center justify-end pb-4 md:pb-8">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="audio/*,.aac,.m4a,.mp3,.wav,.ogg,.flac"
            />

            {error && (
                <div className="pointer-events-auto mb-4 bg-red-900/80 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg backdrop-blur-sm animate-fade-in-up">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {error}
                </div>
            )}

            {/* Floating Glass Bar */}
            <div className={`pointer-events-auto w-[92%] max-w-4xl glass rounded-2xl md:rounded-full transition-all shadow-2xl ring-1 ring-white/10 ${isConnected ? 'p-2 flex flex-row items-center justify-between gap-2' : 'p-2 md:p-3 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6'}`}>

                {/* 1. Status & Upload (Mobile: Top Row normally, Left Col if Connected) */}
                <div className={`flex items-center gap-3 order-2 md:order-1 px-2 md:px-0 ${isConnected ? 'w-auto' : 'w-full md:w-auto justify-between md:justify-start'}`}>
                    <div className={`flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-full border border-white/5 shadow-inner ${isConnected ? 'py-2 px-4' : ''}`}>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`}></div>
                        <span className="font-mono text-zinc-300 text-xs md:text-sm min-w-[40px]">{isConnected ? formatTime(sessionDuration) : '00:00'}</span>
                    </div>

                    {!isConnected && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={openSettings}
                                className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                                title="設定"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </button>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isConnected || isProcessingFile}
                                className={`p-2 rounded-full transition-colors ${isConnected || isProcessingFile ? 'opacity-30 cursor-not-allowed text-zinc-600' : 'hover:bg-white/10 text-zinc-400 hover:text-blue-400'}`}
                                title="上傳音檔"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            </button>
                        </div>
                    )}
                </div>

                {/* 2. Main Action (Center/Right if Connected) */}
                <div className={`flex flex-col items-center justify-center gap-2 order-1 md:order-2 ${isConnected ? 'flex-1 flex-row justify-end pr-1' : 'w-full md:w-auto'}`}>
                    {/* Chat Input (Only when connected) - Mobile Layout Adjustment */}
                    {isConnected && !showEndConfirm && (
                        /* On mobile compact mode, hiding chat input or making it very small? 
                           User request is to shrink the box. 
                           Let's keep chat input but maybe smaller or relying on the 'Input text' request separately?
                           For now, let's HIDE the Floating Chat Input in the 'Controls' if it takes too much space, 
                           OR position it differently.
                           Actually, the user sees "Red Box" as the controls. 
                           If I make the controls small rows, the chat input might be floating ABOVE?
                           Code says: `md:absolute md:bottom-20`. On mobile it is relative inside this div.
                           Let's move it to "absolute bottom-full mb-4 w-full" on mobile to float it?
                           That would solve "blocks content" if the box shrinks.
                        */
                        <form onSubmit={handleSendText} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-[90%] md:w-[280px] animate-fade-in-up md:mb-0 md:bottom-20 z-10">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="輸入訊息..."
                                className="w-full bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 pl-4 pr-10 text-sm text-white focus:outline-none focus:border-blue-500/50 shadow-lg transition-all placeholder-zinc-500"
                            />
                            <button type="submit" disabled={!chatInput.trim()} className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-blue-400 hover:text-blue-300 disabled:opacity-30"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg></button>
                        </form>
                    )}

                    <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                        {!isConnected && (
                            <input
                                type="text"
                                value={meetingTitle}
                                onChange={(e) => setMeetingTitle(e.target.value)}
                                placeholder="會議名稱..."
                                className="block bg-transparent border-b border-zinc-700 text-center text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 w-full max-w-[200px] md:w-32 transition-colors pb-1 text-sm"
                            />
                        )}

                        <button
                            onClick={handleToggle}
                            className={`
                                relative group rounded-full font-bold tracking-wide transition-all duration-300 shadow-lg flex items-center gap-2 whitespace-nowrap overflow-hidden
                                ${connectionState === ConnectionState.RECONNECTING
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/50 h-10 px-4'
                                    : isConnected
                                        ? showEndConfirm
                                            ? 'bg-red-600 text-white w-auto px-4 h-10 animate-pulse text-sm'
                                            : 'bg-red-500/10 text-red-500 border border-red-500/50 w-10 h-10 justify-center p-0' // Compact Circle
                                        : 'bg-white text-black hover:bg-zinc-200 w-full md:w-auto justify-center h-12 px-6'
                                }
                            `}
                            title={isConnected ? "結束會議" : "開始錄製"}
                        >
                            {isConnected && !showEndConfirm && <div className="absolute inset-0 rounded-full animate-pulse-glow"></div>}

                            {isConnecting ? (
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : isConnected ? (
                                showEndConfirm ? <span>確定?</span> : <div className="w-3 h-3 rounded bg-current"></div>
                            ) : (
                                <>
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                    開始錄製
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* 3. Toggles (Mobile: Bottom Row or Menu) */}
                <div className={`flex items-center gap-2 order-3 px-2 md:px-0 ${isConnected ? 'border-none w-auto justify-end' : 'w-full md:w-auto justify-between md:justify-end border-t border-white/5 md:border-t-0 pt-2 md:pt-0 mt-1 md:mt-0'}`}>
                    <div className="flex items-center gap-2">
                        {/* Mic Mute */}
                        <button
                            onClick={toggleMute}
                            disabled={!isConnected}
                            className={`rounded-full border transition-all ${isMuted
                                ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20 p-2'
                                : 'bg-black/20 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 p-2'
                                }`}
                        >
                            {isMuted ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                            )}
                        </button>

                        {/* AI Mute */}
                        <button
                            onClick={toggleAiMute}
                            className={`rounded-full border transition-all ${isAiMuted
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 p-2'
                                : 'bg-black/20 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 p-2'
                                }`}
                        >
                            {isAiMuted ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 10l-2 2m0-2l2 2" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 8a3 3 0 0 1 0 6" /></svg>}
                        </button>
                    </div>

                    {/* Desktop Only Extra Settings */}
                    <div className="flex items-center gap-2">
                        {/* Voice Selector (Mobile & Desktop) */}
                        <div className="relative">
                            <button
                                onClick={() => { setSidebarOpen(false); /* Close sidebar if open to avoid clash */ }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    // Toggle logic handled by parent or local state? 
                                    // Let's use a local state for this dropdown 
                                    const el = document.getElementById('voice-dropdown');
                                    if (el) el.classList.toggle('hidden');
                                }}
                                className={`text-xs px-2 py-1.5 rounded-lg border border-white/10 bg-black/20 text-zinc-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5 ${isConnected ? 'bg-transparent border-transparent px-1' : ''}`}
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                <span className={isConnected ? 'hidden' : ''}>{settings.voiceName || 'Aoede'}</span>
                            </button>

                            {/* Dropdown Menu (Fixed Position to avoid clipping) */}
                            <div id="voice-dropdown" className="hidden absolute bottom-full right-0 mb-2 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in-up">
                                <div className="p-2 space-y-1">
                                    <div className="text-[0.7em] text-zinc-500 font-bold px-2 py-1 uppercase tracking-wider">女聲 (Female)</div>
                                    {['Aoede', 'Kore'].map(voice => (
                                        <button
                                            key={voice}
                                            onClick={() => {
                                                updateSettings({ voiceName: voice });
                                                document.getElementById('voice-dropdown')?.classList.add('hidden');
                                            }}
                                            className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${settings.voiceName === voice ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                                        >
                                            {voice}
                                        </button>
                                    ))}
                                    <div className="text-[0.7em] text-zinc-500 font-bold px-2 py-1 uppercase tracking-wider mt-2">男聲 (Male)</div>
                                    {['Puck', 'Charon', 'Fenrir'].map(voice => (
                                        <button
                                            key={voice}
                                            onClick={() => {
                                                updateSettings({ voiceName: voice });
                                                document.getElementById('voice-dropdown')?.classList.add('hidden');
                                            }}
                                            className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors ${settings.voiceName === voice ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                                        >
                                            {voice}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => !isConnected && setUseSystemAudio(!useSystemAudio)}
                            disabled={isConnected}
                            className={`hidden md:block text-xs px-2 py-1 rounded border transition-colors ${useSystemAudio ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                        >
                            {useSystemAudio ? '系統音訊' : '僅麥克風'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Controls;