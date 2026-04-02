import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { GoogleGenAI } from '@google/genai';
import { downloadAsWord, downloadAsPDF } from '../utils/downloadUtils';

interface TranslationEntry {
    id: string;
    source: string;
    translated: string;
    sourceLang: string;
    targetLang: string;
}

interface IWindow extends Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
}

const LANGUAGES = [
    { code: 'zh-TW', name: '中文（繁體）', flag: '🇹🇼' },
    { code: 'zh-CN', name: '中文（簡體）', flag: '🇨🇳' },
    { code: 'en-US', name: 'English', flag: '🇺🇸' },
    { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
    { code: 'ko-KR', name: '한국어', flag: '🇰🇷' },
    { code: 'vi-VN', name: 'Tiếng Việt', flag: '🇻🇳' },
];

const TranslatorView: React.FC = () => {
    const { settings } = useApp();
    const [sourceLang, setSourceLang] = useState('zh-TW');
    const [targetLang, setTargetLang] = useState('en-US');
    const [inputText, setInputText] = useState('');
    const [history, setHistory] = useState<TranslationEntry[]>([]);
    const [isTranslating, setIsTranslating] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);
    const historyEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    const getLanguageName = (code: string) => LANGUAGES.find(l => l.code === code)?.name || code;

    const swapLanguages = () => {
        setSourceLang(targetLang);
        setTargetLang(sourceLang);
    };

    const translateText = async (text: string) => {
        if (!text.trim() || isTranslating) return;

        const keys = settings.apiKeys.gemini?.split(',').map(k => k.trim()).filter(Boolean) || [];
        if (keys.length === 0) {
            setError('請先在系統設定中填入 Gemini API Key。');
            return;
        }

        setIsTranslating(true);
        setError(null);
        setInputText('');

        const srcName = getLanguageName(sourceLang);
        const tgtName = getLanguageName(targetLang);

        const prompt = `You are a professional translator. Translate the following text from ${srcName} to ${tgtName}. 
Rules:
- Output ONLY the translated text, no explanations.
- Maintain the original tone and formality.
- If it's a greeting or short phrase, keep it natural in ${tgtName}.

Text to translate:
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
        };
        setHistory(prev => [...prev, entry]);
        setIsTranslating(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        translateText(inputText);
    };

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

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
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                translateText(transcript);
            }
        };
        recognition.onerror = () => setIsListening(false);

        recognitionRef.current = recognition;
        recognition.start();
    };

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

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Background */}
            <div className="absolute inset-0 pointer-events-none z-0 opacity-30">
                <div className="absolute top-[-10%] left-[20%] w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-[100px]"></div>
            </div>

            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-zinc-800/50 z-10 bg-background/80 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-zinc-100">即時雙語翻譯</h2>
                            <p className="text-xs text-zinc-500">語音或文字輸入，AI 即時翻譯</p>
                        </div>
                    </div>
                    {history.length > 0 && (
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleExport('word')} className="px-3 py-1.5 text-xs bg-blue-600/20 text-blue-300 rounded-lg hover:bg-blue-600/30 transition-colors border border-blue-500/20" title="匯出 Word">
                                📄 Word
                            </button>
                            <button onClick={() => handleExport('pdf')} className="px-3 py-1.5 text-xs bg-red-600/20 text-red-300 rounded-lg hover:bg-red-600/30 transition-colors border border-red-500/20" title="匯出 PDF">
                                📕 PDF
                            </button>
                            <button onClick={clearHistory} className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 transition-colors" title="清除紀錄">
                                🗑️
                            </button>
                        </div>
                    )}
                </div>

                {/* Language Selector */}
                <div className="flex items-center gap-3 justify-center">
                    <select
                        value={sourceLang}
                        onChange={(e) => setSourceLang(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors min-w-[140px]"
                    >
                        {LANGUAGES.map(l => (
                            <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                        ))}
                    </select>

                    <button
                        onClick={swapLanguages}
                        className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400 transition-all hover:scale-110 active:scale-95 border border-zinc-700"
                        title="交換語言"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                    </button>

                    <select
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors min-w-[140px]"
                    >
                        {LANGUAGES.map(l => (
                            <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Translation History */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar z-10">
                {history.length === 0 && !isTranslating ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                        <svg className="w-16 h-16 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                        <p className="text-sm">輸入文字或點擊麥克風開始翻譯</p>
                        <p className="text-xs text-zinc-600">支援 中/英/日/韓/越 即時互譯</p>
                    </div>
                ) : (
                    <>
                        {history.map((entry) => (
                            <div key={entry.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm animate-fade-in-up">
                                {/* Source */}
                                <div className="px-5 py-4 border-b border-zinc-800/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-zinc-500">{entry.sourceLang}</span>
                                        <button onClick={() => copyToClipboard(entry.source)} className="text-zinc-600 hover:text-zinc-300 transition-colors p-1" title="複製原文">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                        </button>
                                    </div>
                                    <p className="text-zinc-300 text-sm leading-relaxed">{entry.source}</p>
                                </div>
                                {/* Translated */}
                                <div className="px-5 py-4 bg-emerald-500/5">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-emerald-400">{entry.targetLang}</span>
                                        <button onClick={() => copyToClipboard(entry.translated)} className="text-zinc-600 hover:text-emerald-300 transition-colors p-1" title="複製翻譯">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                        </button>
                                    </div>
                                    <p className="text-emerald-100 text-sm leading-relaxed font-medium">{entry.translated}</p>
                                </div>
                            </div>
                        ))}
                        {isTranslating && (
                            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl px-5 py-6 text-center">
                                <div className="flex items-center justify-center gap-2 text-emerald-400">
                                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <span className="text-sm">翻譯中...</span>
                                </div>
                            </div>
                        )}
                        <div ref={historyEndRef} />
                    </>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="mx-6 mb-2 p-3 bg-red-900/30 border border-red-500/30 rounded-xl text-red-300 text-xs z-10">
                    {error}
                </div>
            )}

            {/* Input Bar */}
            <form onSubmit={handleSubmit} className="shrink-0 px-6 py-4 border-t border-zinc-800/50 z-10 bg-background/80 backdrop-blur-sm">
                <div className="relative flex items-center">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={isListening ? "正在聆聽中..." : "輸入要翻譯的文字..."}
                        disabled={isTranslating}
                        className={`w-full bg-zinc-900 border ${isListening ? 'border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-zinc-700'} rounded-xl pl-12 pr-12 py-3.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-sm disabled:opacity-50 text-sm`}
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
