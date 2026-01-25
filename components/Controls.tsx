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
        <div className="fixed bottom-0 left-0 w-full z-30 pointer-events-none flex flex-col items-center justify-end pb-4 md:pb-8">
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
            <div className="pointer-events-auto w-[92%] max-w-4xl glass rounded-2xl md:rounded-full p-2 md:p-3 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6 shadow-2xl ring-1 ring-white/10 transition-all">

                {/* 1. Status & Upload (Mobile: Top Row) */}
                <div className="w-full md:w-auto flex items-center justify-between md:justify-start gap-3 order-2 md:order-1 px-2 md:px-0">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-full border border-white/5 shadow-inner">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`}></div>
                        <span className="font-mono text-zinc-300 text-xs md:text-sm min-w-[40px]">{isConnected ? formatTime(sessionDuration) : '00:00'}</span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={openSettings}
                            className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                            title="設定"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
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
                </div>

                {/* 2. Main Action (Center) */}
                <div className="w-full md:w-auto flex flex-col items-center justify-center gap-2 order-1 md:order-2">
                    {/* Chat Input (Only when connected) */}
                    {isConnected && !showEndConfirm && (
                        <form onSubmit={handleSendText} className="relative w-full md:w-[280px] animate-fade-in-up md:absolute md:bottom-20 left-1/2 md:-translate-x-1/2">
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

                    <div className="flex items-center gap-3">
                        {/* Title Input (Hidden if connected to save space on mobile) */}
                        {!isConnected && (
                            <input
                                type="text"
                                value={meetingTitle}
                                onChange={(e) => setMeetingTitle(e.target.value)}
                                placeholder="會議名稱..."
                                className="md:block bg-transparent border-b border-zinc-700 text-center text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 w-32 transition-colors pb-1 text-sm hidden"
                            />
                        )}

                        <button
                            onClick={handleToggle}
                            className={`
                                relative group h-12 px-6 rounded-full font-bold tracking-wide transition-all duration-300 shadow-lg flex items-center gap-2 whitespace-nowrap overflow-hidden
                                ${connectionState === ConnectionState.RECONNECTING
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/50'
                                    : isConnected
                                        ? showEndConfirm
                                            ? 'bg-red-600 text-white w-full md:w-auto justify-center animate-pulse'
                                            : 'bg-red-500/10 text-red-400 border border-red-500/50 w-full md:w-auto justify-center'
                                        : 'bg-white text-black hover:bg-zinc-200 w-full md:w-auto justify-center'
                                }
                            `}
                        >
                            {/* Pulse Glow Effect for Recording */}
                            {isConnected && !showEndConfirm && <div className="absolute inset-0 rounded-full animate-pulse-glow"></div>}

                            {isConnecting ? (
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : isConnected ? (
                                showEndConfirm ? "確定結束？" : "結束會議"
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
                <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-2 order-3 px-2 md:px-0 border-t border-white/5 md:border-t-0 pt-2 md:pt-0 mt-1 md:mt-0">
                    <div className="flex items-center gap-2">
                        {/* Mic Mute */}
                        <button
                            onClick={toggleMute}
                            disabled={!isConnected}
                            className={`p-2.5 rounded-full border transition-all ${isMuted
                                ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20'
                                : 'bg-black/20 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            {isMuted ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                            )}
                        </button>

                        {/* AI Mute */}
                        <button
                            onClick={toggleAiMute}
                            className={`p-2.5 rounded-full border transition-all ${isAiMuted
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                : 'bg-black/20 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            {isAiMuted ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 10l-2 2m0-2l2 2" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 8a3 3 0 0 1 0 6" /></svg>}
                        </button>
                    </div>

                    {/* Desktop Only Extra Settings */}
                    <div className="hidden md:flex items-center gap-2">
                        <button
                            onClick={() => !isConnected && setUseSystemAudio(!useSystemAudio)}
                            disabled={isConnected}
                            className={`text-xs px-2 py-1 rounded border transition-colors ${useSystemAudio ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
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