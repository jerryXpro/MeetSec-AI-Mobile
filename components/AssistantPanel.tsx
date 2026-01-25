import React, { useState, useRef, useEffect } from 'react';
import { useLive } from '../hooks/useLive';
import { useApp } from '../contexts/AppContext';
import { generateMeetingMinutes, chatWithTranscript } from '../services/analysisService';
import { downloadAsMarkdown, downloadAsWord, downloadAsPDF } from '../utils/downloadUtils';

interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    content: string;
}

// Polyfill for SpeechRecognition type
interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

const AssistantPanel: React.FC = () => {
    const { messages, meetingTitle, temporaryFiles } = useLive();
    const { settings, updateSettings } = useApp();
    const [activeTab, setActiveTab] = useState<'chat' | 'analysis'>('analysis');

    // Analysis State
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisInput, setAnalysisInput] = useState(""); // Input for analysis instructions

    // Presets State
    const [showPresetsMenu, setShowPresetsMenu] = useState(false);
    const presetsMenuRef = useRef<HTMLDivElement>(null);
    const [isAddingPreset, setIsAddingPreset] = useState(false);
    const [newPresetName, setNewPresetName] = useState("");
    const [newPresetPrompt, setNewPresetPrompt] = useState("");

    // Chat State
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isChatting, setIsChatting] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    const [error, setError] = useState<string | null>(null);

    // Download Menu State
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const downloadMenuRef = useRef<HTMLDivElement>(null);

    // Resizing Logic
    const [width, setWidth] = useState(settings.assistantWidth || 384);
    const [isResizing, setIsResizing] = useState(false);
    const resizingRef = useRef(false);

    useEffect(() => {
        if (settings.assistantWidth) {
            setWidth(settings.assistantWidth);
        }
    }, [settings.assistantWidth]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingRef.current) return;
            const newWidth = Math.max(250, Math.min(800, window.innerWidth - e.clientX));
            setWidth(newWidth);
        };

        const handleMouseUp = () => {
            if (resizingRef.current) {
                resizingRef.current = false;
                setIsResizing(false);
                updateSettings({ assistantWidth: width });
                document.body.style.cursor = 'default';
            }
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, width, updateSettings]);

    const startResizing = (e: React.MouseEvent) => {
        e.preventDefault();
        resizingRef.current = true;
        setIsResizing(true);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
                setShowDownloadMenu(false);
            }
            if (presetsMenuRef.current && !presetsMenuRef.current.contains(event.target as Node)) {
                setShowPresetsMenu(false);
                setIsAddingPreset(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (activeTab === 'chat' && chatContainerRef.current) {
            const container = chatContainerRef.current;
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [chatHistory, activeTab]);

    const hasContent = messages.length > 0 || temporaryFiles.length > 0;

    const handleAnalyze = async (customInstruction?: string) => {
        setIsAnalyzing(true);
        setError(null);
        setShowDownloadMenu(false);

        try {
            const startTime = messages.length > 0 ? messages[0].timestamp : Date.now();
            const endTime = messages.length > 0 ? messages[messages.length - 1].timestamp : Date.now();

            const durationMs = endTime - startTime;
            const minutes = Math.floor(durationMs / 60000);
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;

            let durationStr = "";
            if (hours > 0) {
                durationStr = `${hours}小時 ${remainingMinutes}分鐘`;
            } else {
                durationStr = `${remainingMinutes}分鐘`;
            }
            if (minutes === 0) durationStr = "少於 1 分鐘";

            const dateStr = new Date(startTime).toLocaleString('zh-TW', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            const finalTitle = meetingTitle.trim() || "未命名會議";

            const result = await generateMeetingMinutes(
                messages,
                settings,
                finalTitle,
                dateStr,
                durationStr,
                customInstruction,
                temporaryFiles
            );
            setAnalysisResult(result);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAnalysisSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (isAnalyzing) return;
        handleAnalyze(analysisInput.trim() || undefined);
        setAnalysisInput("");
    };

    // Preset Handlers
    const handleSelectPreset = (prompt: string) => {
        setAnalysisInput(prompt);
        setShowPresetsMenu(false);
    };

    const handleAddPreset = () => {
        if (!newPresetName.trim() || !newPresetPrompt.trim()) return;

        const newPreset = {
            id: Date.now().toString(),
            name: newPresetName.trim(),
            prompt: newPresetPrompt.trim()
        };

        const updated = [...(settings.presetCommands || []), newPreset];
        updateSettings({ presetCommands: updated });

        setNewPresetName("");
        setNewPresetPrompt("");
        setIsAddingPreset(false);
    };

    const handleDeletePreset = (id: string) => {
        const updated = (settings.presetCommands || []).filter(p => p.id !== id);
        updateSettings({ presetCommands: updated });
    };

    const handleChatSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim() || isChatting) return;

        if (!hasContent) {
            setError("請先開始會議、上傳音檔或補充資料以進行討論。");
            return;
        }

        const question = chatInput.trim();
        setChatInput('');
        setError(null);

        const newMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: question };
        setChatHistory(prev => [...prev, newMsg]);
        setIsChatting(true);

        try {
            const contextHistory = chatHistory.map(m => ({ role: m.role, content: m.content }));
            const answer = await chatWithTranscript(messages, question, contextHistory, settings, temporaryFiles);
            setChatHistory(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', content: answer }]);
        } catch (err: any) {
            setChatHistory(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: `錯誤: ${err.message}` }]);
        } finally {
            setIsChatting(false);
        }
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            const SpeechRecognition = (window as unknown as IWindow).SpeechRecognition || (window as unknown as IWindow).webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert("您的瀏覽器不支援語音輸入功能。");
                return;
            }

            const recognition = new SpeechRecognition();
            recognition.lang = settings.recordingLanguage;
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                if (transcript) {
                    setChatInput(prev => prev ? `${prev} ${transcript}` : transcript);
                }
            };
            recognition.onerror = () => setIsListening(false);

            recognitionRef.current = recognition;
            recognition.start();
        }
    };

    const getFilename = () => {
        const dateStr = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
        const title = meetingTitle.trim() || "會議記錄";
        const safeTitle = title.replace(/[\\/:*?"<>|]/g, "_");
        return `${safeTitle}_${dateStr}`;
    };

    return (
        <div
            className="h-full border-l border-zinc-800 bg-surface flex flex-col z-20 shadow-2xl relative w-full md:w-auto"
            style={{
                width: window.innerWidth < 768 ? '100%' : width,
                transition: isResizing ? 'none' : 'width 0.3s ease'
            }}
        >
            <div
                className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 z-50 transition-colors"
                onMouseDown={startResizing}
            />

            <div className="p-4 border-b border-zinc-800 bg-surface/95 backdrop-blur-sm shrink-0 z-10">
                <h2 className="font-bold text-zinc-200 flex items-center gap-2">
                    <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    AI 會議助手
                </h2>
                <div className="flex mt-3 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                    <button onClick={() => setActiveTab('analysis')} className={`flex-1 py-1.5 font-medium rounded-md transition-all ${activeTab === 'analysis' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>會議摘要</button>
                    <button onClick={() => setActiveTab('chat')} className={`flex-1 py-1.5 font-medium rounded-md transition-all ${activeTab === 'chat' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>AI 對話</button>
                </div>
            </div>

            <div className="flex-1 bg-zinc-900/30 relative min-h-0 flex flex-col overflow-hidden">
                {/* ANALYSIS TAB CONTENT */}
                {activeTab === 'analysis' && (
                    <div className="flex-1 flex flex-col relative min-h-0 h-full">
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                            {error && (
                                <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-[0.9em] text-red-200 animate-fade-in-up">
                                    {error}
                                </div>
                            )}

                            {!hasContent && !analysisResult ? (
                                <div className="flex flex-col items-center justify-center mt-20 text-zinc-500 gap-3">
                                    <svg className="w-12 h-12 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    <p className="text-[0.95em]">會議內容將顯示於此...</p>
                                </div>
                            ) : (
                                <>
                                    {!analysisResult && (
                                        <div className="flex flex-col gap-3 mt-10">
                                            <p className="text-[0.85em] text-center text-zinc-500 mb-2">
                                                使用 <span className="font-bold text-blue-400 uppercase ml-1">{settings.provider}</span> 生成報告
                                            </p>

                                            <button
                                                onClick={() => handleAnalyze()}
                                                disabled={isAnalyzing}
                                                className="group relative w-full py-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 border border-blue-500/30 text-blue-100 rounded-xl flex items-center justify-center gap-2 transition-all overflow-hidden"
                                            >
                                                <div className={`absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 transition-transform duration-1000 ${isAnalyzing ? 'translate-x-full' : '-translate-x-full group-hover:translate-x-0'}`}></div>
                                                {isAnalyzing ? (
                                                    <>
                                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                        分析中...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                                        直接生成 (預設)
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {analysisResult && (
                                        <div className="animate-fade-in-up pb-2">
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-[0.85em] font-bold text-zinc-400 uppercase tracking-wider">分析結果</h3>
                                                <div className="flex gap-2 relative" ref={downloadMenuRef}>
                                                    <button onClick={() => setAnalysisResult(null)} className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300" title="清除">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                                                        className="p-1 hover:bg-zinc-800 rounded text-blue-400 hover:text-blue-300"
                                                        title="下載"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                    </button>
                                                    {showDownloadMenu && (
                                                        <div className="absolute right-0 top-full mt-2 w-32 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
                                                            <button onClick={() => { downloadAsWord(analysisResult, `${getFilename()}.doc`); setShowDownloadMenu(false); }} className="w-full text-left px-4 py-2 text-[0.85em] text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"><span className="text-blue-400">W</span> Word</button>
                                                            <button onClick={() => { downloadAsPDF(analysisResult, `${getFilename()}.pdf`); setShowDownloadMenu(false); }} className="w-full text-left px-4 py-2 text-[0.85em] text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"><span className="text-red-400">P</span> PDF</button>
                                                            <button onClick={() => { downloadAsMarkdown(analysisResult, `${getFilename()}.md`); setShowDownloadMenu(false); }} className="w-full text-left px-4 py-2 text-[0.85em] text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"><span className="text-gray-400">M</span> Markdown</button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="prose prose-invert prose-sm max-w-none bg-zinc-900 p-4 rounded-xl border border-zinc-800/50 shadow-inner">
                                                <div className="whitespace-pre-wrap font-mono text-[0.9em] leading-relaxed text-zinc-300">
                                                    {analysisResult}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Analysis Input Bar (Fixed Bottom, Force Visible) */}
                        <form
                            onSubmit={handleAnalysisSubmit}
                            className="shrink-0 p-4 border-t border-zinc-700 bg-zinc-900 z-10"
                        >
                            <div className="relative flex items-center gap-2">
                                {/* Preset Commands Button */}
                                <div className="relative" ref={presetsMenuRef}>
                                    <button
                                        type="button"
                                        onClick={() => setShowPresetsMenu(!showPresetsMenu)}
                                        className={`p-3 rounded-xl transition-all ${showPresetsMenu ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-blue-400 hover:bg-zinc-700'}`}
                                        title="常用指令"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    </button>

                                    {/* Presets Popover */}
                                    {showPresetsMenu && (
                                        <div className="absolute bottom-full left-0 mb-3 w-72 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[400px]">
                                            <div className="p-3 border-b border-zinc-700 flex justify-between items-center bg-zinc-900/50">
                                                <h3 className="text-sm font-semibold text-zinc-300">常用指令</h3>
                                                {!isAddingPreset && (
                                                    <button onClick={() => setIsAddingPreset(true)} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                        新增
                                                    </button>
                                                )}
                                            </div>

                                            <div className="overflow-y-auto p-2 custom-scrollbar">
                                                {isAddingPreset ? (
                                                    <div className="space-y-3 p-1 animate-fade-in-up">
                                                        <input
                                                            type="text"
                                                            placeholder="按鈕名稱 (例: 整理摘要)"
                                                            value={newPresetName}
                                                            onChange={(e) => setNewPresetName(e.target.value)}
                                                            className="w-full bg-zinc-900 border border-zinc-600 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none"
                                                            autoFocus
                                                        />
                                                        <textarea
                                                            placeholder="完整指令 (例: 請幫我整理...)"
                                                            value={newPresetPrompt}
                                                            onChange={(e) => setNewPresetPrompt(e.target.value)}
                                                            className="w-full bg-zinc-900 border border-zinc-600 rounded px-2 py-1.5 text-xs text-white focus:border-blue-500 outline-none h-20 resize-none"
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => setIsAddingPreset(false)} className="text-xs text-zinc-400 hover:text-white">取消</button>
                                                            <button onClick={handleAddPreset} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded">儲存</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {(settings.presetCommands || []).map(preset => (
                                                            <div key={preset.id} className="group flex items-center gap-2 p-2 rounded-lg hover:bg-zinc-700/50 transition-colors">
                                                                <button
                                                                    onClick={() => handleSelectPreset(preset.prompt)}
                                                                    className="flex-1 text-left text-sm text-zinc-300 group-hover:text-white truncate"
                                                                    title={preset.prompt}
                                                                >
                                                                    {preset.name}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id); }}
                                                                    className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 p-1"
                                                                    title="刪除"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {(settings.presetCommands || []).length === 0 && (
                                                            <div className="text-center text-xs text-zinc-500 py-4">暫無常用指令</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={analysisInput}
                                        onChange={(e) => setAnalysisInput(e.target.value)}
                                        placeholder={analysisResult ? "輸入指令 (例: 翻成英文、增加摘要)..." : "輸入指令 (例: 提供會議範本、只關注行銷)..."}
                                        disabled={isAnalyzing}
                                        className={`w-full bg-zinc-800 border border-zinc-600 rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all shadow-sm text-zinc-200 text-[0.9em] placeholder-zinc-500`}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!analysisInput.trim() || isAnalyzing}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isAnalyzing ? (
                                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                )}

                {/* CHAT TAB CONTENT */}
                {activeTab === 'chat' && (
                    <div className="absolute inset-0 flex flex-col p-4">
                        <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 custom-scrollbar">
                            {!hasContent ? (
                                <div className="text-center text-zinc-500 mt-10 text-[0.85em]">
                                    <p>請先進行對話、上傳檔案或補充資料，<br />我才能回答相關問題。</p>
                                </div>
                            ) : (
                                <>
                                    {chatHistory.map(msg => (
                                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                                            <div className={`px-3 py-2 rounded-xl max-w-[90%] shadow-sm ${msg.role === 'user'
                                                ? 'bg-blue-600/20 text-blue-100 rounded-br-none border border-blue-500/30'
                                                : 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700'
                                                }`}>
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    {isChatting && (
                                        <div className="flex justify-start">
                                            <div className="bg-zinc-800 rounded-2xl rounded-tl-none px-4 py-3 text-zinc-400 border border-zinc-700 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
                                                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce delay-100"></span>
                                                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce delay-200"></span>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <form onSubmit={handleChatSubmit} className="mt-auto relative shrink-0">
                            <div className="relative flex items-center">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder={isListening ? "正在聆聽中..." : (hasContent ? "詢問關於這場會議或檔案的問題..." : "等待內容...")}
                                    disabled={!hasContent || isChatting}
                                    className={`w-full bg-zinc-900 border ${isListening ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'border-zinc-700'} rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all shadow-sm disabled:opacity-50`}
                                />
                                <button
                                    type="button"
                                    onClick={toggleListening}
                                    disabled={!hasContent || isChatting}
                                    className={`absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all ${isListening
                                        ? 'text-red-500 hover:bg-red-500/10 animate-pulse'
                                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                                        }`}
                                >
                                    {isListening ? (
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 2.34 9 4v6c0 1.66 1.34 3 3 3z" /><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                    )}
                                </button>
                                <button
                                    type="submit"
                                    disabled={!chatInput.trim() || isChatting}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssistantPanel;