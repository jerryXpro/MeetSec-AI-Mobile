import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { useLive } from '../contexts/LiveContext';
import { useApp } from '../contexts/AppContext'; 
import { Message } from '../types';

// ============================================================================
// COMPONENT: Transcript Line
// ============================================================================
interface TranscriptLineProps {
    rawLine: string;
    onPlayAudio: (seconds: number) => void;
    onStopAudio: () => void;
    onRenameSpeaker: (oldName: string, newName: string) => void;
    onUpdateLine: (newLine: string) => void;
    contentTextSize: string;
    isPlaying: boolean;
}

const TranscriptLine: React.FC<TranscriptLineProps> = ({ 
    rawLine, 
    onPlayAudio, 
    onStopAudio,
    onRenameSpeaker, 
    onUpdateLine,
    contentTextSize,
    isPlaying
}) => {
    const [isEditingContent, setIsEditingContent] = useState(false);
    const [editContentValue, setEditContentValue] = useState(rawLine);

    const [isRenamingSpeaker, setIsRenamingSpeaker] = useState(false);
    const [renameSpeakerValue, setRenameSpeakerValue] = useState("");

    // Regex to parse: [00:12] Speaker: Content
    const parseRegex = /^(\[?\d{1,2}:\d{2}\]?)?\s*([^:：\n]+[:：])?\s*(.+)?$/;
    const match = rawLine.match(parseRegex);

    const timestampStr = match?.[1] || "";
    const speakerStr = match?.[2] || ""; 
    const contentStr = match?.[3] || "";
    
    // Remove colon for display/editing
    const speakerNameRaw = speakerStr.replace(/[:：]\s*$/, "").trim();

    useEffect(() => {
        if (isRenamingSpeaker) {
            setRenameSpeakerValue(speakerNameRaw);
        }
    }, [isRenamingSpeaker, speakerNameRaw]);

    const handleTimestampClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPlaying) {
            onStopAudio();
        } else if (timestampStr) {
            const cleanTs = timestampStr.replace(/[\[\]]/g, "");
            const timeParts = cleanTs.split(':');
            if (timeParts.length === 2) {
                const seconds = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
                onPlayAudio(seconds);
            }
        }
    };

    const handleContentSave = () => {
        setIsEditingContent(false);
        if (editContentValue.trim() !== rawLine) {
            onUpdateLine(editContentValue);
        }
    };

    const handleSpeakerRenameSave = () => {
        setIsRenamingSpeaker(false);
        const newName = renameSpeakerValue.trim();
        if (newName && newName !== speakerNameRaw) {
            onRenameSpeaker(speakerNameRaw, newName);
        }
    };

    if (isEditingContent) {
        return (
            <div className="py-1">
                <input 
                    type="text"
                    value={editContentValue}
                    onChange={(e) => setEditContentValue(e.target.value)}
                    onBlur={handleContentSave}
                    onKeyDown={(e) => e.key === 'Enter' && handleContentSave()}
                    autoFocus
                    className="w-full bg-zinc-900 border border-blue-500 rounded px-2 py-1 text-zinc-100 font-mono text-sm outline-none"
                />
            </div>
        );
    }

    return (
        <div className={`group/line flex items-baseline hover:bg-white/5 rounded px-1 -mx-1 py-0.5 transition-colors leading-relaxed ${contentTextSize} ${isPlaying ? 'bg-blue-500/10' : ''}`}>
            
            {/* 1. Timestamp Button (Toggle Play/Stop) */}
            {timestampStr && (
                <button 
                    onClick={handleTimestampClick}
                    className={`shrink-0 text-[0.8em] font-mono rounded px-1 mr-2 select-none cursor-pointer flex items-center gap-1 transition-colors ${isPlaying ? 'text-red-400 hover:text-red-300' : 'text-blue-400 hover:text-blue-300'}`}
                    title={isPlaying ? "停止播放" : "播放此段落"}
                >
                    {isPlaying ? (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg> // Stop Icon
                    ) : (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg> // Play Icon
                    )}
                    {timestampStr}
                </button>
            )}

            {/* 2. Speaker Label (Inline Rename) */}
            {speakerNameRaw && (
                isRenamingSpeaker ? (
                    <input 
                        type="text"
                        value={renameSpeakerValue}
                        onChange={(e) => setRenameSpeakerValue(e.target.value)}
                        onBlur={handleSpeakerRenameSave}
                        onKeyDown={(e) => e.key === 'Enter' && handleSpeakerRenameSave()}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        className="shrink-0 font-bold text-amber-500 mr-2 bg-zinc-900 border border-amber-500/50 rounded px-1 py-0 text-sm outline-none w-24"
                    />
                ) : (
                    <span 
                        className="shrink-0 font-bold text-amber-500 mr-2 cursor-pointer hover:bg-amber-500/20 px-1 rounded transition-colors select-none"
                        onClick={(e) => { e.stopPropagation(); setIsRenamingSpeaker(true); }}
                        title={`點擊修改 "${speakerNameRaw}" (將同步更新所有相同名稱)`}
                    >
                        {speakerNameRaw}:
                    </span>
                )
            )}

            {/* 3. Content Text (Editable) */}
            <span 
                className="flex-1 cursor-text hover:text-white/90"
                onClick={() => setIsEditingContent(true)}
                title="點擊修改此行文字"
            >
                {contentStr || (speakerNameRaw ? "" : rawLine.replace(/^\[?\d{1,2}:\d{2}\]?\s*/, ""))} 
            </span>
        </div>
    );
};


