import React, { createContext, useContext, useState, useRef, ReactNode, useEffect } from 'react';
import { ConnectionState, Message } from '../types';
import { GeminiLiveService } from '../services/geminiLive.ts';
import { transcribeAudioFile } from '../services/fileUploadService';
import { useApp } from './AppContext';

export interface TemporaryFile {
  id: string;
  name: string;
  content: string;
}

interface LiveContextType {
  isConnected: boolean;
  isConnecting: boolean;
  connectionState: ConnectionState;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  renameSpeaker: (oldName: string, newName: string) => void;
  volume: number;
  connect: (useSystemAudio?: boolean) => Promise<void>;
  disconnect: () => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  isProcessingFile: boolean;
  error: string | null;
  sessionDuration: number;
  meetingTitle: string;
  setMeetingTitle: (title: string) => void;

  // Updated Context File Management
  temporaryFiles: TemporaryFile[];
  addTemporaryFile: (name: string, content: string) => void;
  removeTemporaryFile: (id: string) => void;
  clearTemporaryFiles: () => void;

  isMuted: boolean;
  toggleMute: () => void;
  isAiMuted: boolean;
  toggleAiMute: () => void;
  fullAudioUrl: string | null;
  resetSession: () => void;
}

const LiveContext = createContext<LiveContextType | undefined>(undefined);

