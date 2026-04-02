import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { GoogleGenAI } from '@google/genai';
import { downloadAsWord, downloadAsPDF } from '../utils/downloadUtils';

interface TranslationEntry {
    id: string;
    source: string;
    translated: string;
    sourceLang: string;
    targetLang: string;
    sourceLangCode: string;
    targetLangCode: string;
}

interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

const LANGUAGES = [
    { code: 'zh-TW', name: '中文（繁體）', flag: '🇹🇼', langHint: 'Traditional Chinese' },
    { code: 'zh-CN', name: '中文（簡體）', flag: '🇨🇳', langHint: 'Simplified Chinese' },
    { code: 'en-US', name: 'English', flag: '🇺🇸', langHint: 'English' },
    { code: 'ja-JP', name: '日本語', flag: '🇯🇵', langHint: 'Japanese' },
    { code: 'ko-KR', name: '한국어', flag: '🇰🇷', langHint: 'Korean' },
    { code: 'vi-VN', name: 'Tiếng Việt', flag: '🇻🇳', langHint: 'Vietnamese' },
];

type TTSMode = 'off' | 'target' | 'both';

const TranslatorView: React.FC = () => {
    const { settings } = useApp();
    const [sourceLang, setSourceLang] = useState('zh-TW');
    const [targetLang, setTargetLang] = useState('en-US');
    const [inputText, setInputText] = useState('');
    const [history, setHistory] = useState<TranslationEntry[]>([]);
    const [isTranslating, setIsTranslating] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    // Feature 1: Continuous mode
    const [continuousMode, setContinuousMode] = useState(false);
    // Feature 2: TTS
    const [ttsMode, setTtsMode] = useState<TTSMode>('off');
    const [isSpeaking, setIsSpeaking] = useState(false);

    const recognitionRef = useRef<any>(null);
    const historyContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const continuousModeRef = useRef(continuousMode);
    const isTranslatingRef = useRef(false);
    const ttsModeRef = useRef<TTSMode>(ttsMode);

    // Keep refs in sync for use inside callbacks
    useEffect(() => { continuousModeRef.current = continuousMode; }, [continuousMode]);
    useEffect(() => { ttsModeRef.current = ttsMode; }, [ttsMode]);

    useEffect(() => {
        if (historyContainerRef.current) {
            historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
        }
    }, [history]);

    // Cleanup speech on unmount
    useEffect(() => {
        return () => {
            window.speechSynthesis?.cancel();
            recognitionRef.current?.stop();
        };
    }, []);

    const getLanguageName = (code: string) => LANGUAGES.find(l => l.code === code)?.name || code;

    const swapLanguages = () => {
        setSourceLang(targetLang);
        setTargetLang(sourceLang);
    };

    // ========= TTS (Text-to-Speech) =========
    const speakText = useCallback((text: string, langCode: string): Promise<void> => {
        return new Promise((resolve) => {
            if (!window.speechSynthesis) { resolve(); return; }
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = langCode;
            utterance.rate = 0.95;
            // Try to find a matching voice
            const voices = window.speechSynthesis.getVoices();
            const match = voices.find(v => v.lang === langCode) ||
                          voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
            if (match) utterance.voice = match;
            utterance.onend = () => resolve();
            utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
        });
    }, []);

    const handleTTS = useCallback(async (entry: TranslationEntry, mode: TTSMode) => {
        if (mode === 'off') return;
        setIsSpeaking(true);
        try {
            if (mode === 'both') {
                await speakText(entry.source, entry.sourceLangCode);
                // Small pause between languages
                await new Promise(r => setTimeout(r, 400));
            }
            await speakText(entry.translated, entry.targetLangCode);
        } finally {
            setIsSpeaking(false);
        }
    }, [speakText]);

    // ========= Translation =========
    const translateText = useCallback(async (text: string) => {
        if (!text.trim() || isTranslatingRef.current) return;

        const keys = settings.apiKeys.gemini?.split(',').map(k => k.trim()).filter(Boolean) || [];
        if (keys.length === 0) {
            setError('請先在系統設定中填入 Gemini API Key。');
            return;
        }

        isTranslatingRef.current = true;
        setIsTranslating(true);
        setError(null);
        setInputText('');

        const srcName = getLanguageName(sourceLang);
        const tgtName = getLanguageName(targetLang);
        const tgtLangHint = LANGUAGES.find(l => l.code === targetLang)?.langHint || targetLang;

        const prompt = `You are a professional translator.

## CRITICAL RULE: 
You MUST translate into ${tgtName} (${tgtLangHint}). 
Do NOT translate into English or any other language. 
The output MUST be written entirely in ${tgtName}.

## Task:
Translate the following text from ${srcName} into ${tgtName}.

## Rules:
- Output ONLY the translated text in ${tgtName}, nothing else.
- Do NOT add any explanations, notes, or annotations.
- Maintain the original tone and formality.
- If it’s a greeting or short phrase, keep it natural in ${tgtName}.

## Text to translate:
${text}`;

        let translated = '';
        let success = false;

        for (const key of keys) {
            try {
                const ai = new GoogleGenAI({ apiKey: key });
                const response = await ai.models.generateContent({
                    model: settings.geminiAnalysisModel || 'gemini-2.5-flash',
                    contents: prompt,
                });
                translated = response.text?.trim() || '翻譯失敗';
                success = true;
                break;
            } catch (err: any) {
                if (err.message?.includes('429') || err.message?.includes('quota')) continue;
                translated = `錯誤: ${err.message}`;
                break;
            }
        }

        if (!success && !translated) {
            translated = '所有 API Key 額度已耗盡，請新增更多 Key。';
        }

        const entry: TranslationEntry = {
            id: Date.now().toString(),
            source: text,
            translated,
            sourceLang: srcName,
            targetLang: tgtName,
            sourceLangCode: sourceLang,
            targetLangCode: targetLang,
        };
        setHistory(prev => [...prev, entry]);
        isTranslatingRef.current = false;
        setIsTranslating(false);

        // Auto TTS after translation
        if (ttsModeRef.current !== 'off' && success) {
            handleTTS(entry, ttsModeRef.current);
        }
    }, [settings, sourceLang, targetLang, handleTTS]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        translateText(inputText);
    };

    // ========= Speech Recognition (Continuous + Single) =========
    const startListening = useCallback(() => {
        const SpeechRecognition = (window as unknown as IWindow).SpeechRecognition || (window as unknown as IWindow).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('您的瀏覽器不支援語音輸入功能。');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = sourceLang;
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => {
            // If continuous mode is ON, automatically restart after processing
            if (continuousModeRef.current && !isTranslatingRef.current) {
                setTimeout(() => {
                    try {
                        recognition.start();
                    } catch (e) {
                        setIsListening(false);
                    }
                }, 300);
            } else if (!continuousModeRef.current) {
                setIsListening(false);
            }
        };
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                translateText(transcript);
            }
        };
        recognition.onerror = (e: any) => {
            if (e.error === 'no-speech' && continuousModeRef.current) {
                // No speech detected, retry in continuous mode
                return;
            }
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    }, [sourceLang, translateText]);

    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        setIsListening(false);
    }, []);

    const toggleListening = () => {
        if (isListening) {
            // If in continuous mode, also turn it off
            if (continuousMode) {
                setContinuousMode(false);
            }
            stopListening();
        } else {
            startListening();
        }
    };

    // When continuous mode is toggled ON, auto-start listening
    useEffect(() => {
        if (continuousMode && !isListening) {
            startListening();
        } else if (!continuousMode && isListening) {
            stopListening();
        }
    }, [continuousMode]);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const handleExport = (format: 'word' | 'pdf') => {
        if (history.length === 0) return;
        const content = history.map((e, i) =>
            `## 翻譯 #${i + 1}\n\n**${e.sourceLang}：** ${e.source}\n\n**${e.targetLang}：** ${e.translated}\n\n---\n`
        ).join('\n');
        const title = `翻譯紀錄 - ${new Date().toLocaleDateString('zh-TW')}`;
        if (format === 'word') downloadAsWord(content, title);
        else downloadAsPDF(content, title);
    };

    const clearHistory = () => setHistory([]);

    // Manual TTS replay for individual entry
    const replayTTS = (entry: TranslationEntry, mode: 'source' | 'target') => {
        window.speechSynthesis?.cancel();
        const langCode = mode === 'source' ? entry.sourceLangCode : entry.targetLangCode;
        const text = mode === 'source' ? entry.source : entry.translated;
        speakText(text, langCode);
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Background */}
            <div className="absolute inset-0 pointer-events-none z-0 opacity-30">
                <div className="absolute top-[-10%] left-[20%] w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-[100px]"></div>
            </div>

            {/* Header */}
            <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-zinc-800/50 z-10 bg-background/80 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-zinc-100">即時雙語翻譯</h2>
                            <p className="text-[0.65rem] text-zinc-500">
                                {continuousMode ? '🔴 持續翻譯模式運行中' : '語音或文字輸入，AI 即時翻譯'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {/* Settings Toggle */}
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
                            title="翻譯設定"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </button>
                        {history.length > 0 && (
                            <>
                                <button onClick={() => handleExport('word')} className="px-2 py-1.5 text-[0.65rem] bg-blue-600/20 text-blue-300 rounded-lg hover:bg-blue-600/30 transition-colors border border-blue-500/20" title="匯出 Word">📄</button>
                                <button onClick={() => handleExport('pdf')} className="px-2 py-1.5 text-[0.65rem] bg-red-600/20 text-red-300 rounded-lg hover:bg-red-600/30 transition-colors border border-red-500/20" title="匯出 PDF">📕</button>
                                <button onClick={clearHistory} className="px-2 py-1.5 text-[0.65rem] bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 transition-colors" title="清除紀錄">🗑️</button>
                            </>
                        )}
                    </div>
                </div>

                {/* Settings Panel (Collapsible) */}
                {showSettings && (
                    <div className="mb-3 p-3 bg-zinc-900/80 border border-zinc-700/50 rounded-xl space-y-3 animate-fade-in-up">
                        {/* Continuous Mode Toggle */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-400">🔄 持續翻譯模式</span>
                                <span className="text-[0.6rem] text-zinc-600">(自動持續聆聽)</span>
                            </div>
                            <button
                                onClick={() => setContinuousMode(!continuousMode)}
                                className={`relative w-11 h-6 rounded-full transition-colors ${continuousMode ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${continuousMode ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                            </button>
                        </div>

                        {/* TTS Mode */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-400">🔊 語音朗讀</span>
                            </div>
                            <div className="flex gap-1">
                                {([
                                    { value: 'off' as TTSMode, label: '關閉', icon: '🔇' },
                                    { value: 'target' as TTSMode, label: '單向', icon: '🔈' },
                                    { value: 'both' as TTSMode, label: '雙向', icon: '🔊' },
                                ]).map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setTtsMode(opt.value)}
                                        className={`px-2.5 py-1 text-[0.65rem] rounded-lg border transition-all ${
                                            ttsMode === opt.value
                                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                                                : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                                        }`}
                                    >
                                        {opt.icon} {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {ttsMode !== 'off' && (
                            <p className="text-[0.6rem] text-zinc-600 pl-1">
                                {ttsMode === 'target' ? '📌 翻譯完成後自動朗讀目標語言' : '📌 翻譯完成後先朗讀原文，再朗讀譯文'}
                            </p>
                        )}
                    </div>
                )}

                {/* Language Selector */}
                <div className="flex items-center gap-2 justify-center">
                    <select
                        value={sourceLang}
                        onChange={(e) => setSourceLang(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors flex-1 min-w-0"
                    >
                        {LANGUAGES.map(l => (
                            <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                        ))}
                    </select>

                    <button
                        onClick={swapLanguages}
                        className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 transition-all hover:scale-110 active:scale-95 border border-zinc-700 shrink-0"
                        title="交換語言"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    </button>

                    <select
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors flex-1 min-w-0"
                    >
                        {LANGUAGES.map(l => (
                            <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Translation History */}
            <div ref={historyContainerRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3 custom-scrollbar z-10">
                {history.length === 0 && !isTranslating ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                        <svg className="w-16 h-16 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                        <p className="text-sm">輸入文字或點擊麥克風開始翻譯</p>
                        <p className="text-xs text-zinc-600">支援 中/英/日/韓/越 即時互譯</p>
                        <p className="text-[0.65rem] text-zinc-700 mt-2">💡 點擊 ⚙ 設定 → 開啟「持續翻譯」與「語音朗讀」</p>
                    </div>
                ) : (
                    <>
                        {history.map((entry) => (
                            <div key={entry.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm animate-fade-in-up">
                                {/* Source */}
                                <div className="px-4 py-3 border-b border-zinc-800/50">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[0.65rem] font-medium text-zinc-500">{entry.sourceLang}</span>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => replayTTS(entry, 'source')} className="text-zinc-600 hover:text-zinc-300 transition-colors p-1" title="朗讀原文">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                            </button>
                                            <button onClick={() => copyToClipboard(entry.source)} className="text-zinc-600 hover:text-zinc-300 transition-colors p-1" title="複製原文">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-zinc-300 text-sm leading-relaxed">{entry.source}</p>
                                </div>
                                {/* Translated */}
                                <div className="px-4 py-3 bg-emerald-500/5">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[0.65rem] font-medium text-emerald-400">{entry.targetLang}</span>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => replayTTS(entry, 'target')} className="text-zinc-600 hover:text-emerald-300 transition-colors p-1" title="朗讀翻譯">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                            </button>
                                            <button onClick={() => copyToClipboard(entry.translated)} className="text-zinc-600 hover:text-emerald-300 transition-colors p-1" title="複製翻譯">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-emerald-100 text-sm leading-relaxed font-medium">{entry.translated}</p>
                                </div>
                            </div>
                        ))}
                        {isTranslating && (
                            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl px-5 py-5 text-center">
                                <div className="flex items-center justify-center gap-2 text-emerald-400">
                                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <span className="text-sm">翻譯中...</span>
                                </div>
                            </div>
                        )}

                    </>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="mx-4 sm:mx-6 mb-2 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-300 text-xs z-10">
                    {error}
                </div>
            )}

            {/* Speaking Indicator */}
            {isSpeaking && (
                <div className="mx-4 sm:mx-6 mb-2 p-2 bg-emerald-900/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center justify-center gap-2 z-10">
                    <div className="flex gap-0.5">
                        <div className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" style={{animationDelay: '0ms'}}></div>
                        <div className="w-1 h-4 bg-emerald-400 rounded-full animate-pulse" style={{animationDelay: '150ms'}}></div>
                        <div className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" style={{animationDelay: '300ms'}}></div>
                    </div>
                    語音朗讀中...
                </div>
            )}

            {/* Input Bar */}
            <form onSubmit={handleSubmit} className="shrink-0 px-4 sm:px-6 py-3 border-t border-zinc-800/50 z-10 bg-background/80 backdrop-blur-sm">
                {/* Continuous mode status bar */}
                {continuousMode && (
                    <div className="mb-2 flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                            <span className="text-[0.65rem] text-emerald-300">持續翻譯中 — 請直接說話</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setContinuousMode(false)}
                            className="text-[0.65rem] text-zinc-400 hover:text-red-400 transition-colors px-2 py-0.5 rounded bg-zinc-800/50"
                        >
                            停止
                        </button>
                    </div>
                )}
                <div className="relative flex items-center">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={continuousMode ? "持續翻譯模式中，也可手動輸入..." : isListening ? "正在聆聽中..." : "輸入要翻譯的文字..."}
                        disabled={isTranslating}
                        className={`w-full bg-zinc-900 border ${isListening ? 'border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-zinc-700'} rounded-xl pl-12 pr-12 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-sm disabled:opacity-50 text-sm`}
                    />
                    <button
                        type="button"
                        onClick={toggleListening}
                        disabled={isTranslating}
                        className={`absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all ${isListening
                            ? 'text-emerald-500 hover:bg-emerald-500/10 animate-pulse'
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
                        disabled={!inputText.trim() || isTranslating}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default TranslatorView;