// ============================================================================
// COMPONENT: Message Bubble
// ============================================================================
const MessageBubble: React.FC<{ msg: Message }> = ({ msg }) => {
    const { updateMessage, renameSpeaker } = useLive();
    const { settings } = useApp(); 
    
    const [isEditingHeaderName, setIsEditingHeaderName] = useState(false);
    const [headerNameInput, setHeaderNameInput] = useState(msg.speaker || (msg.role === 'user' ? 'User / Audio' : 'AI'));

    // Audio Playback
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const contentTextSize = {
        sm: 'text-sm',
        md: 'text-base',
        lg: 'text-lg',
        xl: 'text-xl'
    }[settings.contentFontSize] || 'text-base';

    const performRename = (oldName: string, newName: string) => {
        renameSpeaker(oldName, newName);
    };

    const handleHeaderRenameSave = () => {
        setIsEditingHeaderName(false);
        const currentName = msg.speaker || (msg.role === 'user' ? 'User / Audio' : 'AI');
        const newName = headerNameInput.trim();
        
        if (newName && newName !== currentName) {
            // Header rename also treats as batch rename for consistency
            renameSpeaker(currentName, newName);
        }
    };

    const togglePlayback = () => {
        if (!audioRef.current && msg.audioUrl) {
            audioRef.current = new Audio(msg.audioUrl);
            audioRef.current.onended = () => setIsPlaying(false);
        }
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                audioRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const stopPlayback = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            // If audioRef isn't attached yet (e.g. rich transcript player), find it by ID
            const audioEl = document.getElementById(`audio-${msg.id}`) as HTMLAudioElement;
            if (audioEl) {
                audioEl.pause();
                // Since HTMLAudioElement controls its own state visually, we mostly update React state here
            }
        }
    };

    const seekAudio = (seconds: number) => {
        const audioEl = document.getElementById(`audio-${msg.id}`) as HTMLAudioElement;
        if (audioEl) {
            audioEl.currentTime = seconds;
            audioEl.play().catch(console.error);
        } else if (msg.audioUrl) {
            if(!audioRef.current) audioRef.current = new Audio(msg.audioUrl);
            audioRef.current.currentTime = seconds;
            audioRef.current.play();
            setIsPlaying(true);
        }
    };

    const handleLineUpdate = (index: number, newLine: string) => {
        const lines = msg.text.split('\n');
        lines[index] = newLine;
        const newText = lines.join('\n');
        updateMessage(msg.id, { text: newText });
    };

    const isRichTranscript = !!msg.audioUrl && !msg.isPartial && msg.text.length >= 50;

    return (
        <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div 
            className={`max-w-[95%] lg:max-w-[85%] rounded-2xl px-4 py-3 shadow-sm transition-all duration-300 ${
              msg.role === 'user' 
                ? 'bg-blue-600/20 border border-blue-500/30 text-blue-100 rounded-br-none' 
                : msg.role === 'system'
                ? 'bg-zinc-800 border border-zinc-600 text-zinc-300 w-full max-w-full text-center italic'
                : 'bg-zinc-800/80 border border-zinc-700 text-zinc-200 rounded-bl-none'
            } ${msg.isPartial ? 'animate-pulse opacity-80' : ''} ${isPlaying ? 'ring-2 ring-green-500/50 bg-green-500/10' : ''}`}
          >
            {msg.role !== 'system' && (
              <div className="flex flex-col gap-2 mb-2">
                  
                  {/* Rich Audio Player (Sticky Header) */}
                  {isRichTranscript && (
                      <div className="sticky top-0 z-40 w-[calc(100%+2rem)] -mx-4 px-4 py-2 bg-zinc-800 border-b border-zinc-700 mb-4 shadow-lg -mt-3 rounded-t-xl">
                          <div className="flex items-center gap-2 mb-2 text-[10px] text-zinc-400 uppercase tracking-wider justify-between">
                              <div className="flex items-center gap-2">
                                <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                原始音檔 (點擊時間戳記可跳轉/停止)
                              </div>
                              <span className="text-[10px] text-zinc-500">
                                提示: 點擊文字/名稱可直接修改
                              </span>
                          </div>
                          <audio 
                             id={`audio-${msg.id}`}
                             controls 
                             src={msg.audioUrl} 
                             className="w-full h-8 block custom-audio-player"
                             controlsList="nodownload" 
                             onPlay={() => setIsPlaying(true)}
                             onPause={() => setIsPlaying(false)}
                             onEnded={() => setIsPlaying(false)}
                          />
                      </div>
                  )}

                  {/* Header Row */}
                  <div className="flex items-center gap-2 group/header flex-wrap">
                    {isEditingHeaderName ? (
                        <input 
                            type="text"
                            value={headerNameInput}
                            onChange={(e) => setHeaderNameInput(e.target.value)}
                            onBlur={handleHeaderRenameSave}
                            onKeyDown={(e) => e.key === 'Enter' && handleHeaderRenameSave()}
                            autoFocus
                            className="bg-zinc-900 border border-zinc-600 rounded px-1 py-0.5 text-xs text-white focus:outline-none focus:border-blue-500 w-32"
                        />
                    ) : (
                        <div 
                            onClick={() => setIsEditingHeaderName(true)}
                            className={`flex items-center gap-2 cursor-pointer hover:bg-white/5 rounded px-1 -ml-1 transition-colors ${
                                msg.role === 'user' ? 'text-blue-400' : 'text-purple-400'
                            }`}
                            title="修改發言者"
                        >
                            <span className="text-xs font-bold uppercase tracking-wider">
                                {msg.speaker || (msg.role === 'user' ? 'User / Audio' : 'AI')}
                            </span>
                        </div>
                    )}
                    
                    <span className="text-[10px] text-zinc-500 select-none">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {/* Small Playback for normal messages */}
                    {msg.audioUrl && !msg.isPartial && !isRichTranscript && (
                        <button 
                            onClick={togglePlayback}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all border ${
                                isPlaying 
                                ? 'bg-green-500/20 text-green-300 border-green-500/50 hover:bg-green-500/30' 
                                : 'bg-zinc-700/30 text-zinc-400 border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200'
                            }`}
                        >
                            {isPlaying ? (
                                <span className="flex items-center gap-1">
                                    <span className="animate-pulse bg-green-500 w-1.5 h-1.5 rounded-full"></span> 停止
                                </span>
                            ) : (
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            )}
                        </button>
                    )}
                  </div>
              </div>
            )}
            
            <div className={`relative ${contentTextSize}`}>
                {isRichTranscript ? (
                    <div className="flex flex-col gap-0.5">
                        {msg.text.split('\n').map((line, i) => (
                            <TranscriptLine 
                                key={i}
                                rawLine={line}
                                onPlayAudio={seekAudio}
                                onStopAudio={stopPlayback}
                                onRenameSpeaker={performRename}
                                onUpdateLine={(newLine) => handleLineUpdate(i, newLine)}
                                contentTextSize={contentTextSize}
                                isPlaying={isPlaying}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="whitespace-pre-wrap leading-relaxed">
                        {msg.text}
                    </div>
                )}
            </div>
          </div>
        </div>
    );
}

const Transcript: React.FC = () => {
  const { messages } = useLive();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setShouldAutoScroll(isAtBottom);
  };

  useLayoutEffect(() => {
    if (shouldAutoScroll && bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [messages, shouldAutoScroll]);

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 space-y-4 relative custom-scrollbar h-full"
    >
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-zinc-500 opacity-50">
          <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <p>開始對話或上傳音檔...</p>
        </div>
      )}
      
      {messages.map((msg) => (
         <MessageBubble key={msg.id} msg={msg} />
      ))}
      <div ref={bottomRef} />
      
      {!shouldAutoScroll && messages.length > 0 && (
        <button 
          onClick={() => {
            setShouldAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="sticky bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white rounded-full p-2 shadow-lg hover:bg-blue-500 transition-all animate-bounce z-10"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
        </button>
      )}
    </div>
  );
};

export default Transcript;