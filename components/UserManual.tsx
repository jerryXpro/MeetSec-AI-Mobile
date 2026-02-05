
import React, { useEffect, useState } from 'react';
import { marked } from 'marked';

const USER_MANUAL_MD = `# MeetSec-AI 會議秘書與錄音工具 - 使用說明書

![Cover Image](./manual_images/cover_image.png)

---

## 📖 目錄 (Table of Contents)

1.  [產品簡介](#1-產品簡介)
2.  [系統需求與安裝](#2-系統需求與安裝)
3.  [功能模組詳解](#3-功能模組詳解)
    *   [3.1 會議助手 (Meeting Assistant)](#31-會議助手-meeting-assistant)
    *   [3.2 獨立錄音室 (Independent Recording Studio)](#32-獨立錄音室-independent-recording-studio)
    *   [3.3 萬能轉檔 (Audio Converter)](#33-萬能轉檔-audio-converter)
4.  [系統設定與管理](#4-系統設定與管理)
    *   [4.1 外觀與主題](#41-外觀與主題)
    *   [4.2 AI 模型與配額管理](#42-ai-模型與配額管理)
    *   [4.3 知識庫管理](#43-知識庫管理-knowledge-base)
5.  [常見問題排除 (FAQ)](#5-常見問題排除-faq)
6.  [技術規格](#6-技術規格)

---

## 1. 產品簡介

**MeetSec-AI** 是一款專為現代專業人士打造的 **AI 智慧會議秘書**。整合了先進的語音辨識、自然語言處理與錄音工程技術，不僅能即時轉錄會議內容，還能主動分析討論重點、生成摘要，並提供專業級的本地錄音與轉檔功能。

### 🌟 核心特色
*   **雲端為本**：針對 Google Gemini 與 OpenAI 優化，提供最精準的會議分析。
*   **免費配額優化**：獨家 **多重 Key 輪替** 與 **自動降級機制**，讓您免費使用不受限。
*   **雙模運作**：「會議助手」與「獨立錄音」雙模式切換，滿足不同情境。
*   **萬能轉檔**：內建極速轉檔引擎，支援 M4A, WebM, MP3, WAV 互轉。
*   **跨平台支援**：基於 Web 技術，相容於主流瀏覽器 (Chrome, Edge)。

---

## 2. 系統需求與安裝

### 💻 系統需求
*   **作業系統**：Windows 10/11, macOS 12+, Linux
*   **瀏覽器**：Google Chrome (建議 110+), Microsoft Edge (建議 110+)
*   **硬體**：
    *   麥克風：建議使用指向性 USB 麥克風或會議專用麥克風。
    *   記憶體：至少 8GB RAM。

### 🚀 啟動方式
本軟體為綠色免安裝網頁應用，請依照 IT 人員指示啟動伺服器後，開啟瀏覽器訪問：
> \`http://localhost:5173\` (預設埠號)

---

## 3. 功能模組詳解

### 3.1 🤖 會議助手 (Meeting Assistant)
這是 MeetSec-AI 的核心模式，專注於即時的會議互動與紀錄。

![Meeting Assistant Interface](./manual_images/ui_meeting_assistant.png)

#### 主要功能
1.  **即時轉錄**：將語音即時轉換為文字，顯示於對話視窗。
2.  **AI 智能互動**：
    *   **文字即時溝通**：會議進行中，您隨時可在下方對話框輸入文字與 AI 討論（例如：「剛剛說的重點是什麼？」）。
    *   **語音指令輸入**：點擊對話框右側的 **麥克風圖示**，即可將您的口述指令轉為文字發送給 AI。
3.  **進階控制**：
    *   **AI 靜音/自動回應**：可開關 AI 自動回應功能。
    *   **音訊來源切換**：(桌面版) 支援切換「麥克風」或「系統音訊」。
4.  **檔案轉錄支援**：
    *   點擊上傳按鈕可上傳舊有錄音檔。
    *   **建議格式**：強烈建議使用 **MP3 格式**。
5.  **多格式匯出**：
    *   支援匯出為 **Word (.doc)**、**PDF** 或 **Markdown**。

#### 🛡️ 安全防護機制
*   **結束確認**：點擊「結束會議」時按鈕會呈現紅色閃爍警示，需再次點擊確認才會真正斷線。
*   **開啟新會議**：結束後請使用「開啟新會議」按鈕來重置狀態。


### 3.2 🎙️ 獨立錄音室 (Independent Recording Studio)
當您不需要 AI 介入，只想進行高品質錄音時（如訪談、個人備忘），請切換至此模式。

![Recording Studio Interface](./manual_images/ui_recording_studio.png)

#### 操作步驟
1.  點擊側邊欄的 **「獨立錄音」**。
2.  選擇錄音格式：
    *   **WAV**：無損音質，檔案較大。
    *   **MP3**：通用性最高，適合分享。
    *   **M4A (AAC)**：蘋果裝置友善。
    *   **WebM**：網頁原生，體積最小。
3.  點擊紅色 **「開始錄音」** 按鈕。
4.  錄製完成後：
    *   **下載**：點擊下載按鈕儲存檔案。
    *   **AI 摘要 (新功能)**：直接點擊 **「生成摘要 (AI)」** 按鈕，系統將自動分析剛錄製的內容重點，無需切換模式。

### 3.3 🔄 萬能轉檔 (Audio Converter)
遇到檔案格式不相容？內建轉檔工具能幫您解決問題。

![Audio Converter Interface](./manual_images/ui_audio_converter.png)

#### 特色功能
*   **極速轉碼**：利用瀏覽器 WebCodecs 技術，速度可達 10-50 倍速。
*   **支援格式**：支援雙向互轉 **MP3, WAV, M4A, WebM**。
*   **自動容錯**：若極速模式失敗，自動切換至標準模式確保成功。

---

## 4. 系統設定與管理

點擊左側選單的 **「系統設定」** 進入設定面板。

![Settings Interface](./manual_images/ui_settings.png)

### 4.1 🎨 外觀與主題
*   **預設主題**：提供「深海藍調」、「賽博龐克」、「靜謐森林」等多種風格。
*   **自訂顏色**：可微調背景、按鈕、文字顏色。

### 4.2 🧠 AI 模型與配額管理 (重要)

#### 供應商與模型選擇
支援 **Google Gemini** 與 **OpenAI** 兩大主流雲端模型。
*   **Gemini 模型切換**：新增多款最新模型支援，包含 **Gemini 3.0 Pro/Flash Preview** 與 **Gemini 2.5 Pro/Flash**。
*   **連線測試功能**：設定 API Key 後，可點擊「測試連線」按鈕驗證 Key 是否有效及模型是否可用。

#### 🔑 API Key 管理與免費配額攻略
為了讓您能長期免費使用強大的 AI，我們推出了獨家的配額管理功能：

1.  **多重 Key 支援 (Multi-Key Support)**：
    *   在 Gemini API Key 欄位中，您可以輸入 **多組 API Key**，並用逗號 \`,\` 隔開。
    *   *例如：* \`AIzaSyD..., AIzaSyB..., AIzaSyC...\`
    *   **運作原理**：系統會自動輪替使用。當第一組 Key 額度用盡 (Quota Exceeded) 時，會自動無縫切換到下一組，讓您的會議不中斷。

2.  **智慧降級機制 (Auto Fallback)**：
    *   若所有 Key 的主選模型 (如 \`Gemini 2.5 Flash\`) 額度皆耗盡，系統會自動嘗試降級至 **\`Gemini 2.5 Flash Lite\`**。
    *   \`2.5 Flash Lite\` 擁有極高的性價比與寬鬆額度，確保服務的高可用性。

> [!TIP]
> **如何取得 Google Gemini API Key？**
> 1.  前往 **[Google AI Studio](https://aistudio.google.com/)**。
> 2.  登入您的 Google 帳號 (建議準備多個帳號以獲取多個 Key)。
> 3.  點擊 **"Get API key"** -> **"Create API key"**。
> 4.  複製 \`AIza\` 開頭的字串，貼入設定欄位。

### 4.3 📚 知識庫管理 (Knowledge Base)
為不同會議情境建立專屬知識庫，讓 AI 更懂您的專業術語。

**功能操作：**
1.  **建立設定檔**：在「知識庫設定檔」頁籤，點擊「建立新設定檔」。
2.  **切換設定檔**：點擊列表中的項目即可切換。
3.  **文件管理**：支援上傳 PDF 或 TXT 作為補充背景資料。

---

## 5. 常見問題排除 (FAQ)

**Q: 轉檔時出現「Unsupported audio codec」錯誤？**
A: 這是因為您的作業系統或瀏覽器版本較舊。不用擔心，系統會自動切換到「標準模式」完成轉檔。

**Q: 錄音沒有聲音？**
A: 請檢查「系統設定」中的「麥克風來源」是否選擇正確，並確認瀏覽器已獲取麥克風權限。

**Q: 出現 API 額度不足 (Quota Exceeded) 錯誤？**
A: 這表示您所有的 API Key 免費用量皆達上限。
*   **解決方案**：請參考設定頁面的說明，申請更多 Google 帳號並填入更多 API Key 以分散用量。

---

## 6. 技術規格

| 項目 | 規格描述 |
| :--- | :--- |
| **前端架構** | React 19, Vite, TypeScript |
| **樣式系統** | TailwindCSS, Vanilla CSS |
| **音訊處理** | Web Audio API, WebCodecs API, Lamejs (MP3) |
| **AI 整合** | Google GenAI SDK (Multi-Key Support) |
| **版控系統** | Git |

---

*MeetSec-AI User Manual v1.5*
`;

const STORAGE_KEY = 'meetsec_user_manual_content_v1_5';

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
