import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppSettings, MeetingSession, KnowledgeProfile, ProfileDocument, ThemePreset, PresetCommand, ReportTemplate } from '../types';

export type SidebarTab = 'profiles' | 'settings';

interface AppContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  history: MeetingSession[];
  saveMeeting: (session: MeetingSession) => void;
  deleteMeeting: (id: string) => void;

  // Profile Management
  profiles: KnowledgeProfile[];
  addProfile: (profile: KnowledgeProfile) => void;
  updateProfile: (id: string, updates: Partial<KnowledgeProfile>) => void;
  deleteProfile: (id: string) => void;
  addDocumentToProfile: (profileId: string, doc: ProfileDocument) => void;
  removeDocumentFromProfile: (profileId: string, docId: string) => void;

  // UI State
  sidebarTab: SidebarTab;
  setSidebarTab: (tab: SidebarTab) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;

  viewMode: 'meeting' | 'recording' | 'translator';
  setViewMode: (mode: 'meeting' | 'recording' | 'translator') => void;
}





const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
    : '113 113 122';
};

// Theme Presets Definition — WCAG AA verified (contrast ≥ 4.5:1)
export const THEME_PRESETS: Record<ThemePreset, { name: string, colors: AppSettings['customColors'] }> = {
  dark: {
    name: '經典暗色 (Classic Dark)',
    colors: { background: '#0D1117', surface: '#161B22', primary: '#58A6FF', secondary: '#BC8CFF', text: '#E6EDF3', icon: '#8B949E' }
  },
  black: {
    name: '曜石純黑 (Obsidian Black)',
    colors: { background: '#000000', surface: '#111111', primary: '#58A6FF', secondary: '#8B949E', text: '#F0F0F0', icon: '#9E9E9E' }
  },
  ocean: {
    name: '深海湛藍 (Midnight Blue)',
    colors: { background: '#0A1628', surface: '#12284A', primary: '#5EEAD4', secondary: '#F471B5', text: '#E8EDF2', icon: '#7C9CBF' }
  },
  light: {
    name: '霧白輕盈 (Mist Light)',
    colors: { background: '#FAFAFA', surface: '#FFFFFF', primary: '#2563EB', secondary: '#6366F1', text: '#1A1A1A', icon: '#6B7280' }
  }
};

const defaultPresets: PresetCommand[] = [
  { id: '1', name: '📝 標準會議記錄', prompt: '請整理一份標準的會議記錄，包含摘要、重點討論、決議事項與待辦清單。' },
  { id: '2', name: '✅ 僅提取待辦', prompt: '請忽略其他細節，只列出本次會議的所有「待辦事項 (Action Items)」，並標註負責人與期限。' },
  { id: '3', name: '🇬🇧 翻譯成英文', prompt: '請將整份會議記錄翻譯成專業的商務英文 (English)。' },
  { id: '4', name: '📊 提取關鍵數據', prompt: '請找出會議中提到的所有關鍵數據、金額、日期與 KPI 指標，並以列表呈現。' },
  { id: '5', name: '🗣️ 發言者觀點分析', prompt: '請分析每位發言者的主要立場與觀點差異。' },
];

const defaultReportTemplates: ReportTemplate[] = [
  { id: 'rt1', name: '📝 標準會議記錄', prompt: '請整理一份標準的會議記錄，格式包含：\n1. 會議摘要（200字以內）\n2. 重點討論事項\n3. 決議事項\n4. 待辦清單（含負責人與期限）', isDefault: true },
  { id: 'rt2', name: '📊 簡報摘要', prompt: '請將內容整理成簡潔的簡報摘要格式：\n- 每頁一個核心重點\n- 使用條列式重點（Bullet Points）\n- 搭配關鍵數據與結論\n- 最後附上「下一步行動」建議', isDefault: true },
  { id: 'rt3', name: '🔬 技術評審報告', prompt: '請以技術評審的角度整理報告：\n1. 技術方案概述\n2. 風險評估與潛在問題\n3. 效能 / 安全性分析\n4. 改善建議\n5. 結論與建議決策', isDefault: true },
];

