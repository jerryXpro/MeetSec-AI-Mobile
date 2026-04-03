import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { createPcmBlob, base64ToBytes, decodeAudioData, downsampleBuffer } from '../utils/audioUtils';
import { ConnectionState } from '../types';
import { downloadAsWord, downloadAsPDF } from '../utils/downloadUtils';
import { useWakeLock } from '../hooks/useWakeLock';

interface TranslationEntry {
    id: string;
    source: string;
    translated: string;
    sourceLang: string;
    targetLang: string;
}

const LANGUAGES = [
    { code: 'zh-TW', name: '中文（繁體）', flag: '🇹🇼', langHint: 'Traditional Chinese (繁體中文)' },
    { code: 'zh-CN', name: '中文（簡體）', flag: '🇨🇳', langHint: 'Simplified Chinese (简体中文)' },
    { code: 'en-US', name: 'English', flag: '🇺🇸', langHint: 'English' },
    { code: 'ja-JP', name: '日本語', flag: '🇯🇵', langHint: 'Japanese (日本語)' },
    { code: 'ko-KR', name: '한국어', flag: '🇰🇷', langHint: 'Korean (한국어)' },
    { code: 'vi-VN', name: 'Tiếng Việt', flag: '🇻🇳', langHint: 'Vietnamese (Tiếng Việt)' },
];

const GEMINI_VOICES = [
    { name: 'Aoede', label: 'Aoede', gender: '女聲' },
    { name: 'Kore', label: 'Kore', gender: '女聲' },
    { name: 'Puck', label: 'Puck', gender: '男聲' },
    { name: 'Charon', label: 'Charon', gender: '男聲' },
    { name: 'Fenrir', label: 'Fenrir', gender: '男聲' },
];

