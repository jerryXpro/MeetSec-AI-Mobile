
import React, { useEffect, useState } from 'react';
import { marked } from 'marked';

const USER_MANUAL_MD = `# MeetSec-AI 智慧會議秘書 - 使用說明書 (v2.0)

![Cover Image](./manual_images/cover_image.png)

---

## 📖 目錄 (Table of Contents)

1.  [產品簡介](#1-產品簡介)
2.  [功能模組詳解](#2-功能模組詳解)
    *   [2.1 AI 會議助手 (對話與摘要)](#21-ai-會議助手-對話與摘要)
    *   [2.2 獨立錄音室 (純淨錄音)](#22-獨立錄音室-純淨錄音)
    *   [2.3 檔案轉文字與智能分析 (🚀 新動線)](#23-檔案轉文字與智能分析--新動線)
3.  [系統客製化與外觀設定](#3-系統客製化與外觀設定)
4.  [AI 模型與免費配額管理](#4-ai-模型與免費配額管理)
5.  [常見問題排除 (FAQ)](#5-常見問題排除-faq)

---

## 1. 產品簡介

**MeetSec-AI** 是一款專為現代專業人士打造的 **AI 智慧會議秘書**。全圖形化介面整合了先進的語音辨識、自然語言處理技術，不僅能即時轉錄會議內容，也能為您一鍵分析大量參考文件、報告與企劃書，快速生成高水準摘要。

### 🌟 核心升級特色 (v2.0)
*   **極致流暢的動線**：參考資料「上傳」與「直接生成」完美整合於右側面板，一步到位。
*   **專業級視覺排版**：導入四大科技業頂規色彩主題（曜石純黑、深海湛藍等），介面與內容字體尺寸全面獨立控制。
*   **智慧模型守護神**：當遇到不穩定的官方模型時，系統會**自動替您防呆切換**至最穩定的最新版 Gemini 2.5 Flash，保證服務不中斷。
*   **無敵的文件解析器**：全新升級的底層引擎，完美相容舊時代的 \`.doc\`，更能聰明拆解各種受損或偽裝的文字檔。

---

## 2. 功能模組詳解

### 2.1 🤖 AI 會議助手 (對話與摘要)
這是 MeetSec-AI 的核心模式，專注於即時的會議互動與紀錄。

#### 操作指南
1.  **即時轉錄**：點擊下方麥克風後，系統將語音即時轉換為文字，顯示於對話視窗。
2.  **與 AI 即時討論**：會議進行中，您隨時可利用右方的「AI 對話」輸入文字與 AI 討論（例如：「剛剛老闆說的重點是什麼？」）。
3.  **多格式匯出**：支援將生成的摘要結果存檔，並且可**一鍵下載匯出**為 Word (.doc)、PDF 或 Markdown。

---

### 2.2 🎙️ 獨立錄音室 (純淨錄音)
當您不需要 AI 介入，只想專心錄製訪談或個人備註時，請從選單切換至此模式。

*   支援純本地端的無損 / 高效能錄音，不消耗任何 AI 額度。
*   錄製完成後可立刻下載保存，或者一鍵丟給 AI 生成摘要。

---

### 2.3 📁 檔案轉文字與智能分析 (🚀 新動線)
這是分析既有報告、長篇企劃書的最強工具！我們已大幅優化操作體驗：

#### 操作步驟
1.  進入主畫面後，將視線移到**畫面右側的「AI 會議助手」面板**。
2.  在尚未啟動會議對話前，您會立刻看到專屬的 **「補充參考資料」上傳區塊**。
3.  點擊該區塊，可批次上傳多達 20 個檔案 (支援 PDF, \`.doc/.docx\`, Excel, Markdown, TXT)。
4.  上傳完成的瞬間，無需跳轉，請直接點擊正下方的 **「⚡ 直接生成」** 按鈕！
5.  AI 將會一口氣讀取所有檔案，並在原地為您產出完整的總合報告。

---

## 3. 系統客製化與外觀設定

現在您可以打造專屬於您的專業儀表板。點擊「⚙️系統設定」進行展開。

### 🎨 專業四大外觀主題
由色彩專家調校的高級視覺體驗，確保長時間盯著螢幕依然舒適：
*   **系統自動 (System)**：跟隨您的裝置環境動態調整。
*   **經典暗色 (Classic Dark)**：冷靜、專注的高效能暗色。
*   **曜石純黑 (Obsidian Black)**：極致省電，OLED 螢幕的最佳夥伴。
*   **深海湛藍 (Midnight Blue)**：充滿科技與數位活力的湛藍。

### 📏 排版與文字分離控制 (Typography)
*   **介面與內容徹底脫鉤**：您可以將「左側介面字體」稍微調大以防點擊錯誤，同時將「右側報告字體」調小，以便一眼綜觀大局，彼此完全獨立不受干擾。
*   支援切換 無襯線 (最現代) / 明體 (最適合長文閱讀) / 等寬字型，滿足不同場合的心境需求。

---

## 4. AI 模型與免費配額管理

為了對抗免費額度限制，我們提供獨家資源調度功能：

### 🔑 API Key 輪替機制 (Multi-Key Support)
1.  您可以準備多個 Google Gemini API Key。
2.  進入設定後，在 API Key 欄位輸入多把鑰匙，並用**半形逗號 \`,\` 隔開**。
3.  **無縫接軌**：當第一把 Key 額度用盡跳出 429 錯誤時，系統會自動切換到下一把，讓您的工作流暢無阻截！

### 🛡️ 自動防呆降級救援
若 Google 官方無預警下架某些型號，甚至造成 404 崩潰錯誤，系統會**啟動防呆強制救援，自動退回最新且最穩定的 Gemini 模型**，絕不讓您的心血白費。

---

## 5. 常見問題排除 (FAQ)

**Q: 為什麼我上傳舊版的 Word (.doc) 檔案有時還是錯誤？**
A: v2.0 版本已全面導入智慧退避(Fallback)解析引擎，成功率極高。若仍失敗，請確認檔案是否遭到嚴重的非標準格式竄改，或者強烈建議另存為新版 \`.docx\` 後再次上傳。

**Q: 為什麼移除了自訂調色盤？**
A: 為了保障整體介面的美學一致性，避免因為局部調色造成「按鈕看不見」的幽靈配色狀態，v2.0 改由設計師精挑的「四大主題」取代，一鍵即可獲得完整的協調體驗。

**Q: 出現 503 Service Unavailable 錯誤怎麼辦？**
A: 此為 Google 官方伺服器暫時壅塞。請稍候幾秒重新生成，或者在設定中切換使用 \`OpenRouter\` 的備用模型服務。長久之計是盡量多綁幾把免費的 API Key。

---
*MeetSec-AI 智慧會議秘書 v2.0 - 您的終極辦公生產力引擎*
`;

const STORAGE_KEY = 'meetsec_user_manual_content_v2_0';

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
