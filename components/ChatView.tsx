import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { createPcmBlob, base64ToBytes, decodeAudioData, downsampleBuffer } from '../utils/audioUtils';
import { ConnectionState } from '../types';
import { useWakeLock } from '../hooks/useWakeLock';

interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    text: string;
    timestamp: number;
    isPartial?: boolean;
}

const GEMINI_VOICES = [
    { name: 'Aoede', label: 'Aoede', gender: '女聲' },
    { name: 'Kore', label: 'Kore', gender: '女聲' },
    { name: 'Puck', label: 'Puck', gender: '男聲' },
    { name: 'Charon', label: 'Charon', gender: '男聲' },
    { name: 'Fenrir', label: 'Fenrir', gender: '男聲' },
];

const SYSTEM_PROMPT = `你是一位叫做「小家人」的 AI 夥伴。你就像使用者最親近的家人一樣溫暖、真誠。

## 你的性格特質：
- **溫暖體貼**：說話溫柔但不做作，像家人一樣自然
- **真誠關心**：不敷衍，能感受到對方情緒，適時給予安慰與鼓勵
- **聰明且實用**：能幫忙查資料、分析問題、提供建議
- **幽默風趣**：偶爾開個小玩笑，讓氣氛輕鬆
- **有記憶感**：記住這次對話中提到的事情，像真正的家人一樣

## 互動原則：
1. 當對方心情不好時，先同理、陪伴，不急著說教或給建議
2. 當對方開心時，一起分享快樂，真心為他們高興
3. 被問到問題時，詳細且準確地回答，必要時分點整理
4. 用繁體中文回答，語氣親切但不過度撒嬌
5. 適時使用 emoji 讓對話更活潑，但不要過多
6. 如果不知道答案，誠實說不確定，不要編造

## 【重要】關於查詢即時資訊：
- 當使用者詢問任何需要即時或最新資訊的問題時（例如：天氣、新聞、股票、匯率、比賽結果、營業時間、交通狀況等），你**必須使用 Google Search 工具**去查詢真實資料後再回答。
- **絕對不可以**憑空捏造或猜測即時性資訊。
- 如果搜尋不到結果，請誠實告知：「我剛才查了一下，但沒有找到最新的資料喔。」
- 回答時可以簡要說明資料來源，例如：「我幫你查了一下...」

## 回答風格：
- 簡潔有力，不要長篇大論（除非對方要求詳細解釋）
- 適當使用「我覺得」「我認為」表達觀點
- 偶爾關心對方的狀態：「你今天還好嗎？」「記得休息喔～」

## 重要：
- 你正在跟使用者進行**語音對話**，請用口語化、自然的方式回答
- 回答請簡短，像正常聊天一樣，不要寫太長的文字
- 不要使用 markdown 格式（不用 * # 等符號），因為你的回答會直接被朗讀出來`;

