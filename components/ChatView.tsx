import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { GoogleGenAI } from '@google/genai';

interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    text: string;
    timestamp: number;
}

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

## 回答風格：
- 簡潔有力，不要長篇大論（除非對方要求詳細解釋）
- 適當使用「我覺得」「我認為」表達觀點
- 偶爾關心對方的狀態：「你今天還好嗎？」「記得休息喔～」`;

const ChatView: React.FC = () => {
    const { settings } = useApp();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const sendMessage = async (text: string) => {
        if (!text.trim() || isThinking) return;

        const keys = settings.apiKeys.gemini?.split(',').map(k => k.trim()).filter(Boolean) || [];
        if (keys.length === 0) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'ai',
                text: '親愛的，要先到系統設定中填入 Gemini API Key 才能跟我聊天喔 💜',
                timestamp: Date.now()
            }]);
            return;
        }

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: text.trim(),
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsThinking(true);

        // Build conversation history for context
        const history = [...messages, userMsg].slice(-20).map(m => ({
            role: m.role === 'user' ? 'user' as const : 'model' as const,
            parts: [{ text: m.text }]
        }));

        let reply = '';
        for (const key of keys) {
            try {
                const ai = new GoogleGenAI({ apiKey: key });
                const response = await ai.models.generateContent({
                    model: settings.geminiAnalysisModel || 'gemini-2.5-flash',
                    contents: [
                        { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
                        { role: 'model', parts: [{ text: '好的，我是小家人 💜 隨時都在你身邊～有什麼想聊的嗎？' }] },
                        ...history
                    ],
                });
                reply = response.text?.trim() || '抱歉，我剛剛走神了...再說一次好嗎？ 😅';
                break;
            } catch (err: any) {
                if (err.message?.includes('429') || err.message?.includes('quota')) continue;
                reply = `哎呀，出了點小問題：${err.message} 😢`;
                break;
            }
        }

        if (!reply) reply = '所有的鑰匙都用完了...請到設定中新增 API Key 💔';

        setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'ai',
            text: reply,
            timestamp: Date.now()
        }]);
        setIsThinking(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    const formatTime = (ts: number) => {
        return new Date(ts).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
            {/* Background */}
            <div className="absolute inset-0 pointer-events-none z-0 opacity-30">
                <div className="absolute top-[-10%] left-[30%] w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-pink-600/10 rounded-full blur-[100px]"></div>
            </div>

            {/* Header */}
            <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-zinc-800/50 z-10 bg-background/80 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 text-lg">
                            🏠
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-zinc-100">小家人</h2>
                            <p className="text-[0.65rem] text-zinc-500 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>
                                隨時都在你身邊 💜
                            </p>
                        </div>
                    </div>
                    {messages.length > 0 && (
                        <button
                            onClick={() => setMessages([])}
                            className="px-2.5 py-1.5 text-[0.65rem] bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
                            title="開啟新對話"
                        >
                            🔄 新對話
                        </button>
                    )}
                </div>
            </div>

            {/* Chat Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 custom-scrollbar z-10">
                {messages.length === 0 && !isThinking ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center text-4xl">
                            🏠
                        </div>
                        <div className="text-center">
                            <p className="text-zinc-300 text-sm font-medium mb-1">嗨～我是你的小家人 💜</p>
                            <p className="text-zinc-500 text-xs">有什麼想聊的嗎？不管開心還是難過，我都在</p>
                        </div>
                        {/* Quick starters */}
                        <div className="flex flex-wrap justify-center gap-2 mt-2 max-w-sm">
                            {[
                                '今天過得好嗎？',
                                '心情有點低落...',
                                '幫我查個資料',
                                '想聊聊天 ☺️',
                            ].map(q => (
                                <button
                                    key={q}
                                    onClick={() => sendMessage(q)}
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
                                }`}>
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                    <p className={`text-[0.55rem] mt-1 ${msg.role === 'user' ? 'text-purple-400/60 text-right' : 'text-zinc-600'}`}>
                                        {formatTime(msg.timestamp)}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {isThinking && (
                            <div className="flex justify-start animate-fade-in-up">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs shrink-0 mr-2 mt-1 shadow-md">
                                    🏠
                                </div>
                                <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl rounded-bl-md px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="shrink-0 px-4 sm:px-6 py-3 border-t border-zinc-800/50 z-10 bg-background/80 backdrop-blur-sm">
                <div className="relative flex items-center">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="跟小家人說說話..."
                        disabled={isThinking}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all shadow-sm disabled:opacity-50 text-sm placeholder:text-zinc-600"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isThinking}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ChatView;
