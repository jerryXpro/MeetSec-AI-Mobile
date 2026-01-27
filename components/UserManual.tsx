
import React, { useEffect, useState } from 'react';
import { marked } from 'marked';

const USER_MANUAL_MD = `# MeetSec-AI 會議秘書與錄音工具 - 使用說明書

![Cover Image](./manual_images/cover_image.png)

---

## 目錄 (Table of Contents)

1.  [產品簡介](#1-產品簡介)
2.  [系統需求與安裝](#2-系統需求與安裝)
3.  [功能模組詳解](#3-功能模組詳解)
    *   [3.1 會議助手 (Meeting Assistant)](#31-會議助手-meeting-assistant)
    *   [3.2 獨立錄音室 (Independent Recording Studio)](#32-獨立錄音室-independent-recording-studio)
    *   [3.3 萬能轉檔 (Audio Converter)](#33-萬能轉檔-audio-converter)
4.  [系統設定與管理](#4-系統設定與管理)
    *   [4.1 外觀與主題](#41-外觀與主題)
    *   [4.2 AI 模型設定](#42-ai-模型設定)
    *   [4.3 知識庫管理](#43-知識庫管理-knowledge-base)
5.  [常見問題排除 (FAQ)](#5-常見問題排除-faq)
6.  [技術規格](#6-技術規格)

---

## 1. 產品簡介

**MeetSec-AI** 是一款專為現代專業人士打造的 **AI 智慧會議秘書**。整合了先進的語音辨識、自然語言處理與錄音工程技術，不僅能即時轉錄會議內容，還能主動分析討論重點、生成摘要，並提供專業級的本地錄音與轉檔功能。

**核心特色：**
*   **雲端為本**：針對 Google Gemini 與 OpenAI 優化，提供最精準的會議分析。
*   **雙模運作**：「會議助手」與「獨立錄音」雙模式切換，滿足不同情境。
*   **萬能轉檔**：內建極速轉檔引擎，支援 M4A, WebM, MP3, WAV 互轉。
*   **跨平台支援**：基於 Web 技術，相容於主流瀏覽器 (Chrome, Edge)。

---

## 2. 系統需求與安裝

### 系統需求
*   **作業系統**：Windows 10/11, macOS 12+, Linux
*   **瀏覽器**：Google Chrome (建議 110+), Microsoft Edge (建議 110+)
*   **硬體**：
    *   麥克風：建議使用指向性 USB 麥克風或會議專用麥克風。
    *   記憶體：至少 8GB RAM。

### 啟動方式
本軟體為綠色免安裝網頁應用，請依照 IT 人員指示啟動伺服器後，開啟瀏覽器訪問：
\`http://localhost:5173\` (預設埠號)

---

## 3. 功能模組詳解

### 3.1 會議助手 (Meeting Assistant)

這是 MeetSec-AI 的核心模式，專注於即時的會議互動與紀錄。

![Meeting Assistant Interface](./manual_images/ui_meeting_assistant.png)

**主要功能：**
*   **即時轉錄**：將語音即時轉換為文字，顯示於對話視窗。
*   **AI 智能互動**：
    *   **文字即時溝通 (Live Text Chat)**：會議進行中，您隨時可在下方對話框輸入文字與 AI 討論（例如：「剛剛說的重點是什麼？」），完全不會干擾語音錄製。
    *   **語音指令輸入**：點擊對話框右側的 **麥克風圖示**，即可將您的口述指令轉為文字發送給 AI。
    *   **常用指令 (Presets)**：分析面板內建「常用指令」清單，提供快速生成的提示詞模板。
*   **進階控制 (New)**：
    *   **AI 靜音/自動回應**：可開關 AI 自動回應功能，避免在不適合的時機打斷會議。
    *   **音訊來源切換**：(桌面版) 支援切換「麥克風」或「系統音訊」，完美錄製線上會議內容。
*   **檔案轉錄支援**：
    *   點擊上傳按鈕可上傳舊有錄音檔進行分析。
    *   **建議格式**：強烈建議使用 **MP3 格式**，以獲得最佳的相容性與傳輸速率。
*   **多格式匯出**：分析報告可一鍵匯出為 **Word (.doc)**、**PDF** 或 **Markdown** 格式。

**安全防護機制：**
*   **結束確認**：點擊「結束會議」時按鈕會呈現紅色閃爍警示，需再次點擊確認才會真正斷線，防止誤觸。
*   **開啟新會議**：若需全新紀錄，請使用結束後出現的「開啟新會議」按鈕。

### 3.2 獨立錄音室 (Independent Recording Studio)

當您不需要 AI 介入，只想進行高品質錄音時（如訪談、個人備忘），請切換至此模式。

![Recording Studio Interface](./manual_images/ui_recording_studio.png)

**操作步驟：**
1.  點擊側邊欄的 **「獨立錄音」**。
2.  選擇錄音格式：
    *   **WAV**：無損音質，檔案較大，適合後製。
    *   **MP3**：通用性最高，適合分享。
    *   **M4A (AAC)**：蘋果裝置友善，音質好且體積小。
    *   **WebM**：網頁原生格式，體積最小。
3.  點擊紅色 **「開始錄音」** 按鈕。
4.  錄製完成後，點擊停止並下載檔案。

### 3.3 萬能轉檔 (Audio Converter)

遇到檔案格式不相容？內建轉檔工具能幫您解決問題。

![Audio Converter Interface](./manual_images/ui_audio_converter.png)

**特色功能：**
*   **極速轉碼**：利用瀏覽器 WebCodecs 技術，速度可達 10-50 倍速。
*   **支援格式**：支援雙向互轉 **MP3, WAV, M4A, WebM**。
*   **自動容錯**：若極速模式失敗，自動切換至標準模式確保成功。

**使用方法：**
1.  在「獨立錄音」頁面上方，切換至 **「轉檔」** 頁籤。
2.  拖曳或點擊上傳音訊/視訊檔案。
3.  選擇目標格式。
4.  點擊 **「開始轉檔」**。

---

## 4. 系統設定與管理

點擊左側選單的 **「系統設定」** 進入設定面板。

![Settings Interface](./manual_images/ui_settings.png)

### 4.1 外觀與主題
*   **預設主題**：提供「深海藍調」、「賽博龐克」、「靜謐森林」等多種風格。
*   **自訂顏色**：可針對背景、按鈕、文字顏色進行細部微調。

### 4.2 AI 模型設定
*   **供應商選擇**：支援 **Google Gemini** 與 **OpenAI** 兩大主流雲端模型，提供最穩定的服務。
    *   *(已移除本地模型 Ollama 與 LM Studio 支援)*
*   **語言設定**：可指定錄音與轉錄的語言，支援 **繁體中文 (Taiwan)**、**English (US)**、**日本語 (Japanese)**。
*   **API Key 管理 (新功能)**：
    *   點擊眼睛圖示 (👁️) 可顯示或隱藏金鑰內容。
    *   點擊垃圾桶圖示 (🗑️) 可快速清除金鑰。
*   **麥克風靈敏度**：透過滑桿調整 Noise Gate，過濾環境雜音。

> [!TIP]
> **如何取得 Google Gemini API Key？**
> 1.  前往 **[Google AI Studio](https://aistudio.google.com/)** 並登入您的 Google 帳號。
> 2.  點擊左上角的 **"Get API key"** 按鈕。
> 3.  點擊 **"Create API key"** (建議選擇 "Create API key in new project")。
> 4.  複製產生的 API Key (以 \`AIza\` 開頭的字串)，貼入上方的設定欄位即可。
> *   *目前 Gemini Pro 提供免費額度，適合個人使用。*
>
> **如何取得 OpenAI API Key？**
> 1.  前往 **[OpenAI Platform](https://platform.openai.com/api-keys)** 並登入您的帳號。
> 2.  點擊 **"Create new secret key"** 按鈕。
> 3.  設定名稱 (例如 "MeetSec") 並點擊建立。
> 4.  複製產生的金鑰 (以 \`sk-\` 開頭的字串)，貼入設定欄位。
> *   *OpenAI API 為付費服務，需綁定信用卡才能使用。*

### 4.3 知識庫管理 (Knowledge Base)
為不同會議情境建立專屬知識庫，讓 AI 更懂您的專業術語。

**功能操作：**
1.  **建立設定檔**：在「知識庫設定檔」頁籤，點擊「建立新設定檔」。
2.  **切換設定檔**：點擊列表中的項目即可切換當前使用的知識庫。
3.  **編輯與管理**：
    *   點擊設定檔右側的 **編輯圖示 (齒輪)** 進入編輯模式。
    *   **重新命名**：直接修改標題欄位。
    *   **刪除設定檔**：點擊標題旁的 **刪除圖示 (垃圾桶)** (預設設定檔不可刪除)。
4.  **文件管理**：
    *   **上傳**：在編輯模式下，點擊「上傳新文件」加入 PDF 或 TXT 檔。
    *   **刪除**：在文件列表中，點擊垃圾桶圖示移除舊文件。

---

## 5. 常見問題排除 (FAQ)

**Q: 轉檔時出現「Unsupported audio codec」錯誤？**
A: 這是因為您的作業系統或瀏覽器版本較舊，不支援硬體加速。不用擔心，系統會自動切換到「標準模式」完成轉檔，請耐心等待。

**Q: 錄音沒有聲音？**
A: 請檢查「系統設定」中的「麥克風來源」是否選擇正確，並確認瀏覽器已獲取麥克風權限。

**Q: 出現 API 額度不足 (Quota Exceeded) 錯誤？**
A: 這表示您的 Google 或 OpenAI 帳戶免費用量已達上限。請等待額度重置，或至該平台綁定信用卡升級付費方案。

---

## 6. 技術規格

| 項目 | 規格描述 |
| :--- | :--- |
| **前端架構** | React 19, Vite, TypeScript |
| **樣式系統** | TailwindCSS, Vanilla CSS |
| **音訊處理** | Web Audio API, WebCodecs API, Lamejs (MP3), Mp4-Muxer, Webm-Muxer |
| **AI 整合** | Google GenAI SDK, OpenAI API 標準介面 |
| **檔案解析** | Mammoth (.docx), PDF.js (.pdf), XLSX |
| **版控系統** | Git |

---

*MeetSec-AI User Manual v1.4*
`;