const defaultSettings: AppSettings = {
  appName: 'MeetSec-AI',
  userName: 'User',
  provider: 'gemini',
  apiKeys: { gemini: '', openrouter: '' },
  geminiTranscriptionModel: 'gemini-2.0-flash',
  geminiAnalysisModel: 'gemini-2.5-pro',
  geminiLiveModel: 'gemini-2.5-flash-native-audio-preview-12-2025',
  openrouterModel: 'google/gemini-2.0-flash-lite-preview-02-05:free',
  customBaseUrl: 'http://localhost:11434/v1',
  customApiKey: '',
  customModelId: 'llama3',
  currentProfileId: 'default',
  recordingLanguage: 'zh-TW',
  voiceName: 'Aoede',
  selectedMicrophoneId: '',


  aiInteractionMode: 'passive',

  presetCommands: defaultPresets,

  reportTemplates: defaultReportTemplates,
  activeTemplateId: 'rt1',

  uiFontSize: 'md',
  contentFontSize: 'md',
  navFontSize: 11,
  fontFamily: 'sans',
  themeMode: 'custom',
  themePreset: 'ocean',
  customColors: THEME_PRESETS.ocean.colors,

  // Default widths
  sidebarWidth: 320,
  assistantWidth: 384,

  noiseThreshold: 0.002 // Default high sensitivity
};



// ... (lines 110-117 omitted)

