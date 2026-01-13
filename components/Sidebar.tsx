
import React, { useRef, useState, useEffect } from 'react';
import { useApp, THEME_PRESETS } from '../contexts/AppContext';
import { useLive } from '../contexts/LiveContext';
import { parseFileToText } from '../utils/fileParser';
import { KnowledgeProfile, ProfileDocument, ThemePreset, LLMProvider, AppSettings } from '../types';

const GEMINI_MODELS = [
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (標準/快速)' },
    { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (強大推理)' },
    { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (實驗版)' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB Limit

const Sidebar: React.FC = () => {
    const {
        history,
        deleteMeeting,
        settings,
        updateSettings,
        profiles,
        addProfile,
        updateProfile,
        deleteProfile,
        addDocumentToProfile,
        removeDocumentFromProfile,
        sidebarTab,
        setSidebarTab,
        isSidebarOpen,
        setSidebarOpen,
        viewMode,
        setViewMode
    } = useApp();

    // Updated hook usage for new file list
    const { temporaryFiles, addTemporaryFile, removeTemporaryFile, clearTemporaryFiles } = useLive();
    const safeTemporaryFiles = temporaryFiles || []; // Safety fallback

    const contextFileInputRef = useRef<HTMLInputElement>(null);
    const profileFileInputRef = useRef<HTMLInputElement>(null);

    const [isParsing, setIsParsing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
    const [isCreatingProfile, setIsCreatingProfile] = useState(false);
    const [newProfileName, setNewProfileName] = useState("");

    const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);

    // Resizing Logic
    const [width, setWidth] = useState(settings.sidebarWidth || 320);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const resizingRef = useRef(false);

    useEffect(() => {
        // Sync local width with settings on mount or if settings change externally
        if (settings.sidebarWidth) {
            setWidth(settings.sidebarWidth);
        }
    }, [settings.sidebarWidth]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingRef.current) return;
            // Limit width between 200px and 600px
            const newWidth = Math.max(200, Math.min(600, e.clientX));
            setWidth(newWidth);
        };

        const handleMouseUp = () => {
            if (resizingRef.current) {
                resizingRef.current = false;
                setIsResizing(false);
                updateSettings({ sidebarWidth: width }); // Save final width
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
        const getDevices = async () => {
            // Safety check: navigator.mediaDevices might be undefined in insecure contexts (HTTP)
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                console.warn("Media Devices API not available (requires HTTPS or localhost)");
                return;
            }

            try {
                // Ask for permission first to get labels
                await navigator.mediaDevices.getUserMedia({ audio: true });
                const devices = await navigator.mediaDevices.enumerateDevices();
                const inputs = devices.filter(d => d.kind === 'audioinput');
                setAudioInputs(inputs);
            } catch (e) {
                console.error("Error fetching audio devices:", e);
            }
        };

        if (sidebarTab === 'settings') {
            getDevices();

            if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
                navigator.mediaDevices.addEventListener('devicechange', getDevices);
                return () => {
                    navigator.mediaDevices.removeEventListener('devicechange', getDevices);
                };
            }
        }
    }, [sidebarTab]);

    const handleProfileFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !editingProfileId) return;

        if (file.size > MAX_FILE_SIZE) {
            alert(`檔案過大(${(file.size / 1024 / 1024).toFixed(1)}MB)。請上傳小於 10MB 的檔案。`);
            if (profileFileInputRef.current) profileFileInputRef.current.value = '';
            return;
        }

        processFile(file, (text) => {
            const newDoc: ProfileDocument = {
                id: Date.now().toString(),
                name: file.name,
                content: text,
                type: file.name.split('.').pop() || 'txt',
                dateAdded: Date.now()
            };
            addDocumentToProfile(editingProfileId, newDoc);
        });
        if (profileFileInputRef.current) profileFileInputRef.current.value = '';
    };

    const handleContextFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (safeTemporaryFiles.length >= 3) {
            alert("最多只能上傳 3 個補充檔案。");
            if (contextFileInputRef.current) contextFileInputRef.current.value = '';
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            alert(`檔案過大(${(file.size / 1024 / 1024).toFixed(1)}MB)。請上傳小於 10MB 的檔案。`);
            if (contextFileInputRef.current) contextFileInputRef.current.value = '';
            return;
        }

        processFile(file, (text) => {
            addTemporaryFile(file.name, text);
        });
        if (contextFileInputRef.current) contextFileInputRef.current.value = '';
    };

    const processFile = async (file: File, onSuccess: (text: string) => void) => {
        setIsParsing(true);
        setUploadProgress(0);
        try {
            const text = await parseFileToText(file, (progress) => setUploadProgress(progress));
            if (!text.trim()) {
                alert("檔案內容為空或無法讀取文字。");
                return;
            }
            onSuccess(text);
        } catch (error: any) {
            alert(`上傳失敗: ${error.message} `);
            console.error(error);
        } finally {
            setIsParsing(false);
            setUploadProgress(0);
        }
    };

    const handleCreateProfile = () => {
        if (!newProfileName.trim()) return;
        const newProfile: KnowledgeProfile = {
            id: Date.now().toString(),
            name: newProfileName.trim(),
            description: "新建立的知識庫設定檔",
            documents: []
        };
        addProfile(newProfile);
        setNewProfileName("");
        setIsCreatingProfile(false);
        setEditingProfileId(newProfile.id);
    };

    const applyPreset = (key: ThemePreset) => {
        updateSettings({
            themePreset: key,
            themeMode: 'custom',
            customColors: { ...THEME_PRESETS[key].colors }
        });
    };

    const updateColor = (key: keyof AppSettings['customColors'], value: string) => {
        // Safety check for customColors
        const currentColors = settings.customColors || THEME_PRESETS.ocean.colors;
        updateSettings({
            themeMode: 'custom',
            customColors: {
                ...currentColors,
                [key]: value
            }
        });
    };

    if (!isSidebarOpen) return null;

    // Ensure settings.customColors exists to prevent crash
    const colors = settings.customColors || THEME_PRESETS.ocean.colors;

    return (
        <div
            ref={sidebarRef}
            className="h-full border-r border-zinc-800 bg-surface flex flex-col z-20 shrink-0 relative"
            style={{ width: width, transition: isResizing ? 'none' : 'width 0.3s ease' }}
        >
            {/* Drag Handle */}
            <div
                className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 z-50 transition-colors"
                onMouseDown={startResizing}
            />

            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    </div>
                    <h1 className="font-bold text-lg tracking-tight truncate flex-1">{settings.appName}</h1>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="md:hidden text-icon hover:text-primary">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            {/* Mode Navigation */}
            <div className="flex flex-col gap-1 p-3">
                <div style={{ fontSize: `${settings.navFontSize}px` }} className="font-bold text-zinc-500 uppercase tracking-wider px-2 mb-1">工作模式</div>

                <button
                    onClick={() => setViewMode('meeting')}
                    className={`group w-full flex items-center gap-3 p-3 rounded-xl transition-all border ${viewMode === 'meeting' ? 'bg-zinc-800 border-zinc-700 shadow-sm text-white' : 'border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                >
                    <div className={`p-2 rounded-lg ${viewMode === 'meeting' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700 group-hover:text-zinc-300'} transition-colors`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="text-sm font-semibold">會議助手</span>
                        <span style={{ fontSize: `${settings.navFontSize}px` }} className="opacity-60 font-normal">AI 即時轉錄與分析</span>
                    </div>
                    {viewMode === 'meeting' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>}
                </button>

                <button
                    onClick={() => setViewMode('recording')}
                    className={`group w-full flex items-center gap-3 p-3 rounded-xl transition-all border ${viewMode === 'recording' ? 'bg-zinc-800 border-zinc-700 shadow-sm text-white' : 'border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                >
                    <div className={`p-2 rounded-lg ${viewMode === 'recording' ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700 group-hover:text-zinc-300'} transition-colors`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    </div>
                    <div className="flex flex-col items-start">
                        <span className="text-sm font-semibold">獨立錄音</span>
                        <span style={{ fontSize: `${settings.navFontSize}px` }} className="opacity-60 font-normal">純淨錄音 • 本地儲存</span>
                    </div>
                    {viewMode === 'recording' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>}
                </button>
            </div>

            <div className="h-px bg-zinc-800/50 mx-4 my-1"></div>

            {/* Management Tabs */}
            <div className="flex flex-col gap-1 p-3 pt-0">
                <div style={{ fontSize: `${settings.navFontSize}px` }} className="font-bold text-zinc-500 uppercase tracking-wider px-2 mb-1 mt-2">功能管理</div>

                <button
                    onClick={() => setSidebarTab('history')}
                    className={`group w-full flex items-center gap-3 p-2.5 rounded-lg transition-all ${sidebarTab === 'history' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                >
                    <svg className={`w-4 h-4 ${sidebarTab === 'history' ? 'text-primary' : 'text-zinc-500 group-hover:text-zinc-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="text-sm font-medium">歷史紀錄</span>
                </button>

                <button
                    onClick={() => setSidebarTab('profiles')}
                    className={`group w-full flex items-center gap-3 p-2.5 rounded-lg transition-all ${sidebarTab === 'profiles' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                >
                    <svg className={`w-4 h-4 ${sidebarTab === 'profiles' ? 'text-primary' : 'text-zinc-500 group-hover:text-zinc-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    <span className="text-sm font-medium">知識庫設定檔</span>
                </button>

                <button
                    onClick={() => setSidebarTab('settings')}
                    className={`group w-full flex items-center gap-3 p-2.5 rounded-lg transition-all ${sidebarTab === 'settings' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
                >
                    <svg className={`w-4 h-4 ${sidebarTab === 'settings' ? 'text-primary' : 'text-zinc-500 group-hover:text-zinc-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="text-sm font-medium">系統設定</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {sidebarTab === 'history' && (
                    <div className="space-y-3">
                        {history.length === 0 && <p className="text-zinc-600 text-center mt-10">尚無會議記錄。</p>}
                        {history.map(session => (
                            <div key={session.id} className="group p-3 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:border-zinc-700 transition-all cursor-pointer">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-medium text-zinc-200 truncate pr-4 text-[0.95em]">{session.title}</h3>
                                    <button onClick={(e) => { e.stopPropagation(); deleteMeeting(session.id); }} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                                <div className="flex justify-between text-[0.85em] text-zinc-500">
                                    <span>{new Date(session.date).toLocaleDateString()}</span>
                                    <span>{Math.floor(session.duration / 60)}分 {session.duration % 60}秒</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {sidebarTab === 'profiles' && (
                    <div className="space-y-4">
                        {!isCreatingProfile ? (
                            <button onClick={() => setIsCreatingProfile(true)} className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-icon hover:text-white hover:border-primary text-[0.9em] flex items-center justify-center gap-2 transition-all">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                建立新設定檔
                            </button>
                        ) : (
                            <div className="p-3 bg-zinc-900 border border-zinc-700 rounded-lg animate-fade-in-up">
                                <input type="text" value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} placeholder="名稱..." autoFocus className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm mb-2 outline-none focus:border-primary" />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setIsCreatingProfile(false)} className="text-xs text-zinc-400">取消</button>
                                    <button onClick={handleCreateProfile} className="text-xs bg-primary text-white px-3 py-1 rounded">建立</button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            {profiles.map(p => (
                                <div key={p.id} className={`rounded - lg border transition - all ${settings.currentProfileId === p.id ? 'border-primary/50 bg-primary/10' : 'border-zinc-800 bg-zinc-900/30'} `}>
                                    <div className="p-3 cursor-pointer" onClick={() => updateSettings({ currentProfileId: p.id })}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-medium text-[0.95em]">{p.name}</span>
                                            <button onClick={(e) => { e.stopPropagation(); setEditingProfileId(editingProfileId === p.id ? null : p.id); }} className="text-icon hover:text-primary">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                    {editingProfileId === p.id && (
                                        <div className="p-3 border-t border-zinc-800 bg-zinc-900/50 space-y-3 animate-fade-in-up">
                                            <textarea value={p.description} onChange={(e) => updateProfile(p.id, { description: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-[0.85em] h-16" placeholder="描述..." />
                                            <input type="file" ref={profileFileInputRef} onChange={handleProfileFileChange} className="hidden" />
                                            <button onClick={() => profileFileInputRef.current?.click()} className="w-full py-1.5 border border-dashed border-zinc-700 text-[0.8em] text-icon hover:text-primary">上傳知識庫文件</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {sidebarTab === 'settings' && (
                    <div className="space-y-6 animate-fadeIn">
                        {/* 1. 外觀主題 (Appearance) */}
                        <div className="space-y-3">
                            <label className="text-[0.85em] font-semibold text-zinc-400 uppercase tracking-wider">外觀主題 (點擊套用範本)</label>
                            <div className="space-y-2">
                                {(Object.keys(THEME_PRESETS) as ThemePreset[]).map(key => (
                                    <button key={key} onClick={() => applyPreset(key)} className={`w - full flex items - center justify - between p - 2 rounded - lg border transition - all ${settings.themePreset === key ? 'border-primary bg-primary/10 text-white' : 'border-zinc-800 bg-zinc-900/50 text-icon hover:bg-zinc-800'} `}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ background: THEME_PRESETS[key].colors.primary }}></div>
                                            <span className="text-sm">{THEME_PRESETS[key].name}</span>
                                        </div>
                                        {settings.themePreset === key && <span className="text-[0.7em] text-primary/80">當前範本</span>}
                                    </button>
                                ))}
                            </div>

                            <div className="mt-4 pt-4 border-t border-zinc-800/50">
                                <label className="text-[0.85em] font-semibold text-zinc-400 uppercase tracking-wider mb-3 block">細節微調 (Fine Tune)</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <span className="text-[0.7em] text-zinc-500 block">背景 (Background)</span>
                                        <div className="flex items-center gap-2 bg-zinc-900 rounded p-1.5 border border-zinc-700">
                                            <input
                                                type="color"
                                                value={colors.background}
                                                onChange={(e) => updateColor('background', e.target.value)}
                                                className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                                            />
                                            <span className="text-[0.75em] font-mono text-zinc-300 truncate">{colors.background}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[0.7em] text-zinc-500 block">介面 (Surface)</span>
                                        <div className="flex items-center gap-2 bg-zinc-900 rounded p-1.5 border border-zinc-700">
                                            <input
                                                type="color"
                                                value={colors.surface}
                                                onChange={(e) => updateColor('surface', e.target.value)}
                                                className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                                            />
                                            <span className="text-[0.75em] font-mono text-zinc-300 truncate">{colors.surface}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[0.7em] text-zinc-500 block">文字 (Text)</span>
                                        <div className="flex items-center gap-2 bg-zinc-900 rounded p-1.5 border border-zinc-700">
                                            <input
                                                type="color"
                                                value={colors.text || '#e4e4e7'}
                                                onChange={(e) => updateColor('text', e.target.value)}
                                                className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                                            />
                                            <span className="text-[0.75em] font-mono text-zinc-300 truncate">{colors.text || '#e4e4e7'}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[0.7em] text-zinc-500 block">圖示 (Icon)</span>
                                        <div className="flex items-center gap-2 bg-zinc-900 rounded p-1.5 border border-zinc-700">
                                            <input
                                                type="color"
                                                value={colors.icon || '#71717a'}
                                                onChange={(e) => updateColor('icon', e.target.value)}
                                                className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                                            />
                                            <span className="text-[0.75em] font-mono text-zinc-300 truncate">{colors.icon || '#71717a'}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[0.7em] text-zinc-500 block">主色 (Primary)</span>
                                        <div className="flex items-center gap-2 bg-zinc-900 rounded p-1.5 border border-zinc-700">
                                            <input
                                                type="color"
                                                value={colors.primary}
                                                onChange={(e) => updateColor('primary', e.target.value)}
                                                className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                                            />
                                            <span className="text-[0.75em] font-mono text-zinc-300 truncate">{colors.primary}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[0.7em] text-zinc-500 block">輔助色 (Secondary)</span>
                                        <div className="flex items-center gap-2 bg-zinc-900 rounded p-1.5 border border-zinc-700">
                                            <input
                                                type="color"
                                                value={colors.secondary}
                                                onChange={(e) => updateColor('secondary', e.target.value)}
                                                className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                                            />
                                            <span className="text-[0.75em] font-mono text-zinc-300 truncate">{colors.secondary}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-zinc-800"></div>

                        {/* 2. 一般設定 (General) */}
                        <div className="space-y-3">
                            <label className="text-[0.85em] font-semibold text-zinc-400 uppercase tracking-wider">一般設定</label>
                            <div className="space-y-2">
                                <span className="text-[0.8em] text-zinc-500 block">應用程式名稱</span>
                                <input type="text" value={settings.appName} onChange={(e) => updateSettings({ appName: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.95em] focus:border-primary outline-none" />
                            </div>
                            <div className="space-y-2">
                                <span className="text-[0.8em] text-zinc-500 block">使用者名稱</span>
                                <input type="text" value={settings.userName} onChange={(e) => updateSettings({ userName: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.95em] focus:border-primary outline-none" placeholder="User" />
                            </div>

                            <div className="space-y-2">
                                <span className="text-[0.8em] text-zinc-500 block">AI 互動模式</span>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => updateSettings({ aiInteractionMode: 'passive' })}
                                        className={`p - 2 rounded border text - left transition - all ${settings.aiInteractionMode === 'passive' ? 'bg-primary/20 border-primary text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600'} `}
                                    >
                                        <div className="font-medium text-sm mb-0.5">被動模式</div>
                                        <div className="text-[0.7em] opacity-80">僅在被呼叫時回應</div>
                                    </button>
                                    <button
                                        onClick={() => updateSettings({ aiInteractionMode: 'active' })}
                                        className={`p - 2 rounded border text - left transition - all ${settings.aiInteractionMode === 'active' ? 'bg-amber-500/20 border-amber-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600'} `}
                                    >
                                        <div className="font-medium text-sm mb-0.5">主動模式</div>
                                        <div className="text-[0.7em] opacity-80">自動參與討論</div>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="text-[0.8em] text-zinc-500 block">錄製與轉錄語言</span>
                                <select value={settings.recordingLanguage} onChange={(e) => updateSettings({ recordingLanguage: e.target.value as any })} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.95em] focus:border-primary outline-none">
                                    <option value="zh-TW">繁體中文 (台灣)</option>
                                    <option value="en-US">English (US)</option>
                                    <option value="ja-JP">日本語 (Japanese)</option>
                                </select>
                            </div>

                            {/* Microphone Selection */}
                            <div className="space-y-2">
                                <span className="text-[0.8em] text-zinc-500 block">麥克風來源</span>
                                <select
                                    value={settings.selectedMicrophoneId}
                                    onChange={(e) => updateSettings({ selectedMicrophoneId: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.95em] focus:border-primary outline-none"
                                >
                                    <option value="">預設麥克風 (Default)</option>
                                    {audioInputs.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Noise Threshold Slider */}
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-[0.8em] text-zinc-500">麥克風靈敏度 (Noise Gate)</span>
                                    <span className="text-[0.8em] font-mono text-zinc-400">{settings.noiseThreshold?.toFixed(3) || 0.002}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="0.05"
                                    step="0.001"
                                    value={settings.noiseThreshold || 0.002}
                                    onChange={(e) => updateSettings({ noiseThreshold: parseFloat(e.target.value) })}
                                    className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                                <div className="flex justify-between text-[0.7em] text-zinc-600">
                                    <span>高靈敏 (收細語)</span>
                                    <span>低靈敏 (濾雜音)</span>
                                </div>
                            </div>

                            {/* Temporary File Upload (Updated for Multiple Files) */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-[0.8em] text-zinc-500 block">本次會議補充資料 ({safeTemporaryFiles.length}/3)</span>
                                    {safeTemporaryFiles.length > 0 && (
                                        <button onClick={() => clearTemporaryFiles()} className="text-[0.7em] text-red-400 hover:underline">全部清除</button>
                                    )}
                                </div>

                                {/* File List */}
                                {safeTemporaryFiles.length > 0 && (
                                    <div className="space-y-1.5 mb-2">
                                        {safeTemporaryFiles.map(f => (
                                            <div key={f.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.85em] group animate-fade-in-up">
                                                <div className="flex items-center gap-2 truncate">
                                                    <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                    <span className="text-zinc-300 truncate" title={f.name}>{f.name}</span>
                                                </div>
                                                <button onClick={() => removeTemporaryFile(f.id)} className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Upload Input */}
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        ref={contextFileInputRef}
                                        onChange={handleContextFileChange}
                                        className="hidden"
                                    />

                                    {safeTemporaryFiles.length < 3 ? (
                                        <button
                                            onClick={() => contextFileInputRef.current?.click()}
                                            className="w-full py-2 border border-dashed border-zinc-700 rounded text-[0.8em] text-zinc-400 hover:text-primary hover:border-primary transition-all flex items-center justify-center gap-2"
                                        >
                                            {isParsing ? (
                                                <>
                                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                    解析中...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                    新增補充檔案 (PDF/Doc/Txt)
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <div className="w-full py-2 bg-zinc-900/50 border border-zinc-800 rounded text-[0.8em] text-zinc-500 text-center cursor-not-allowed">
                                            已達檔案上限 (3/3)
                                        </div>
                                    )}
                                </div>
                                <p className="text-[0.7em] text-zinc-500">這些檔案僅供本次連線參考，不會永久儲存。</p>
                            </div>
                            <div className="space-y-4">
                                <label className="text-[0.85em] font-semibold text-zinc-400 uppercase tracking-wider">介面顯示</label>

                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-[0.8em] text-zinc-500">側邊欄文字大小 (px)</span>
                                        <span className="text-[0.8em] font-mono text-zinc-400">{settings.navFontSize || 11}px</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="9"
                                        max="16"
                                        step="1"
                                        value={settings.navFontSize || 11}
                                        onChange={(e) => updateSettings({ navFontSize: parseInt(e.target.value) })}
                                        className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[0.8em] text-zinc-500 block">轉錄文字大小</span>
                                    <div className="flex bg-zinc-900 rounded border border-zinc-700 p-1">
                                        {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
                                            <button
                                                key={size}
                                                onClick={() => updateSettings({ contentFontSize: size })}
                                                className={`flex-1 py-1 text-xs rounded transition-colors ${settings.contentFontSize === size ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                            >
                                                {size.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-zinc-800"></div>

                            {/* 3. AI 模型設定 (AI Models) */}
                            <div className="space-y-3">
                                <label className="text-[0.85em] font-semibold text-zinc-400 uppercase tracking-wider">AI 模型設定</label>

                                <div className="space-y-2 mb-3">
                                    <span className="text-[0.8em] text-zinc-500 block">分析與對話供應商</span>
                                    <select value={settings.provider} onChange={(e) => updateSettings({ provider: e.target.value as LLMProvider })} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.95em] focus:border-primary outline-none">
                                        <option value="gemini">Google Gemini</option>
                                        <option value="openai">OpenAI (GPT)</option>
                                        <option value="ollama">Ollama (Local)</option>
                                        <option value="lmstudio">LM Studio (Local)</option>
                                        <option value="anythingllm">AnythingLLM</option>
                                    </select>
                                </div>

                                {/* Provider Specific Settings */}
                                {settings.provider === 'gemini' && (
                                    <div className="space-y-3 animate-fade-in-up">
                                        <div className="space-y-1">
                                            <span className="text-[0.8em] text-zinc-500">API Key</span>
                                            <input type="password" value={settings.apiKeys.gemini} onChange={(e) => updateSettings({ apiKeys: { ...settings.apiKeys, gemini: e.target.value } })} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.9em] focus:border-primary outline-none" placeholder="sk-..." />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[0.8em] text-zinc-500">轉錄優化模型 (Transcription)</span>
                                            <select
                                                value={settings.geminiTranscriptionModel}
                                                onChange={(e) => updateSettings({ geminiTranscriptionModel: e.target.value })}
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.9em] focus:border-primary outline-none"
                                            >
                                                {GEMINI_MODELS.map(m => (
                                                    <option key={m.value} value={m.value}>{m.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[0.8em] text-zinc-500">分析與對話模型 (Analysis)</span>
                                            <select
                                                value={settings.geminiAnalysisModel}
                                                onChange={(e) => updateSettings({ geminiAnalysisModel: e.target.value })}
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.9em] focus:border-primary outline-none"
                                            >
                                                {GEMINI_MODELS.map(m => (
                                                    <option key={m.value} value={m.value}>{m.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {settings.provider === 'openai' && (
                                    <div className="space-y-3 animate-fade-in-up">
                                        <div className="space-y-1">
                                            <span className="text-[0.8em] text-zinc-500">OpenAI API Key</span>
                                            <input type="password" value={settings.apiKeys.openai} onChange={(e) => updateSettings({ apiKeys: { ...settings.apiKeys, openai: e.target.value } })} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.9em] focus:border-primary outline-none" placeholder="sk-..." />
                                        </div>
                                    </div>
                                )}

                                {(settings.provider === 'ollama') && (
                                    <div className="space-y-3 animate-fade-in-up">
                                        <div className="space-y-1">
                                            <span className="text-[0.8em] text-zinc-500">Ollama URL</span>
                                            <input type="text" value={settings.ollamaUrl} onChange={(e) => updateSettings({ ollamaUrl: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.9em] focus:border-primary outline-none" placeholder="http://localhost:11434" />
                                        </div>
                                        <p className="text-[0.7em] text-zinc-500">預設使用 llama3 模型，請確認已 pull。</p>
                                    </div>
                                )}

                                {(settings.provider === 'lmstudio') && (
                                    <div className="space-y-3 animate-fade-in-up">
                                        <div className="space-y-1">
                                            <span className="text-[0.8em] text-zinc-500">LM Studio Base URL</span>
                                            <input type="text" value={settings.lmStudioUrl} onChange={(e) => updateSettings({ lmStudioUrl: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.9em] focus:border-primary outline-none" placeholder="http://localhost:1234/v1" />
                                        </div>
                                    </div>
                                )}

                                {(settings.provider === 'anythingllm') && (
                                    <div className="space-y-3 animate-fade-in-up">
                                        <div className="space-y-1">
                                            <span className="text-[0.8em] text-zinc-500">Base URL</span>
                                            <input type="text" value={settings.anythingLlmUrl} onChange={(e) => updateSettings({ anythingLlmUrl: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.9em] focus:border-primary outline-none" placeholder="http://localhost:3001/api/v1/openai" />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[0.8em] text-zinc-500">API Key</span>
                                            <input type="password" value={settings.apiKeys.anythingllm} onChange={(e) => updateSettings({ apiKeys: { ...settings.apiKeys, anythingllm: e.target.value } })} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.9em] focus:border-primary outline-none" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-zinc-800"></div>

                            {/* 4. 介面顯示 (Display) */}
                            <div className="space-y-3">
                                <label className="text-[0.85em] font-semibold text-zinc-400 uppercase tracking-wider">介面與顯示</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <span className="text-[0.8em] text-zinc-500 block mb-1">介面大小</span>
                                        <select value={settings.uiFontSize} onChange={(e) => updateSettings({ uiFontSize: e.target.value as any })} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm focus:border-primary outline-none">
                                            <option value="sm">小字體</option><option value="md">中字體</option><option value="lg">大字體</option>
                                        </select>
                                    </div>
                                    <div>
                                        <span className="text-[0.8em] text-zinc-500 block mb-1">內文大小</span>
                                        <select value={settings.contentFontSize} onChange={(e) => updateSettings({ contentFontSize: e.target.value as any })} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm focus:border-primary outline-none">
                                            <option value="sm">內文小</option><option value="md">內文中</option><option value="lg">內文大</option><option value="xl">特大</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div
                className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-primary/50 cursor-col-resize z-50 transition-colors"
                onMouseDown={startResizing}
            />
        </div >
    );
};

export default Sidebar;