export const LiveProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { settings, saveMeeting, profiles } = useApp();
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [messages, setMessages] = useState<Message[]>([]);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);

  const [isMuted, setIsMuted] = useState(false);
  const [isAiMuted, setIsAiMuted] = useState(false);

  const [meetingTitle, setMeetingTitle] = useState("");
  const meetingTitleRef = useRef("");

  // Replaced single context file with array
  const [temporaryFiles, setTemporaryFiles] = useState<TemporaryFile[]>([]);

  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fullAudioUrl, setFullAudioUrl] = useState<string | null>(null);

  const speakerMapRef = useRef<Record<string, string>>({});

  const serviceRef = useRef<GeminiLiveService | null>(null);
  const durationInterval = useRef<number | null>(null);

  useEffect(() => {
    serviceRef.current = new GeminiLiveService();
    return () => {
      serviceRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    meetingTitleRef.current = meetingTitle;
  }, [meetingTitle]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVolume(prev => Math.max(0, prev * 0.9));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (connectionState === ConnectionState.CONNECTED && sessionStartTime) {
      durationInterval.current = window.setInterval(() => {
        setSessionDuration(Math.floor((Date.now() - sessionStartTime) / 1000));
      }, 1000);
    } else {
      if (durationInterval.current) clearInterval(durationInterval.current);
    }
    return () => { if (durationInterval.current) clearInterval(durationInterval.current); }
  }, [connectionState, sessionStartTime]);

  const updateMessage = (id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, ...updates } : msg));
  };

  const renameSpeaker = (oldName: string, newName: string) => {
    if (!oldName.trim() || !newName.trim()) return;

    speakerMapRef.current[oldName] = newName;

    setMessages(prev => prev.map(msg => {
      let updated = { ...msg };
      let hasChange = false;

      const currentSpeaker = msg.speaker || (msg.role === 'model' ? 'AI' : (msg.role === 'user' ? 'User / Audio' : 'System'));

      if (msg.speaker === oldName) {
        updated.speaker = newName;
        hasChange = true;
      } else if (!msg.speaker && currentSpeaker === oldName) {
        updated.speaker = newName;
        hasChange = true;
      }

      const escapedOld = oldName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(^|\\n)(\\s*(?:\\[[\\d:]+\\])?\\s*)${escapedOld}(\\s*[:：])`, 'gm');

      if (regex.test(updated.text)) {
        updated.text = updated.text.replace(regex, `$1$2${newName}$3`);
        hasChange = true;
      }

      return hasChange ? updated : msg;
    }));
  };

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    serviceRef.current?.setMute(newState);
  };

  const toggleAiMute = () => {
    const newState = !isAiMuted;
    setIsAiMuted(newState);
    serviceRef.current?.setAiMute(newState);
  };

  const addTemporaryFile = (name: string, content: string) => {
    if (temporaryFiles.length >= 3) return;
    setTemporaryFiles(prev => [...prev, { id: Date.now().toString(), name, content }]);
  };

  const removeTemporaryFile = (id: string) => {
    setTemporaryFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearTemporaryFiles = () => {
    setTemporaryFiles([]);
  };

  const connect = async (useSystemAudio = false) => {
    if (!settings.apiKeys.gemini) {
      setError("請先至設定頁面輸入 Gemini API Key");
      return;
    }
    setError(null);
    setMessages([]);
    setSessionStartTime(Date.now());
    setSessionDuration(0);
    setIsMuted(false);
    speakerMapRef.current = {};

    if (fullAudioUrl) {
      URL.revokeObjectURL(fullAudioUrl);
      setFullAudioUrl(null);
    }

    const activeProfile = profiles.find(p => p.id === settings.currentProfileId);

    let aggregatedContext = "";
    if (activeProfile) {
      aggregatedContext += `【當前知識庫設定 (Profile): ${activeProfile.name}】\n${activeProfile.description}\n\n`;
      if (activeProfile.documents.length > 0) {
        aggregatedContext += `【知識庫文件內容】\n請參考以下文件作為背景知識：\n\n`;
        activeProfile.documents.forEach((doc, idx) => {
          aggregatedContext += `--- 文件 ${idx + 1}: ${doc.name} Start ---\n${doc.content}\n--- 文件 ${idx + 1} End ---\n\n`;
        });
      }
    }

    // Append Temporary Files
    if (temporaryFiles.length > 0) {
      aggregatedContext += `\n【本次會議補充文件 (Temporary Context)】\n`;
      temporaryFiles.forEach((file, idx) => {
        aggregatedContext += `\n>>> 補充文件 ${idx + 1}: ${file.name} <<<\n${file.content}\n-----------------------------------\n`;
      });
    }

    await serviceRef.current?.connect({
      apiKey: settings.apiKeys.gemini,
      appName: settings.appName,
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      voiceName: settings.voiceName,
      systemInstruction: `你是 ${settings.appName} 專業會議助手。`,
      previousContext: aggregatedContext,
      useSystemAudio,
      recordingLanguage: settings.recordingLanguage,
      microphoneId: settings.selectedMicrophoneId,
      onStateChange: (state) => {
        setConnectionState(state);

        // Only save if strictly disconnected (after retries failed or user stopped)
        // RECONNECTING state will bypass this.
        if (state === ConnectionState.DISCONNECTED && sessionStartTime && messages.length > 0) {
          const userTitle = meetingTitleRef.current.trim() || "未命名會議";
          const dateStr = new Date(sessionStartTime).toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).replace(/\//g, '-');

          const finalTitle = `${userTitle} - ${dateStr}`;

          saveMeeting({
            id: Date.now().toString(),
            title: finalTitle,
            date: sessionStartTime,
            duration: Math.floor((Date.now() - sessionStartTime) / 1000),
            messages: [...messages]
          });
        }
      },
      onError: (err) => setError(err),
      onAudioData: (vol) => setVolume(vol),
      onSessionEnd: (blob) => {
        const url = URL.createObjectURL(blob);
        setFullAudioUrl(url);
      },
      onTranscript: (text, role, isPartial, audioBlob) => {
        setMessages(prev => {
          const existingIndex = prev.findIndex(m => m.isPartial && m.role === role);

          let audioUrl = undefined;
          if (audioBlob) {
            audioUrl = URL.createObjectURL(audioBlob);
          }

          const defaultSpeakerName = role === 'model' ? 'AI' : 'User / Audio';
          const mappedSpeakerName = speakerMapRef.current[defaultSpeakerName];

          if (isPartial) {
            const newMessage: Message = {
              id: existingIndex >= 0 ? prev[existingIndex].id : Date.now().toString(),
              role,
              speaker: mappedSpeakerName,
              text,
              timestamp: Date.now(),
              isPartial: true
            };
            if (existingIndex >= 0) {
              const newMsgs = [...prev];
              newMsgs[existingIndex] = newMessage;
              return newMsgs;
            } else {
              return [...prev, newMessage];
            }
          } else {
            const newMessage: Message = {
              id: Date.now().toString(),
              role,
              speaker: mappedSpeakerName,
              text,
              timestamp: Date.now(),
              isPartial: false,
              audioUrl: audioUrl
            };
            const cleaned = prev.filter(m => !(m.isPartial && m.role === role));
            return [...cleaned, newMessage];
          }
        });
      }
    });

    serviceRef.current?.setMute(isMuted);
    serviceRef.current?.setAiMute(isAiMuted);
  };

  const disconnect = async () => {
    await serviceRef.current?.stop();
    setConnectionState(ConnectionState.DISCONNECTED);
    setIsMuted(false);
  };

  const uploadFile = async (file: File) => {
    if (!settings.apiKeys.gemini) {
      setError("請先設定 Gemini API Key");
      return;
    }

    // Extended validation for various audio types including AAC/M4A
    const allowedExtensions = ['.mp3', '.wav', '.aac', '.m4a', '.flac', '.ogg', '.webm', '.opus', '.aiff'];
    const isAudioType = file.type.startsWith('audio/') || file.type === 'video/mp4' || file.type === 'video/webm'; // sometimes audio containers are detected as video
    const isAllowedExt = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isAudioType && !isAllowedExt) {
      setError("請上傳有效的音訊檔案 (mp3, wav, aac, m4a, flac, etc.)");
      return;
    }

    setIsProcessingFile(true);
    setError(null);

    const uploadMsgId = Date.now().toString();
    const audioUrl = URL.createObjectURL(file);

    setMessages(prev => [...prev, {
      id: uploadMsgId,
      role: 'system',
      text: `正在上傳並分析音檔: ${file.name}...`,
      timestamp: Date.now()
    }]);

    try {
      const transcript = await transcribeAudioFile(file, settings);

      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== uploadMsgId);
        return [
          ...filtered,
          {
            id: Date.now().toString(),
            role: 'user',
            text: `[已上傳音檔: ${file.name}]`,
            timestamp: Date.now()
          },
          {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: transcript,
            timestamp: Date.now(),
            audioUrl: audioUrl
          }
        ];
      });

    } catch (err: any) {
      setError(err.message);
      setMessages(prev => prev.filter(m => m.id !== uploadMsgId));
    } finally {
      setIsProcessingFile(false);
    }
  };

  const resetSession = async () => {
    if (connectionState !== ConnectionState.DISCONNECTED) {
      await disconnect();
    }
    setMessages([]);
    setSessionDuration(0);
    setSessionStartTime(null);
    setMeetingTitle("");
    setFullAudioUrl(null);
    clearTemporaryFiles();
    setError(null);
  };

  return (
    <LiveContext.Provider value={{
      isConnected: connectionState === ConnectionState.CONNECTED,
      isConnecting: connectionState === ConnectionState.CONNECTING || connectionState === ConnectionState.RECONNECTING,
      connectionState,
      messages,
      setMessages,
      updateMessage,
      renameSpeaker,
      volume,
      connect,
      disconnect,
      uploadFile,
      isProcessingFile,
      error,
      sessionDuration,
      meetingTitle,
      setMeetingTitle,

      temporaryFiles,
      addTemporaryFile,
      removeTemporaryFile,
      clearTemporaryFiles,

      isMuted,
      toggleMute,
      isAiMuted,
      toggleAiMute,
      fullAudioUrl,
      resetSession
    }}>
      {children}
    </LiveContext.Provider>
  );
};

export const useLive = () => {
  const context = useContext(LiveContext);
  if (!context) throw new Error('useLive must be used within a LiveProvider');
  return context;
};