const defaultProfile: KnowledgeProfile = {
  id: 'default',
  name: '一般會議 (預設)',
  documents: [],
  description: '通用會議情境，無特定背景知識。'
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('proactor_settings');
      const parsed = saved ? JSON.parse(saved) : defaultSettings;
      // Ensure customColors has structure if migrating from old version
      const merged = { ...defaultSettings, ...parsed };
      if (!merged.customColors) merged.customColors = defaultSettings.customColors;
      // Backwards compatibility
      if (!merged.customColors.text) merged.customColors.text = '#e4e4e7';
      if (!merged.customColors.icon) merged.customColors.icon = '#71717a';
      if (!merged.sidebarWidth) merged.sidebarWidth = 320;
      if (!merged.assistantWidth) merged.assistantWidth = 384;
      if (!merged.presetCommands) merged.presetCommands = defaultPresets; // Init presets if missing

    // Auto-fix deprecated models
      if (
        merged.geminiTranscriptionModel.includes('gemini-1.5') || 
        merged.geminiTranscriptionModel.includes('gemini-2.0') ||
        merged.geminiTranscriptionModel.includes('gemini-3.') ||
        merged.geminiTranscriptionModel === 'gemini-2.5-flash-preview-04-17'
      ) {
        merged.geminiTranscriptionModel = 'gemini-2.5-flash';
      }
      if (merged.geminiAnalysisModel.includes('gemini-1.5') ||
        merged.geminiAnalysisModel.includes('gemini-2.0') ||
        merged.geminiAnalysisModel.includes('gemini-3.') ||
        merged.geminiAnalysisModel === 'gemini-2.5-flash-preview-04-17' ||
        merged.geminiAnalysisModel === 'gemini-2.5-pro-preview-03-25') {
        merged.geminiAnalysisModel = 'gemini-2.5-flash';
      }
      // Live models - whitelist only known valid Live API models
      const validLiveModels = [
        'gemini-2.5-flash-native-audio-preview-12-2025',
        'gemini-2.5-flash-native-audio-preview-09-2025',
      ];
      if (merged.geminiLiveModel === 'gemini-3.1-flash-live-preview') {
        merged.geminiLiveModel = 'gemini-2.5-flash-native-audio-preview-12-2025';
      }
      if (!merged.geminiLiveModel || !validLiveModels.includes(merged.geminiLiveModel)) {
        console.warn(`[AppContext] Invalid Live model "${merged.geminiLiveModel}", resetting to default.`);
        merged.geminiLiveModel = 'gemini-2.5-flash-native-audio-preview-12-2025';
      }
      return merged;
    } catch (e) { return defaultSettings; }
  });

  const [history, setHistory] = useState<MeetingSession[]>(() => {
    try {
      const saved = localStorage.getItem('proactor_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [profiles, setProfiles] = useState<KnowledgeProfile[]>(() => {
    try {
      const saved = localStorage.getItem('proactor_profiles');
      return saved ? JSON.parse(saved) : [defaultProfile];
    } catch (e) { return [defaultProfile]; }
  });

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('profiles');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'meeting' | 'recording' | 'translator'>('meeting');

  useEffect(() => {
    localStorage.setItem('proactor_settings', JSON.stringify(settings));
    if (settings.appName) {
      document.title = settings.appName;
    }
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('proactor_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('proactor_profiles', JSON.stringify(profiles));
  }, [profiles]);

  // Apply Theme Effect
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyColors = () => {
      let mode = settings.themeMode;
      let colors = settings.customColors;

      if (mode === 'system') {
        const isDark = mediaQuery.matches;
        colors = isDark ? THEME_PRESETS.dark.colors : THEME_PRESETS.light.colors;
        root.classList.toggle('dark', isDark);
      } else if (mode === 'preset') {
        colors = THEME_PRESETS[settings.themePreset].colors;
        root.classList.toggle('dark', settings.themePreset !== 'light');
      } else {
        // Custom Mode
        root.classList.add('dark'); // Default to dark classes mostly
        // Check brightness for Tailwind 'dark' class toggle (affects standard utility classes)
        const bg = colors.background.replace('#', '');
        const r = parseInt(bg.substring(0, 2), 16);
        const g = parseInt(bg.substring(2, 4), 16);
        const b = parseInt(bg.substring(4, 6), 16);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        root.classList.toggle('dark', brightness < 128);
      }

      root.style.setProperty('--color-background', hexToRgb(colors.background));
      root.style.setProperty('--color-surface', hexToRgb(colors.surface));
      root.style.setProperty('--color-primary', hexToRgb(colors.primary));
      root.style.setProperty('--color-secondary', hexToRgb(colors.secondary));
      root.style.setProperty('--color-accent', hexToRgb(colors.secondary));
      root.style.setProperty('--color-text', hexToRgb(colors.text || '#e4e4e7'));
      root.style.setProperty('--color-icon', hexToRgb(colors.icon || '#71717a'));
    };

    applyColors();

    if (settings.themeMode === 'system') {
      mediaQuery.addEventListener('change', applyColors);
      return () => mediaQuery.removeEventListener('change', applyColors);
    }
  }, [settings.themeMode, settings.themePreset, settings.customColors]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const merged = { ...prev, ...newSettings };
      
      // Auto-sync customColors when a preset is chosen so the Color Picker UI reflects it
      if (newSettings.themePreset && merged.themeMode === 'preset') {
         merged.customColors = THEME_PRESETS[newSettings.themePreset].colors;
      }
      
      return merged;
    });
  };

  const saveMeeting = (session: MeetingSession) => {
    setHistory(prev => {
      const exists = prev.findIndex(s => s.id === session.id);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = session;
        return updated;
      }
      return [session, ...prev];
    });
  };

  const deleteMeeting = (id: string) => {
    setHistory(prev => prev.filter(s => s.id !== id));
  };

  const addProfile = (profile: KnowledgeProfile) => {
    setProfiles(prev => [...prev, profile]);
    updateSettings({ currentProfileId: profile.id });
  };

  const updateProfile = (id: string, updates: Partial<KnowledgeProfile>) => {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deleteProfile = (id: string) => {
    if (id === 'default') return;
    setProfiles(prev => prev.filter(p => p.id !== id));
    if (settings.currentProfileId === id) {
      updateSettings({ currentProfileId: 'default' });
    }
  };

  const addDocumentToProfile = (profileId: string, doc: ProfileDocument) => {
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, documents: [...p.documents, doc] } : p));
  };

  const removeDocumentFromProfile = (profileId: string, docId: string) => {
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, documents: p.documents.filter(d => d.id !== docId) } : p));
  };

  return (
    <AppContext.Provider value={{
      settings,
      updateSettings,
      history,
      saveMeeting,
      deleteMeeting,
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
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};