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
        <div className="bg-surface/90 backdrop-blur-xl border-t border-zinc-800 p-4 z-30">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="audio/*,.aac,.m4a,.mp3,.wav,.ogg,.flac"
            />

            {error && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-red-900/80 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow-lg backdrop-blur-sm animate-fade-in-up">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {error}
                </div>
            )}

            <div className="flex items-center justify-between max-w-5xl mx-auto">

                {/* Left: Stats & Upload */}
                <div className="flex items-center gap-4 w-1/3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-full border border-zinc-800 shadow-inner">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`}></div>
                        <span className="font-mono text-zinc-400 min-w-[40px]">{isConnected ? formatTime(sessionDuration) : '00:00'}</span>
                    </div>

                    <button
                        onClick={openSettings}
                        className="p-2 rounded-full hover:bg-zinc-800 text-icon hover:text-zinc-300 transition-colors"
                        title="設定"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>

                    {/* Upload Button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isConnected || isProcessingFile}
                        className={`p-2 rounded-full transition-colors flex items-center gap-2 ${isConnected || isProcessingFile ? 'opacity-50 cursor-not-allowed text-zinc-600' : 'hover:bg-zinc-800 text-icon hover:text-blue-400'}`}
                        title="上傳音檔轉錄"
                    >
                        {isProcessingFile ? (
                            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        )}
                    </button>

                    {/* Download Transcript Button */}
                    {messages.length > 0 && (
                        <button
                            onClick={handleDownloadTranscript}
                            className="p-2 rounded-full hover:bg-zinc-800 text-icon hover:text-green-400 transition-colors"
                            title="下載對話紀錄 (.txt)"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                    )}

                    {/* New: Download Audio Button */}
                    {fullAudioUrl && (
                        <button
                            onClick={handleDownloadAudio}
                            className="p-2 rounded-full hover:bg-zinc-800 text-icon hover:text-purple-400 transition-colors animate-fade-in-up"
                            title="下載完整會議錄音 (.webm)"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        </button>
                    )}
                </div>

                {/* Center: Main Control */}
                <div className="flex flex-col items-center justify-start w-1/3 min-h-[80px]">
                    <div className="h-[4px]"></div>
                    <input
                        type="text"
                        value={meetingTitle}
                        onChange={(e) => setMeetingTitle(e.target.value)}
                        placeholder="輸入會議名稱..."
                        className="bg-transparent border-b border-zinc-700 text-center text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 w-48 transition-colors pb-1 mb-2"
                    />

                    <button
                        onClick={handleToggle}
                        className={`
                relative group px-8 py-3 rounded-full font-semibold transition-all duration-300 shadow-xl flex items-center gap-2
                ${connectionState === ConnectionState.RECONNECTING
                                ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/50 hover:shadow-amber-500/20'
                                : isConnected
                                    ? showEndConfirm
                                        ? 'bg-red-600 text-white border border-red-500 hover:shadow-red-500/50 animate-pulse' // Blinking Confirmation
                                        : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 hover:shadow-red-500/20'
                                    : 'bg-white text-black hover:bg-zinc-200'
                            }
            `}
                    >
                        {isConnecting ? (
                            <>
                                <svg className={`animate-spin h-5 w-5 ${connectionState === ConnectionState.RECONNECTING ? 'text-amber-500' : 'text-black'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                {connectionState === ConnectionState.RECONNECTING ? '中斷 (重連中...)' : '連線中...'}
                            </>
                        ) : isConnected ? (
                            showEndConfirm ? (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    再次點擊結束
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    結束會議
                                </>
                            )
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                開始錄製
                            </>
                        )}
                    </button>

                    {/* Chat Input for Live Mode */}
                    {isConnected && !showEndConfirm && (
                        <form onSubmit={handleSendText} className="relative mt-3 w-full max-w-[280px] animate-fade-in-up">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="傳送訊息給 AI..."
                                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-full px-4 py-1.5 pl-4 pr-10 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:bg-zinc-800 transition-all placeholder-zinc-500"
                            />
                            <button
                                type="submit"
                                disabled={!chatInput.trim()}
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-blue-400 hover:text-blue-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            </button>
                        </form>
                    )}

                    {/* New Meeting Button Container - Reserved Space */}
                    <div className="h-[40px] flex items-center justify-center mt-2">
                        {!isConnected && !isConnecting && (messages.length > 0 || sessionDuration > 0) && (
                            <button
                                onClick={resetSession}
                                className="bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 px-4 py-2 rounded-full text-sm flex items-center gap-2 transition-all animate-fade-in-up"
                                title="清除所有紀錄並開始新會議"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                開啟新會議
                            </button>
                        )}
                    </div>
                </div>

                {/* Right: Config */}
                <div className="flex items-center justify-end gap-3 w-1/3">
                    {/* Mic Mute Button */}
                    <button
                        onClick={toggleMute}
                        disabled={!isConnected}
                        className={`p-2 rounded-lg border transition-all ${isMuted
                            ? 'bg-red-500 text-white border-red-500'
                            : 'bg-zinc-900 border-zinc-800 text-icon hover:text-white hover:border-zinc-700'
                            } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={isMuted ? "解除靜音 (麥克風)" : "靜音麥克風 (防止打斷 AI)"}
                    >
                        {isMuted ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                        )}
                    </button>

                    {/* AI Voice Mute (Listen Only) Button - Updated to Head Icon */}
                    <button
                        onClick={toggleAiMute}
                        className={`p-2 rounded-lg border transition-all ${isAiMuted
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'bg-zinc-900 border-zinc-800 text-icon hover:text-white hover:border-zinc-700'
                            }`}
                        title={isAiMuted ? "AI 僅聆聽模式 (不會發話)" : "AI 語音模式 (可對話)"}
                    >
                        {isAiMuted ? (
                            <div className="flex items-center gap-1">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {/* Head Icon */}
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    {/* X Mark next to head to signify listen only/silent */}
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 10l-2 2m0-2l2 2" />
                                </svg>
                            </div>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {/* Head Icon */}
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                {/* Sound Wave indicating speaking */}
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 8a3 3 0 0 1 0 6" />
                            </svg>
                        )}
                    </button>

                    {/* System Audio Toggle */}
                    <button
                        onClick={() => !isConnected && setUseSystemAudio(!useSystemAudio)}
                        disabled={isConnected}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[0.9em] transition-colors whitespace-nowrap ${useSystemAudio ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-zinc-900 border-zinc-800 text-icon hover:text-zinc-300'}`}
                        title="錄製系統音訊 (需要螢幕分享)"
                    >
                        {useSystemAudio ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                        )}
                        {useSystemAudio ? '系統音訊' : '僅麥克風'}
                    </button>

                    <select
                        value={settings.voiceName}
                        onChange={(e) => updateSettings({ voiceName: e.target.value })}
                        disabled={isConnected}
                        className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-[0.9em] text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-700 hover:border-zinc-700"
                    >
                        <optgroup label="女聲 (Female)">
                            <option value="Aoede">Aoede (專業/明亮)</option>
                            <option value="Kore">Kore (冷靜/沉穩)</option>
                        </optgroup>
                        <optgroup label="男聲 (Male)">
                            <option value="Puck">Puck (溫和/幽默)</option>
                            <option value="Charon">Charon (低沉/嚴肅)</option>
                            <option value="Fenrir">Fenrir (活力/快速)</option>
                        </optgroup>
                    </select>
                </div>
            </div>
        </div>
    );
};

export default Controls;