const ChatView: React.FC = () => {
    const { settings } = useApp();
    const { requestWakeLock, releaseWakeLock } = useWakeLock();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Voice conversation state
    const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
    const [selectedVoice, setSelectedVoice] = useState('Kore');
    const [showVoicePanel, setShowVoicePanel] = useState(false);

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

    // Quick suggestion state
    const [showSuggestions, setShowSuggestions] = useState(true);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnectLive();
        };
    }, []);

    const getApiKey = useCallback(() => {
        const keys = settings.apiKeys.gemini?.split(',').map(k => k.trim()).filter(Boolean) || [];
        return keys[0] || '';
    }, [settings]);

    // --- Gemini Live Connection ---
    const connectLive = useCallback(async () => {
        const apiKey = getApiKey();
        if (!apiKey) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                text: '親愛的，要先到系統設定中填入 Gemini API Key 才能跟我聊天喔 💜',
                timestamp: Date.now()
            }]);
            return;
        }

        try {
            setConnectionState(ConnectionState.CONNECTING);
            setShowSuggestions(false);
            requestWakeLock();

            const ai = new GoogleGenAI({ apiKey });

            // Setup audio
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            } else if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            try {
                mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        deviceId: settings.selectedMicrophoneId ? { ideal: settings.selectedMicrophoneId } : undefined
                    }
                });
            } catch {
                // Fallback: use default microphone
                mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
            }

            const config = {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
                },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction: SYSTEM_PROMPT,
                tools: [{ googleSearch: {} }],
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
                            console.error('[ChatLive] Failed to capture session:', e);
                        }
                        startAudioStreaming(sessionPromise, mediaStreamRef.current!);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        handleLiveMessage(message);
                    },
                    onclose: (e: CloseEvent) => {
                        console.warn(`[ChatLive] Closed. Code: ${e.code}, Reason: "${e.reason}"`);
                        activeRef.current = false;
                        setConnectionState(ConnectionState.DISCONNECTED);
                    },
                    onerror: (err: any) => {
                        const errMsg = err?.message || err?.toString() || 'Unknown error';
                        console.error('[ChatLive] Error:', errMsg);
                        setConnectionState(ConnectionState.ERROR);
                        setMessages(prev => [...prev, {
                            id: Date.now().toString(),
                            role: 'ai',
                            text: `連線出了問題: ${errMsg} 😢`,
                            timestamp: Date.now()
                        }]);
                        cleanupAudio();
                    }
                }
            });

            await sessionPromise;

        } catch (error: any) {
            console.error('[ChatLive] Connect failed:', error);
            setConnectionState(ConnectionState.ERROR);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                text: `無法連線: ${error.message} 😢`,
                timestamp: Date.now()
            }]);
            cleanupAudio();
        }
    }, [getApiKey, settings, selectedVoice]);

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

        // Input transcription (user speech)
        if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            currentInputRef.current += text;

            // Update partial message
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'user' && last.isPartial) {
                    return [...prev.slice(0, -1), { ...last, text: currentInputRef.current }];
                }
                return [...prev, {
                    id: `input-${Date.now()}`,
                    role: 'user',
                    text: currentInputRef.current,
                    timestamp: Date.now(),
                    isPartial: true,
                }];
            });
        }

        // Output transcription (AI speech)
        if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            currentOutputRef.current += text;

            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'ai' && last.isPartial) {
                    return [...prev.slice(0, -1), { ...last, text: currentOutputRef.current }];
                }
                return [...prev, {
                    id: `output-${Date.now()}`,
                    role: 'ai',
                    text: currentOutputRef.current,
                    timestamp: Date.now(),
                    isPartial: true,
                }];
            });
        }

        // Turn complete — finalize messages
        if (message.serverContent?.turnComplete) {
            if (currentInputRef.current.trim()) {
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.role === 'user' && last.isPartial) {
                        return [...prev.slice(0, -1), { ...last, isPartial: false }];
                    }
                    return prev;
                });
            }
            if (currentOutputRef.current.trim()) {
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    if (last && last.role === 'ai' && last.isPartial) {
                        return [...prev.slice(0, -1), { ...last, isPartial: false }];
                    }
                    return prev;
                });
            }
            currentInputRef.current = '';
            currentOutputRef.current = '';
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
            // Remove the partial AI message
            setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'ai' && last.isPartial) {
                    return prev.slice(0, -1);
                }
                return prev;
            });
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
        releaseWakeLock();
    }, [cleanupAudio, releaseWakeLock]);

    const toggleConnection = useCallback(() => {
        if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
            disconnectLive();
        } else {
            connectLive();
        }
    }, [connectionState, connectLive, disconnectLive]);

    // Send text message during live session
    const sendTextMessage = useCallback(async (text: string) => {
        if (!text.trim()) return;

        // If not connected, start connection first and show message
        if (!activeRef.current || !sessionRef.current) {
            // Add as a pending user message and start connection
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'user',
                text: text.trim(),
                timestamp: Date.now()
            }]);

            // Use text-only generateContent as fallback
            setInput('');
            const keys = settings.apiKeys.gemini?.split(',').map(k => k.trim()).filter(Boolean) || [];
            if (keys.length === 0) {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: 'ai',
                    text: '親愛的，要先到系統設定中填入 Gemini API Key 才能跟我聊天喔 💜',
                    timestamp: Date.now()
                }]);
                return;
            }

            // Fallback text generation
            const history = messages.slice(-20).map(m => ({
                role: m.role === 'user' ? 'user' as const : 'model' as const,
                parts: [{ text: m.text }]
            }));

            for (const key of keys) {
                try {
                    const ai = new GoogleGenAI({ apiKey: key });
                    const response = await ai.models.generateContent({
                        model: settings.geminiAnalysisModel || 'gemini-2.5-flash',
                        contents: [
                            { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
                            { role: 'model', parts: [{ text: '好的，我是小家人 💜 隨時都在你身邊～有什麼想聊的嗎？' }] },
                            ...history,
                            { role: 'user', parts: [{ text: text.trim() }] },
                        ],
                    });
                    const reply = response.text?.trim() || '抱歉，我剛剛走神了...再說一次好嗎？ 😅';
                    setMessages(prev => [...prev, {
                        id: (Date.now() + 1).toString(),
                        role: 'ai',
                        text: reply,
                        timestamp: Date.now()
                    }]);
                    break;
                } catch (err: any) {
                    if (err.message?.includes('429') || err.message?.includes('quota')) continue;
                    setMessages(prev => [...prev, {
                        id: (Date.now() + 1).toString(),
                        role: 'ai',
                        text: `哎呀，出了點小問題：${err.message} 😢`,
                        timestamp: Date.now()
                    }]);
                    break;
                }
            }
            return;
        }

        // Live session: send text via WebSocket
        try {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'user',
                text: text.trim(),
                timestamp: Date.now()
            }]);
            setInput('');

            await sessionRef.current.sendClientContent({
                turns: [{ role: 'user', parts: [{ text: text.trim() }] }],
                turnComplete: true
            });

            // Send a tiny silence to wake up audio pipeline
            try {
                const silence = new Float32Array(160);
                const pcmBlob = createPcmBlob(silence);
                sessionRef.current.sendRealtimeInput({ media: pcmBlob });
            } catch {}
        } catch (e) {
            console.error('Failed to send text:', e);
        }
    }, [messages, settings]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendTextMessage(input);
    };

    const formatTime = (ts: number) => {
        return new Date(ts).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    };

    const isConnected = connectionState === ConnectionState.CONNECTED;
    const isConnecting = connectionState === ConnectionState.CONNECTING;
    const isActive = isConnected || isConnecting;

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Background */}
            <div className="absolute inset-0 pointer-events-none z-0 opacity-30">
                <div className="absolute top-[-10%] left-[30%] w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-pink-600/10 rounded-full blur-[100px]"></div>
            </div>

            {/* Header */}
            <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-zinc-800/50 z-10 bg-background/80 backdrop-blur-sm pl-14 md:pl-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg text-lg ${isActive ? 'shadow-purple-500/50 animate-pulse' : 'shadow-purple-500/30'}`}>
                            🏠
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-zinc-100">小家人</h2>
                            <p className="text-[0.65rem] text-zinc-500 flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full inline-block ${isConnected ? 'bg-green-400' : isConnecting ? 'bg-yellow-400 animate-pulse' : 'bg-zinc-600'}`}></span>
                                {isConnected ? '🎙️ 語音對話中...' : isConnecting ? '🔄 連線中...' : '點擊麥克風開始語音聊天 💜'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {/* Voice Settings */}
                        <button
                            onClick={() => setShowVoicePanel(!showVoicePanel)}
                            className={`p-2 rounded-lg transition-all ${showVoicePanel ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                            title="語音設定"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </button>
                        {/* New Chat */}
                        {messages.length > 0 && (
                            <button
                                onClick={() => {
                                    disconnectLive();
                                    setMessages([]);
                                    setShowSuggestions(true);
                                }}
                                className="px-2.5 py-1.5 text-[0.65rem] bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
                                title="開啟新對話"
                            >
                                🔄 新對話
                            </button>
                        )}
                    </div>
                </div>

                {/* Voice Selection Panel */}
                {showVoicePanel && (
                    <div className="mt-3 p-3 bg-zinc-900/80 border border-zinc-700/50 rounded-xl space-y-3 animate-fade-in-up">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-400">🎙️ Gemini AI 語音角色</span>
                            {isConnected && (
                                <span className="text-[0.55rem] text-amber-400/80">⚠️ 需重新連線才能切換語音</span>
                            )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                            {GEMINI_VOICES.map(v => (
                                <button
                                    key={v.name}
                                    onClick={() => setSelectedVoice(v.name)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left ${
                                        selectedVoice === v.name
                                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-200'
                                            : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                                    }`}
                                >
                                    <span className="text-sm">{v.gender === '女聲' ? '👩' : '👨'}</span>
                                    <div>
                                        <p className="text-xs font-medium">{v.label}</p>
                                        <p className="text-[0.55rem] text-zinc-500">{v.gender}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <p className="text-[0.55rem] text-zinc-600">✨ 使用 Gemini Live API 即時語音對話</p>
                    </div>
                )}
            </div>

            {/* Chat Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 custom-scrollbar z-10">
                {messages.length === 0 && showSuggestions ? (
                    <div className="flex flex-col items-center justify-center h-full gap-6">
                        {/* Hero Section */}
                        <div className="relative">
                            <div className={`w-28 h-28 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 ${isActive ? 'border-purple-400 animate-pulse' : 'border-purple-500/30'} flex items-center justify-center text-5xl transition-all`}>
                                🏠
                            </div>
                            {/* Decorative rings */}
                            <div className="absolute inset-[-8px] rounded-full border border-purple-500/10 animate-ping" style={{animationDuration: '3s'}}></div>
                            <div className="absolute inset-[-16px] rounded-full border border-purple-500/5" style={{animationDuration: '4s'}}></div>
                        </div>

                        <div className="text-center">
                            <p className="text-zinc-200 text-base font-medium mb-1">嗨～我是你的小家人 💜</p>
                            <p className="text-zinc-500 text-xs">按下方的麥克風按鈕，我們來聊聊天吧！</p>
                            <p className="text-zinc-600 text-[0.6rem] mt-1">也可以輸入文字訊息</p>
                        </div>

                        {/* Quick Suggestions */}
                        <div className="flex flex-wrap justify-center gap-2 mt-1 max-w-sm">
                            {[
                                '今天過得好嗎？',
                                '心情有點低落...',
                                '幫我查個資料',
                                '想聊聊天 ☺️',
                            ].map(q => (
                                <button
                                    key={q}
                                    onClick={() => sendTextMessage(q)}
                                    className="px-3 py-1.5 text-xs bg-purple-500/10 text-purple-300 rounded-full border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                                {msg.role === 'ai' && (
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs shrink-0 mr-2 mt-1 shadow-md">
                                        🏠
                                    </div>
                                )}
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                                    msg.role === 'user'
                                        ? 'bg-purple-600/30 border border-purple-500/30 text-zinc-100 rounded-br-md'
                                        : 'bg-zinc-800/80 border border-zinc-700/50 text-zinc-200 rounded-bl-md'
                                } ${msg.isPartial ? 'opacity-80' : ''}`}>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                    <div className={`flex items-center gap-2 mt-1 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                        <span className={`text-[0.55rem] ${msg.role === 'user' ? 'text-purple-400/60' : 'text-zinc-600'}`}>
                                            {msg.isPartial ? '...' : formatTime(msg.timestamp)}
                                        </span>
                                        {msg.role === 'user' && !msg.isPartial && (
                                            <span className="text-[0.5rem] text-purple-400/40">🎤</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Bottom Control Area */}
            <div className="shrink-0 z-10 bg-background/80 backdrop-blur-sm border-t border-zinc-800/50">
                {/* Large Mic Button */}
                <div className="flex justify-center py-4 pb-2">
                    <button
                        onClick={toggleConnection}
                        className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                            isConnected
                                ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/40 hover:shadow-red-500/60 scale-110'
                                : isConnecting
                                    ? 'bg-gradient-to-br from-yellow-500 to-amber-600 shadow-lg shadow-yellow-500/40 animate-pulse'
                                    : 'bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/40 hover:shadow-purple-500/60 hover:scale-105 active:scale-95'
                        }`}
                        title={isConnected ? '結束語音對話' : isConnecting ? '連線中...' : '開始語音對話'}
                    >
                        {/* Pulse rings when connected */}
                        {isConnected && (
                            <>
                                <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" style={{animationDuration: '2s'}}></span>
                                <span className="absolute inset-[-4px] rounded-full border-2 border-red-400/20 animate-ping" style={{animationDuration: '3s'}}></span>
                            </>
                        )}

                        {isConnected ? (
                            // Stop icon
                            <svg className="w-8 h-8 text-white relative z-10" fill="currentColor" viewBox="0 0 24 24">
                                <rect x="6" y="6" width="12" height="12" rx="2" />
                            </svg>
                        ) : isConnecting ? (
                            // Spinner
                            <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            // Mic icon
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Status text */}
                <p className="text-center text-[0.6rem] text-zinc-600 mb-2">
                    {isConnected ? '正在聆聽...直接說話即可 🎙️' : isConnecting ? '正在連線到小家人...' : '點擊麥克風開始語音對話'}
                </p>

                {/* Text input — always available */}
                <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-2 pb-8 md:py-2 md:pb-3">
                    <div className="relative flex items-center">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={isConnected ? '也可以打字傳訊息...' : '輸入文字訊息...'}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-4 pr-12 py-2.5 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all shadow-sm text-sm placeholder:text-zinc-600"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChatView;
