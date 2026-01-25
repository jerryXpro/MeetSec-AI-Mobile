import React, { useRef, useState, useEffect } from 'react';
import { useApp, THEME_PRESETS } from '../contexts/AppContext';
import { useLive } from '../hooks/useLive';
import { parseFileToText } from '../utils/fileParser';
import { KnowledgeProfile, ProfileDocument, ThemePreset, LLMProvider, AppSettings } from '../types';

import UserManual from './UserManual';

const Sidebar: React.FC = () => {

    const ApiKeyInput: React.FC<{ value: string, onChange: (val: string) => void, placeholder?: string }> = ({ value, onChange, placeholder }) => {
        const [isVisible, setIsVisible] = useState(false);
        return (
            <div className="relative group/input">
                <input
                    type={isVisible ? "text" : "password"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 pr-16 text-[0.9em] focus:border-primary outline-none transition-all placeholder:text-zinc-600"
                    placeholder={placeholder}
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-zinc-900/80 px-1 rounded-md backdrop-blur-sm opacity-60 group-hover/input:opacity-100 transition-opacity">
                    <button
                        onClick={() => setIsVisible(!isVisible)}
                        className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-md hover:bg-zinc-800 transition-colors"
                        title={isVisible ? "隱藏" : "顯示"}
                    >
                        {isVisible ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                    </button>
                    {value && (
                        <button
                            onClick={() => onChange("")}
                            className="p-1.5 text-zinc-500 hover:text-red-400 rounded-md hover:bg-zinc-800 transition-colors"
                            title="清除"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                </div>
            </div>
        );
    };

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

    const [isManualOpen, setIsManualOpen] = useState(false);

    // Updated hook usage for new file list
    const { temporaryFiles, addTemporaryFile, removeTemporaryFile, clearTemporaryFiles, isConnected } = useLive();
    const safeTemporaryFiles = temporaryFiles || []; // Safety fallback

    const contextFileInputRef = useRef<HTMLInputElement>(null);
    const profileFileInputRef = useRef<HTMLInputElement>(null);

    const [isParsing, setIsParsing] = useState(false);

    // Unused state for upload progress, kept for compatibility if needed later
    // const [uploadProgress, setUploadProgress] = useState(0);

    const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
    const [isCreatingProfile, setIsCreatingProfile] = useState(false);
    const [newProfileName, setNewProfileName] = useState("");

    const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);

    // Resizing Logic
    const [width, setWidth] = useState(settings.sidebarWidth || 320);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const resizingRef = useRef(false);

    // MAX_FILE_SIZE constant inside logic
    const MAX_FILE_SIZE = 10 * 1024 * 1024;

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
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                return;
            }
            try {
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
        // setUploadProgress(0);
        try {
            const text = await parseFileToText(file, (_progress) => { /* setUploadProgress(progress) */ });
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
            // setUploadProgress(0);
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

    // Ensure settings.customColors exists
    const colors = settings.customColors || THEME_PRESETS.ocean.colors;

    // --- NEW: Derive Active Tab for Mobile Hierarchy ---
    // If sidebarTab is 'profiles' or 'settings', we are in the "Settings" section.
    // Otherwise (or explicitly 'home'), we are in the "Home" section.
    const isSettingsTabActive = ['profiles', 'settings'].includes(sidebarTab);

    return (
        <>
            {/* Mobile Backdrop */}
            <div
                className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={() => setSidebarOpen(false)}
            />

            <div
                ref={sidebarRef}
                className={`
                    glass 
                    fixed bottom-0 left-0 w-full h-[95dvh] rounded-t-2xl z-50 transition-transform duration-300 transform translate-y-0
                    md:relative md:translate-y-0 md:h-full md:w-auto md:rounded-none md:border-r md:border-white/10 md:bg-black/20
                    flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)]
                `}
                style={{
                    width: window.innerWidth >= 768 ? width : '100%'
                }}
            >
                <UserManual isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />

                {/* Desktop Drag Handle */}
                <div
                    className="hidden md:block absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 z-50 transition-colors"
                    onMouseDown={startResizing}
                />

                {/* Mobile Drag Indicator */}
                <div className="md:hidden w-full flex justify-center pt-3 pb-1 shrink-0" onClick={() => setSidebarOpen(false)}>
                    <div className="w-12 h-1.5 rounded-full bg-zinc-600/50"></div>
                </div>

                {/* Header */}
                <div className="p-4 pt-1 border-b border-white/5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        </div>
                        <h1 className="font-bold text-xl tracking-tight text-white drop-shadow-sm truncate flex-1">{settings.appName}</h1>
                    </div>
                </div>

                {/* --- NEW ARCHITECTURE: Flex Column Layout --- */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">

                    {/* Primary Navigation Tabs (Segmented Control) */}
                    <div className="px-4 pb-2 shrink-0">
                        <div className="flex p-1 bg-black/20 rounded-xl border border-white/5">
                            <button
                                onClick={() => setSidebarTab('home')} // We'll treat any unknown tab as home, but explicit 'home' is safer if we add it to types, for now falls back to not-profiles/settings
                                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!isSettingsTabActive ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                                工作模式
                            </button>
                            <button
                                onClick={() => setSidebarTab('settings')}
                                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${isSettingsTabActive ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                            >
                                功能設定
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto p-4 pt-2 pb-32 space-y-4 custom-scrollbar min-h-0 overscroll-contain touch-pan-y relative px-4">

                        {/* TAB 1: 工作模式 (HOME) */}
                        {!isSettingsTabActive && (
                            <div className="space-y-4 animate-fade-in-right">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">選擇模式</label>
                                <button
                                    onClick={() => setViewMode('meeting')}
                                    className={`group w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${viewMode === 'meeting' ? 'bg-blue-600/10 border-blue-500/50 relative overflow-hidden' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                >
                                    {viewMode === 'meeting' && <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-transparent pointer-events-none" />}
                                    <div className={`p-3 rounded-xl ${viewMode === 'meeting' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-zinc-800 text-zinc-400 group-hover:text-white'}`}>
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                    </div>
                                    <div className="flex flex-col items-start gap-1">
                                        <span className={`text-base font-bold ${viewMode === 'meeting' ? 'text-white' : 'text-zinc-300'}`}>會議助手 AI</span>
                                        <span className="text-xs text-zinc-500 text-left">即時轉錄、與 AI 對話分析、產生摘要</span>
                                    </div>
                                    {viewMode === 'meeting' && <div className="ml-auto w-2 h-2 rounded-full bg-blue-500 shadow-md"></div>}
                                </button>

                                <button
                                    onClick={() => setViewMode('recording')}
                                    className={`group w-full flex items-center gap-4 p-4 rounded-2xl transition-all border ${viewMode === 'recording' ? 'bg-red-600/10 border-red-500/50 relative overflow-hidden' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                >
                                    {viewMode === 'recording' && <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 to-transparent pointer-events-none" />}
                                    <div className={`p-3 rounded-xl ${viewMode === 'recording' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-zinc-800 text-zinc-400 group-hover:text-white'}`}>
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                    </div>
                                    <div className="flex flex-col items-start gap-1">
                                        <span className={`text-base font-bold ${viewMode === 'recording' ? 'text-white' : 'text-zinc-300'}`}>獨立錄音</span>
                                        <span className="text-xs text-zinc-500 text-left">純淨錄音模式，無 AI 干擾，本地儲存</span>
                                    </div>
                                    {viewMode === 'recording' && <div className="ml-auto w-2 h-2 rounded-full bg-red-500 shadow-md"></div>}
                                </button>

                                <div className="pt-4 px-2">
                                    <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-center">
                                        <p className="text-xs text-indigo-300 mb-2">💡 小提示</p>
                                        <p className="text-xs text-zinc-400">目前為 <span className="text-white font-mono">v1.2 (Mobile Premium)</span> 版本。點擊上方的「功能設定」可管理知識庫與系統參數。</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: 功能設定 (SETTINGS) */}
                        {isSettingsTabActive && (
                            <div className="space-y-5 animate-fade-in-right">
                                {/* Sub-Navigation for Settings */}
                                <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 mb-2 sticky top-0 bg-[#xx] z-10 pt-1" style={{ backgroundColor: 'rgba(20, 20, 30, 0.95)', backdropFilter: 'blur(10px)' }}>
                                    <button
                                        onClick={() => setSidebarTab('settings')} // Default settings
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${sidebarTab === 'settings' ? 'bg-zinc-100 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    >
                                        系統設定
                                    </button>
                                    <button
                                        onClick={() => setSidebarTab('profiles')}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${sidebarTab === 'profiles' ? 'bg-zinc-100 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    >
                                        知識庫管理
                                    </button>
                                </div>

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
                                                <div key={p.id} className={`rounded-lg border transition-all ${settings.currentProfileId === p.id ? 'border-primary/50 bg-primary/10' : 'border-zinc-800 bg-zinc-900/30'} `}>
                                                    <div className="p-3 cursor-pointer" onClick={() => updateSettings({ currentProfileId: p.id })}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center gap-2 flex-1">
                                                                {settings.currentProfileId === p.id && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_5px_rgba(59,130,246,0.8)]"></div>}
                                                                <span className={`font-medium text-[0.95em] ${settings.currentProfileId === p.id ? 'text-primary' : 'text-zinc-200'}`}>{p.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <button onClick={(e) => { e.stopPropagation(); setEditingProfileId(editingProfileId === p.id ? null : p.id); }} className={`p-1 rounded hover:bg-zinc-800 ${editingProfileId === p.id ? 'text-primary text-zinc-500' : 'text-zinc-500'}`}>
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="text-[0.8em] text-zinc-500 truncate pl-3.5">
                                                            {p.documents.length} 份文件 • {p.description || "無描述"}
                                                        </div>
                                                    </div>

                                                    {editingProfileId === p.id && (
                                                        <div className="p-3 border-t border-zinc-800 bg-zinc-900/50 space-y-4 animate-fade-in-up cursor-default" onClick={(e) => e.stopPropagation()}>
                                                            <div className="space-y-2">
                                                                <label className="text-[0.75em] uppercase font-bold text-zinc-500 tracking-wider">設定檔名稱</label>
                                                                <div className="flex gap-2">
                                                                    <input type="text" value={p.name} onChange={(e) => updateProfile(p.id, { name: e.target.value })} className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm outline-none focus:border-primary focus:bg-zinc-800" />
                                                                    {p.id !== 'default' && (
                                                                        <button onClick={() => { if (confirm(`確定要刪除「${p.name}」嗎？此動作無法復原。`)) { deleteProfile(p.id); } }} className="px-2.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-400/50 transition-colors">
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-[0.75em] uppercase font-bold text-zinc-500 tracking-wider">描述</label>
                                                                <textarea value={p.description} onChange={(e) => updateProfile(p.id, { description: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-[0.85em] h-16 resize-none focus:border-primary outline-none" placeholder="描述此知識庫的用途..." />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-[0.75em] uppercase font-bold text-zinc-500 tracking-wider flex justify-between items-center">
                                                                    <span>知識庫文件 ({p.documents.length})</span>
                                                                </label>
                                                                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                                                                    {p.documents.length === 0 && <div className="text-[0.8em] text-zinc-600 italic py-2 text-center border border-dashed border-zinc-800 rounded">尚無文件</div>}
                                                                    {p.documents.map(doc => (
                                                                        <div key={doc.id} className="group flex items-center justify-between bg-zinc-800/50 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 rounded px-2 py-1.5 transition-all">
                                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                                <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                                                <span className="text-[0.85em] text-zinc-300 truncate" title={doc.name}>{doc.name}</span>
                                                                            </div>
                                                                            <button onClick={() => removeDocumentFromProfile(p.id, doc.id)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1" title="刪除文件">
                                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <input type="file" ref={profileFileInputRef} onChange={handleProfileFileChange} className="hidden" />
                                                                <button onClick={() => profileFileInputRef.current?.click()} className="w-full py-2 border border-dashed border-zinc-700 rounded text-[0.8em] text-zinc-400 hover:text-primary hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2">
                                                                    {isParsing ? "解析中..." : "上傳新文件 (PDF/Txt)"}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {sidebarTab === 'settings' && (
                                    <div className="space-y-6 animate-fadeIn">
                                        {/* Appearance */}
                                        <div className="space-y-3">
                                            <label className="text-[0.85em] font-semibold text-zinc-400 uppercase tracking-wider">外觀主題</label>
                                            <div className="space-y-2">
                                                {(Object.keys(THEME_PRESETS) as ThemePreset[]).map(key => (
                                                    <button key={key} onClick={() => applyPreset(key)} className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all ${settings.themePreset === key ? 'border-primary bg-primary/10 text-white' : 'border-zinc-800 bg-zinc-900/50 text-icon hover:bg-zinc-800'}`}>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-3 h-3 rounded-full" style={{ background: THEME_PRESETS[key].colors.primary }}></div>
                                                            <span className="text-sm">{THEME_PRESETS[key].name}</span>
                                                        </div>
                                                        {settings.themePreset === key && <span className="text-[0.7em] text-primary/80">當前範本</span>}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-zinc-800/50">
                                                <label className="text-[0.85em] font-semibold text-zinc-400 uppercase tracking-wider mb-3 block">細節微調</label>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {(['background', 'surface', 'text', 'icon', 'primary', 'secondary'] as const).map(colorKey => (
                                                        <div key={colorKey} className="space-y-1">
                                                            <span className="text-[0.7em] text-zinc-500 block capitalize">{colorKey}</span>
                                                            <div className="flex items-center gap-2 bg-zinc-900 rounded p-1.5 border border-zinc-700">
                                                                <input type="color" value={colors[colorKey] || '#000000'} onChange={(e) => updateColor(colorKey, e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0" />
                                                                <span className="text-[0.75em] font-mono text-zinc-300 truncate">{colors[colorKey] || '#000000'}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="border-t border-zinc-800"></div>

                                        {/* General Settings */}
                                        <div className="space-y-3">
                                            <label className="text-[0.85em] font-semibold text-zinc-400 uppercase tracking-wider">一般設定</label>
                                            <div className="space-y-2">
                                                <span className="text-[0.8em] text-zinc-500 block">應用程式名稱</span>
                                                <input type="text" value={settings.appName} onChange={(e) => updateSettings({ appName: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.95em] focus:border-primary outline-none" />
                                            </div>

                                            <div className="space-y-2">
                                                <span className="text-[0.8em] text-zinc-500 block">AI 互動模式</span>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button onClick={() => updateSettings({ aiInteractionMode: 'passive' })} className={`p-2 rounded border text-left transition-all ${settings.aiInteractionMode === 'passive' ? 'bg-primary/20 border-primary text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}>
                                                        <div className="font-medium text-sm mb-0.5">被動模式</div>
                                                    </button>
                                                    <button onClick={() => updateSettings({ aiInteractionMode: 'active' })} className={`p-2 rounded border text-left transition-all ${settings.aiInteractionMode === 'active' ? 'bg-amber-500/20 border-amber-500 text-white' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}>
                                                        <div className="font-medium text-sm mb-0.5">主動模式</div>
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <span className="text-[0.8em] text-zinc-500 block">錄製與轉錄語言</span>
                                                <select value={settings.recordingLanguage} onChange={(e) => updateSettings({ recordingLanguage: e.target.value as any })} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.95em] focus:border-primary outline-none">
                                                    <option value="zh-TW">繁體中文 (台灣)</option>
                                                    <option value="en-US">English (US)</option>
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <span className="text-[0.8em] text-zinc-500 block">麥克風來源</span>
                                                <select value={settings.selectedMicrophoneId} onChange={(e) => updateSettings({ selectedMicrophoneId: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.95em] focus:border-primary outline-none">
                                                    <option value="">預設麥克風</option>
                                                    {audioInputs.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 5)}`}</option>)}
                                                </select>
                                            </div>

                                            {/* AI Provider Settings */}
                                            <div className="space-y-2 pt-2 border-t border-zinc-800">
                                                <span className="text-[0.8em] text-zinc-500 block">AI 供應商</span>
                                                <select value={settings.provider} onChange={(e) => updateSettings({ provider: e.target.value as LLMProvider })} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[0.95em] focus:border-primary outline-none">
                                                    <option value="gemini">Google Gemini</option>
                                                    <option value="openai">OpenAI (GPT)</option>
                                                </select>
                                            </div>

                                            {settings.provider === 'openai' && (
                                                <div className="space-y-1">
                                                    <span className="text-[0.8em] text-zinc-500">OpenAI API Key</span>
                                                    <ApiKeyInput value={settings.apiKeys.openai} onChange={(val) => updateSettings({ apiKeys: { ...settings.apiKeys, openai: val } })} placeholder="sk-..." />
                                                </div>
                                            )}

                                            {settings.provider === 'gemini' && (
                                                <div className="space-y-1">
                                                    <span className="text-[0.8em] text-zinc-500">Gemini API Key</span>
                                                    <ApiKeyInput value={settings.apiKeys.gemini} onChange={(val) => updateSettings({ apiKeys: { ...settings.apiKeys, gemini: val } })} placeholder="AIza..." />
                                                </div>
                                            )}

                                            {/* UI Display Settings */}
                                            <div className="space-y-2 pt-2 border-t border-zinc-800">
                                                <span className="text-[0.8em] text-zinc-500 block">內文文字大小</span>
                                                <div className="flex bg-zinc-900 rounded border border-zinc-700 p-1">
                                                    {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
                                                        <button key={size} onClick={() => updateSettings({ contentFontSize: size })} className={`flex-1 py-1 text-xs rounded transition-colors ${settings.contentFontSize === size ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
                                                            {size.toUpperCase()}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-3 border-t border-white/5 shrink-0">
                    <button
                        onClick={() => setIsManualOpen(true)}
                        className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all text-sm group"
                    >
                        <svg className="w-5 h-5 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        <span>使用說明書 (User Manual)</span>
                    </button>
                </div>

                <div
                    className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-primary/50 cursor-col-resize z-50 transition-colors"
                    onMouseDown={startResizing}
                />
            </div>
        </>
    );
};

export default Sidebar;