const TranslatorView: React.FC = () => {
    const { settings } = useApp();
    const { requestWakeLock, releaseWakeLock } = useWakeLock();
    const [sourceLang, setSourceLang] = useState('zh-TW');
    const [targetLang, setTargetLang] = useState('en-US');
    const [history, setHistory] = useState<TranslationEntry[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [selectedVoice, setSelectedVoice] = useState(settings.geminiVoice || 'Kore');
    const [inputText, setInputText] = useState('');
    const [isTranslating, setIsTranslating] = useState(false);

    // TTS (Browser SpeechSynthesis for text mode)
    type TTSMode = 'off' | 'target' | 'both';
    const [ttsMode, setTtsMode] = useState<TTSMode>('off');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const ttsModeRef = useRef<TTSMode>('off');
    useEffect(() => { ttsModeRef.current = ttsMode; }, [ttsMode]);

    // Live connection state
    const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);

    // Partial transcription display
    const [partialInput, setPartialInput] = useState('');
    const [partialOutput, setPartialOutput] = useState('');

    // Live session refs
    const activeRef = useRef(false);
    const sessionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());

    // Transcription accumulation
    const currentInputRef = useRef('');
    const currentOutputRef = useRef('');
    const sourceLangRef = useRef(sourceLang);
    const targetLangRef = useRef(targetLang);

    const historyContainerRef = useRef<HTMLDivElement>(null);

    // Keep refs in sync
    useEffect(() => { sourceLangRef.current = sourceLang; }, [sourceLang]);
    useEffect(() => { targetLangRef.current = targetLang; }, [targetLang]);

    useEffect(() => {
        if (historyContainerRef.current) {
            historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
        }
    }, [history, partialInput, partialOutput]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnectLive();
            window.speechSynthesis?.cancel();
        };
    }, []);

    // --- Browser TTS for text-mode translations ---
    const speakText = useCallback((text: string, langCode: string): Promise<void> => {
        return new Promise((resolve) => {
            if (!window.speechSynthesis) { resolve(); return; }
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = langCode;
            utterance.rate = 0.92;
            const voices = window.speechSynthesis.getVoices();
            const langPrefix = langCode.split('-')[0];
            const candidates = voices
                .filter(v => v.lang === langCode || v.lang.startsWith(langPrefix))
                .sort((a, b) => {
                    if (!a.localService && b.localService) return -1;
                    if (a.localService && !b.localService) return 1;
                    const aG = a.name.toLowerCase().includes('google');
                    const bG = b.name.toLowerCase().includes('google');
                    if (aG && !bG) return -1;
                    if (!aG && bG) return 1;
                    return 0;
                });
            if (candidates[0]) utterance.voice = candidates[0];
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
                await speakText(entry.source, sourceLangRef.current);
                await new Promise(r => setTimeout(r, 400));
            }
            await speakText(entry.translated, targetLangRef.current);
        } finally {
            setIsSpeaking(false);
        }
    }, [speakText]);

    const replayTTS = (entry: TranslationEntry, mode: 'source' | 'target') => {
        window.speechSynthesis?.cancel();
        const langCode = mode === 'source' ? sourceLangRef.current : targetLangRef.current;
        const text = mode === 'source' ? entry.source : entry.translated;
        speakText(text, langCode);
    };

    const getLanguageName = (code: string) => LANGUAGES.find(l => l.code === code)?.name || code;
    const getLanguageHint = (code: string) => LANGUAGES.find(l => l.code === code)?.langHint || code;

    const swapLanguages = () => {
        if (connectionState === ConnectionState.CONNECTED) {
            // Disconnect and reconnect with swapped languages
            disconnectLive();
        }
        setSourceLang(targetLang);
        setTargetLang(sourceLang);
    };

    const getApiKey = useCallback(() => {
        const keys = settings.apiKeys.gemini?.split(',').map(k => k.trim()).filter(Boolean) || [];
        return keys[0] || '';
    }, [settings]);

    const buildSystemPrompt = useCallback(() => {
        const srcName = getLanguageName(sourceLang);
        const tgtName = getLanguageName(targetLang);
        const tgtHint = getLanguageHint(targetLang);

        return `你是一位專業的即時口譯員。

## 任務
使用者會用 ${srcName} 對你說話。你必須將他說的內容**即時翻譯成 ${tgtName} (${tgtHint})**。

## 絕對規則
1. **只回覆翻譯結果**。不要加任何解釋、評論、問候語或寒暄。
2. **回覆必須完全使用 ${tgtName}**，不可夾雜其他語言。
3. 保持原文的語氣、正式程度和情感。
4. 如果使用者說「你好」或其他招呼語，直接翻譯成 ${tgtName} 的對應打招呼用語。
5. 如果無法聽清使用者說的話，用 ${tgtName} 說「請再說一次」。
6. 用口語化、自然的方式翻譯，因為你的回答會被直接朗讀出來。
7. 不要使用任何 markdown 格式符號。
8. 翻譯要簡潔精準，口語對話風格。`;
    }, [sourceLang, targetLang]);

    // --- Gemini Live Connection ---
    const connectLive = useCallback(async () => {
        const apiKey = getApiKey();
        if (!apiKey) {
            setError('請先在系統設定中填入 Gemini API Key。');
            return;
        }

        try {
            setConnectionState(ConnectionState.CONNECTING);
            setError(null);
            requestWakeLock();

            const ai = new GoogleGenAI({ apiKey });

            // Setup audio
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            } else if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    deviceId: settings.selectedMicrophoneId ? { exact: settings.selectedMicrophoneId } : undefined
                }
            });

            const config = {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
                },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction: buildSystemPrompt(),
            };

            const sessionPromise = ai.live.connect({
                model: settings.geminiLiveModel || 'gemini-2.5-flash-native-audio-preview-12-2025',
                config: config,
                callbacks: {
                    onopen: async () => {
                        setConnectionState(ConnectionState.CONNECTED);
                        activeRef.current = true;
                        try {
                            sessionRef.current = await sessionPromise;
                        } catch (e) {
                            console.error('[TranslatorLive] Failed to capture session:', e);
                        }
                        startAudioStreaming(sessionPromise, mediaStreamRef.current!);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        handleLiveMessage(message);
                    },
                    onclose: (e: CloseEvent) => {
                        console.warn(`[TranslatorLive] Closed. Code: ${e.code}`);
                        activeRef.current = false;
                        setConnectionState(ConnectionState.DISCONNECTED);
                    },
                    onerror: (err: any) => {
                        const errMsg = err?.message || err?.toString() || 'Unknown error';
                        console.error('[TranslatorLive] Error:', errMsg);
                        setConnectionState(ConnectionState.ERROR);
                        setError(`連線錯誤: ${errMsg}`);
                        cleanupAudio();
                    }
                }
            });

            await sessionPromise;

        } catch (error: any) {
            console.error('[TranslatorLive] Connect failed:', error);
            setConnectionState(ConnectionState.ERROR);
            setError(`無法連線: ${error.message}`);
            cleanupAudio();
        }
    }, [getApiKey, settings, selectedVoice, buildSystemPrompt]);

    const startAudioStreaming = useCallback((sessionPromise: Promise<any>, stream: MediaStream) => {
        if (!audioContextRef.current) return;

        sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
        scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

        scriptProcessorRef.current.onaudioprocess = (e) => {
            if (!activeRef.current) return;

            const inputData = e.inputBuffer.getChannelData(0);
            const inputSampleRate = audioContextRef.current?.sampleRate || 16000;
            const downsampledData = downsampleBuffer(inputData, inputSampleRate, 16000);

            // Noise gate
            let sum = 0;
            for (let i = 0; i < downsampledData.length; i++) {
                sum += downsampledData[i] * downsampledData[i];
            }
            const rms = Math.sqrt(sum / downsampledData.length);
            const threshold = settings.noiseThreshold ?? 0.002;

            let processedData = downsampledData;
            if (rms < threshold) {
                processedData = new Float32Array(downsampledData.length);
            }

            const pcmBlob = createPcmBlob(processedData);
            sessionPromise.then((session) => {
                if (activeRef.current) {
                    session.sendRealtimeInput({ media: pcmBlob });
                }
            });
        };

        sourceNodeRef.current.connect(scriptProcessorRef.current);
        scriptProcessorRef.current.connect(audioContextRef.current.destination);
    }, [settings.noiseThreshold]);

    const handleLiveMessage = useCallback((message: LiveServerMessage) => {
        if (!audioContextRef.current) return;

        // Input transcription (user speech = source language)
        if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            currentInputRef.current += text;
            setPartialInput(currentInputRef.current);
        }

        // Output transcription (AI speech = translated text)
        if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            currentOutputRef.current += text;
            setPartialOutput(currentOutputRef.current);
        }

        // Turn complete — save to history
        if (message.serverContent?.turnComplete) {
            const inputText = currentInputRef.current.trim();
            const outputText = currentOutputRef.current.trim();

            if (inputText || outputText) {
                const entry: TranslationEntry = {
                    id: Date.now().toString(),
                    source: inputText || '...',
                    translated: outputText || '(翻譯中...)',
                    sourceLang: getLanguageName(sourceLangRef.current),
                    targetLang: getLanguageName(targetLangRef.current),
                };
                setHistory(prev => [...prev, entry]);
            }

            currentInputRef.current = '';
            currentOutputRef.current = '';
            setPartialInput('');
            setPartialOutput('');
        }

        // Play audio
        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio && audioContextRef.current) {
            const ctx = audioContextRef.current;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

            const audioBytes = base64ToBytes(base64Audio);
            decodeAudioData(audioBytes, ctx, 24000, 1).then(audioBuffer => {
                if (!activeRef.current) return;
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                audioSourcesRef.current.add(source);
            });
        }

        // Interrupted
        if (message.serverContent?.interrupted) {
            audioSourcesRef.current.forEach(source => { try { source.stop(); } catch {} });
            audioSourcesRef.current.clear();
            nextStartTimeRef.current = 0;
            currentOutputRef.current = '';
            setPartialOutput('');
        }
    }, []);

    const cleanupAudio = useCallback(() => {
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        sourceNodeRef.current?.disconnect();
        scriptProcessorRef.current?.disconnect();
        audioSourcesRef.current.forEach(s => { try { s.stop(); } catch {} });
        audioSourcesRef.current.clear();
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(() => {});
        }
        mediaStreamRef.current = null;
        sourceNodeRef.current = null;
        scriptProcessorRef.current = null;
        audioContextRef.current = null;
        nextStartTimeRef.current = 0;
    }, []);

    const disconnectLive = useCallback(() => {
        activeRef.current = false;
        sessionRef.current = null;
        cleanupAudio();
        setConnectionState(ConnectionState.DISCONNECTED);
        setPartialInput('');
        setPartialOutput('');
        releaseWakeLock();
    }, [cleanupAudio, releaseWakeLock]);

    const toggleConnection = useCallback(() => {
        if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
            disconnectLive();
        } else {
            connectLive();
        }
    }, [connectionState, connectLive, disconnectLive]);

    // --- Text-based translation (REST fallback when not in live mode) ---
    const translateText = useCallback(async (text: string) => {
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
        const tgtHint = getLanguageHint(targetLang);

        const prompt = `You are a professional translator.\n\n## CRITICAL RULE:\nYou MUST translate into ${tgtName} (${tgtHint}).\nDo NOT translate into English or any other language.\nThe output MUST be written entirely in ${tgtName}.\n\n## Task:\nTranslate the following text from ${srcName} into ${tgtName}.\n\n## Rules:\n- Output ONLY the translated text in ${tgtName}, nothing else.\n- Do NOT add any explanations, notes, or annotations.\n- Maintain the original tone and formality.\n\n## Text to translate:\n${text}`;

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

        // Auto TTS after text translation
        if (ttsModeRef.current !== 'off' && success) {
            handleTTS(entry, ttsModeRef.current);
        }
    }, [settings, sourceLang, targetLang, isTranslating, handleTTS]);

    // Send text through Live session
    const sendTextToLive = useCallback((text: string) => {
        if (!text.trim()) return;
        if (activeRef.current && sessionRef.current) {
            sessionRef.current.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: `請翻譯：${text}` }] }],
                turnComplete: true,
            });
            setInputText('');
        }
    }, []);

    const handleTextSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        if (isConnected) {
            sendTextToLive(inputText);
        } else {
            translateText(inputText);
        }
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

    const isConnected = connectionState === ConnectionState.CONNECTED;
    const isConnecting = connectionState === ConnectionState.CONNECTING;

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Background */}
            <div className="absolute inset-0 pointer-events-none z-0 opacity-30">
                <div className="absolute top-[-10%] left-[20%] w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-[100px]"></div>
            </div>

            {/* Header */}
            <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-zinc-800/50 z-10 bg-background/80 backdrop-blur-sm pl-14 md:pl-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-zinc-100">即時語音翻譯</h2>
                            <p className="text-[0.65rem] text-zinc-500">
                                {isConnected ? '🟢 即時翻譯中 — 請對著麥克風說話' :
                                 isConnecting ? '🟡 正在連線...' :
                                 '🎙️ Gemini AI 即時語音翻譯'}
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
                        {/* Voice Selection */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-400">🎙️ AI 語音角色</span>
                            <div className="flex gap-1 flex-wrap justify-end">
                                {GEMINI_VOICES.map(v => (
                                    <button
                                        key={v.name}
                                        onClick={() => setSelectedVoice(v.name)}
                                        className={`px-2 py-1 text-[0.6rem] rounded-lg border transition-all ${
                                            selectedVoice === v.name
                                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                                                : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                                        }`}
                                    >
                                        {v.label} ({v.gender})
                                    </button>
                                ))}
                            </div>
                        </div>
                        <p className="text-[0.6rem] text-zinc-600 pl-1">
                            ⚠️ 切換語音需重新連線才會生效（語音翻譯模式使用 AI 語音）
                        </p>

                        {/* TTS Mode (for text translation) */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-400">🔊 語音朗讀</span>
                                <span className="text-[0.6rem] text-zinc-600">(文字翻譯)</span>
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
                                {ttsMode === 'target' ? '📌 文字翻譯完成後自動朗讀目標語言' : '📌 文字翻譯完成後先朗讀原文，再朗讀譯文'}
                            </p>
                        )}
                    </div>
                )}

                {/* Language Selector */}
                <div className="flex items-center gap-2 justify-center">
                    <select
                        value={sourceLang}
                        onChange={(e) => {
                            if (isConnected) disconnectLive();
                            setSourceLang(e.target.value);
                        }}
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
                        onChange={(e) => {
                            if (isConnected) disconnectLive();
                            setTargetLang(e.target.value);
                        }}
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
                {history.length === 0 && !partialInput && !partialOutput ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
                        <svg className="w-16 h-16 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                        <p className="text-sm">點擊下方麥克風開始即時語音翻譯</p>
                        <p className="text-xs text-zinc-600">使用 Gemini AI 即時口譯，說話即翻譯</p>
                        <div className="flex flex-wrap gap-2 justify-center mt-2">
                            <span className="text-[0.65rem] bg-zinc-800/80 border border-zinc-700/50 px-2.5 py-1 rounded-full text-zinc-500">🎙️ 語音輸入</span>
                            <span className="text-[0.65rem] bg-zinc-800/80 border border-zinc-700/50 px-2.5 py-1 rounded-full text-zinc-500">🔊 AI 語音輸出</span>
                            <span className="text-[0.65rem] bg-zinc-800/80 border border-zinc-700/50 px-2.5 py-1 rounded-full text-zinc-500">📝 即時文字顯示</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {history.map((entry) => (
                            <div key={entry.id} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-sm animate-fade-in-up">
                                {/* Source */}
                                <div className="px-4 py-3 border-b border-zinc-800/50">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[0.65rem] font-medium text-zinc-500">{entry.sourceLang}</span>
                                        <div className="flex items-center gap-0.5">
                                            <button onClick={() => replayTTS(entry, 'source')} className="text-zinc-600 hover:text-zinc-300 transition-colors p-1" title="朗讀原文">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8.8l4.14-3.45a.75.75 0 011.36.45v12.4a.75.75 0 01-1.36.45L6.5 15.2H4a1 1 0 01-1-1v-4.4a1 1 0 011-1h2.5z" /></svg>
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
                                        <div className="flex items-center gap-0.5">
                                            <button onClick={() => replayTTS(entry, 'target')} className="text-zinc-600 hover:text-emerald-300 transition-colors p-1" title="朗讀翻譯">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8.8l4.14-3.45a.75.75 0 011.36.45v12.4a.75.75 0 01-1.36.45L6.5 15.2H4a1 1 0 01-1-1v-4.4a1 1 0 011-1h2.5z" /></svg>
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

                        {/* Partial Transcription (Real-time) */}
                        {(partialInput || partialOutput) && (
                            <div className="bg-zinc-900/60 border border-emerald-500/30 rounded-2xl overflow-hidden backdrop-blur-sm animate-fade-in-up shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                                {partialInput && (
                                    <div className="px-4 py-3 border-b border-zinc-800/50">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                                            <span className="text-[0.65rem] font-medium text-zinc-500">{getLanguageName(sourceLang)} (辨識中...)</span>
                                        </div>
                                        <p className="text-zinc-300 text-sm leading-relaxed italic">{partialInput}</p>
                                    </div>
                                )}
                                {partialOutput && (
                                    <div className="px-4 py-3 bg-emerald-500/5">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="flex gap-0.5">
                                                <div className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" style={{animationDelay: '0ms'}}></div>
                                                <div className="w-1 h-4 bg-emerald-400 rounded-full animate-pulse" style={{animationDelay: '150ms'}}></div>
                                                <div className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" style={{animationDelay: '300ms'}}></div>
                                            </div>
                                            <span className="text-[0.65rem] font-medium text-emerald-400">{getLanguageName(targetLang)} (翻譯中...)</span>
                                        </div>
                                        <p className="text-emerald-100 text-sm leading-relaxed font-medium italic">{partialOutput}</p>
                                    </div>
                                )}
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

            {/* Bottom Control Bar */}
            <form onSubmit={handleTextSubmit} className="shrink-0 px-4 sm:px-6 py-3 pb-8 md:py-3 border-t border-zinc-800/50 z-10 bg-background/80 backdrop-blur-sm">
                {/* Status Bar when connected */}
                {isConnected && (
                    <div className="mb-2 flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-1.5">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                            <span className="text-[0.65rem] text-emerald-300">即時語音翻譯中 · {getLanguageName(sourceLang)} → {getLanguageName(targetLang)}</span>
                        </div>
                        <button
                            type="button"
                            onClick={disconnectLive}
                            className="text-[0.65rem] text-zinc-400 hover:text-red-400 transition-colors px-2 py-0.5 rounded bg-zinc-800/50"
                        >
                            停止
                        </button>
                    </div>
                )}
                <div className="relative flex items-center">
                    {/* Mic / Live Toggle Button */}
                    <button
                        type="button"
                        onClick={toggleConnection}
                        disabled={isTranslating}
                        className={`absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all z-10 ${
                            isConnected
                                ? 'text-red-500 hover:bg-red-500/10 animate-pulse'
                                : isConnecting
                                    ? 'text-yellow-500 animate-pulse'
                                    : 'text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800'
                        }`}
                        title={isConnected ? '停止語音翻譯' : '開始語音翻譯'}
                    >
                        {isConnecting ? (
                            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : isConnected ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 2.34 9 4v6c0 1.66 1.34 3 3 3z" /><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        )}
                    </button>
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={isConnected ? '語音翻譯中，也可輸入文字...' : isConnecting ? '正在連線...' : '輸入文字翻譯，或按左側🎙️語音翻譯'}
                        disabled={isTranslating || isConnecting}
                        className={`w-full bg-zinc-900 border ${isConnected ? 'border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-zinc-700'} rounded-xl pl-12 pr-12 py-3 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-sm disabled:opacity-50 text-sm`}
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim() || isTranslating || isConnecting}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isTranslating ? (
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default TranslatorView;
