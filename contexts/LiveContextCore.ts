import { createContext } from 'react';
import { ConnectionState, Message, TemporaryFile } from '../types';

export interface LiveContextType {
    isConnected: boolean;
    isConnecting: boolean;
    connectionState: ConnectionState;
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    updateMessage: (id: string, updates: Partial<Message>) => void;
    renameSpeaker: (oldName: string, newName: string) => void;
    updateMessageSpeaker: (id: string, newName: string) => void;
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
    sendTextMessage: (text: string) => Promise<void>;
}

export const LiveContext = createContext<LiveContextType | undefined>(undefined);
