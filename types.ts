
export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR',
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  speaker?: string; 
  text: string;
  timestamp: number;
  isPartial?: boolean;
  audioUrl?: string; 
}

export interface MeetingSession {
  id: string;
  title: string;
  date: number;
  duration: number;
  messages: Message[];
  summary?: string;
  actionItems?: string[];
}

export type LLMProvider = 'gemini' | 'openai' | 'ollama' | 'lmstudio' | 'anythingllm';

export type ThemePreset = 'professional' | 'ocean' | 'forest' | 'cyber' | 'sunset' | 'light';

export interface PresetCommand {
  id: string;
  name: string;
  prompt: string;
}

export interface AppSettings {
  appName: string; 
  userName: string;
  provider: LLMProvider;
  apiKeys: {
    gemini: string;
    openai: string;
    anythingllm: string;
  };
  geminiTranscriptionModel: string;
  geminiAnalysisModel: string;

  ollamaUrl: string;
  lmStudioUrl: string;
  anythingLlmUrl: string;
  currentProfileId: string;
  recordingLanguage: 'zh-TW' | 'en-US' | 'ja-JP';
  voiceName: string;
  selectedMicrophoneId: string; 
  
  // Custom Presets
  presetCommands: PresetCommand[];

  // Display Settings
  uiFontSize: 'sm' | 'md' | 'lg';
  contentFontSize: 'sm' | 'md' | 'lg' | 'xl';
  fontFamily: 'sans' | 'serif' | 'mono';
  
  // Layout Dimensions (New)
  sidebarWidth: number;
  assistantWidth: number;

  // Theme Settings (Restored)
  themeMode: 'preset' | 'custom' | 'system';
  themePreset: ThemePreset;
  customColors: {
      background: string;
      surface: string;
      primary: string;
      secondary: string;
      text: string;
      icon: string; // Added icon color
  };
}

export interface ProfileDocument {
  id: string;
  name: string;
  content: string; 
  type: string;    
  dateAdded: number;
}

export interface KnowledgeProfile {
  id: string;
  name: string;
  description: string;
  documents: ProfileDocument[]; 
}

export interface AudioVisualizerData {
  volume: number;
  frequencyData: Uint8Array;
}