const STORAGE_KEY = 'meetsec_user_manual_content';

interface UserManualProps {
    isOpen: boolean;
    onClose: () => void;
}

const UserManual: React.FC<UserManualProps> = ({ isOpen, onClose }) => {
    const [htmlContent, setHtmlContent] = useState('');
    const [markdownContent, setMarkdownContent] = useState(USER_MANUAL_MD);
    const [isEditing, setIsEditing] = useState(false);

    // Initialize content from local storage or default
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            setMarkdownContent(saved);
        } else {
            setMarkdownContent(USER_MANUAL_MD);
        }
    }, []);

    // Update HTML when markdown changes or dialog opens
    useEffect(() => {
        if (isOpen) {
            const parsed = marked.parse(markdownContent);
            setHtmlContent(parsed as string);
        }
    }, [isOpen, markdownContent]);

    const handleSave = () => {
        localStorage.setItem(STORAGE_KEY, markdownContent);
        setIsEditing(false);
    };

    const handleCancel = () => {
        // Revert to saved content
        const saved = localStorage.getItem(STORAGE_KEY);
        setMarkdownContent(saved || USER_MANUAL_MD);
        setIsEditing(false);
    };

    const handleReset = () => {
        if (window.confirm('確定要還原成預設說明書嗎？您的修改將會遺失。')) {
            setMarkdownContent(USER_MANUAL_MD);
            localStorage.removeItem(STORAGE_KEY);
            setIsEditing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className="bg-surface border border-zinc-700 w-[95%] h-[95%] md:w-[80%] md:h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-zinc-700 bg-zinc-900/50 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        使用說明書 (User Manual)
                        {isEditing && <span className="text-sm text-zinc-400 font-normal ml-2">(編輯模式)</span>}
                    </h2>

                    <div className="flex items-center gap-2">
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm transition-colors flex items-center gap-1"
                                title="編輯說明書"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                編輯
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleReset}
                                    className="px-3 py-1.5 bg-red-900/50 hover:bg-red-900 text-red-200 rounded-lg text-sm transition-colors"
                                    title="還原預設值"
                                >
                                    還原預設
                                </button>
                                <button
                                    onClick={handleCancel}
                                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg text-sm transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm transition-colors flex items-center gap-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    儲存
                                </button>
                            </>
                        )}
                        <div className="w-px h-6 bg-zinc-700 mx-1"></div>
                        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden relative">
                    {isEditing ? (
                        <textarea
                            className="w-full h-full bg-zinc-950 p-6 text-zinc-300 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                            value={markdownContent}
                            onChange={(e) => setMarkdownContent(e.target.value)}
                            spellCheck={false}
                        />
                    ) : (
                        <div className="h-full overflow-y-auto p-8 custom-scrollbar">
                            <div
                                className="prose prose-invert prose-lg max-w-none 
                                prose-headings:text-zinc-100 prose-p:text-zinc-300 prose-li:text-zinc-300 
                                prose-strong:text-primary prose-a:text-blue-400 
                                prose-img:rounded-xl prose-img:shadow-lg prose-img:border prose-img:border-zinc-800
                                prose-blockquote:border-l-primary prose-blockquote:bg-zinc-800/30 prose-blockquote:p-4 prose-blockquote:rounded-r-lg"
                                dangerouslySetInnerHTML={{ __html: htmlContent }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserManual;
