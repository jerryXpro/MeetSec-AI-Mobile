
import React, { useEffect, useState } from 'react';
import { marked } from 'marked';

const USER_MANUAL_MD = `# MeetSec-AI 智慧會議秘書 - 使用說明書 (v2.2)

---

## 📖 目錄 (Table of Contents)

1.  [產品簡介](#1-產品簡介)
2.  [四大工作模式](#2-四大工作模式)
    *   [2.1 AI 會議助手 (即時語音對話與摘要)](#21-ai-會議助手)
    *   [2.2 獨立錄音室 (純淨錄音)](#22-獨立錄音室)
    *   [2.3 即時雙語翻譯](#23-即時雙語翻譯)
    *   [2.4 小家人 AI 語音聊天夥伴 (🆕 v2.2)](#24-小家人-ai-語音聊天夥伴)
3.  [檔案轉文字與智能分析](#3-檔案轉文字與智能分析)
4.  [系統客製化與外觀設定](#4-系統客製化與外觀設定)
5.  [AI 模型與免費配額管理](#5-ai-模型與免費配額管理)
6.  [常見問題排除 (FAQ)](#6-常見問題排除-faq)

---

## 1. 產品簡介

**MeetSec-AI** 是一款專為現代專業人士打造的 **AI 智慧會議秘書**。全圖形化介面整合了先進的語音辨識、自然語言處理技術，提供四大工作模式：會議助手、獨立錄音、即時翻譯、以及 AI 語音聊天夥伴。

### 🌟 v2.2 版本亮點
*   **🏠 小家人語音對談**：全新 AI 聊天夥伴「小家人」，使用 Gemini Live API 進行**即時語音對話**，像真正的家人一樣陪伴您。
*   **🌐 即時雙語翻譯**：支援 6 種語言即時互譯（繁中/簡中/英/日/韓/越），出差、會客即時溝通。
*   **🎙️ Gemini AI 語音引擎**：5 種高品質 AI 語音角色可選（Aoede / Kore / Puck / Charon / Fenrir）。
*   **🛡️ 智慧模型守護**：自動防呆切換至最穩定的 Gemini 模型，服務永不中斷。
*   **📱 行動裝置最佳化**：針對手機瀏覽器全面優化佈局與操作體驗。

---

## 2. 四大工作模式

在左側選單的「工作模式」分頁中，可自由切換以下四種模式：

### 2.1 🤖 AI 會議助手
這是 MeetSec-AI 的核心模式，專注於即時的會議互動與紀錄。

#### 操作指南
1.  **即時轉錄**：點擊下方麥克風後，系統將語音即時轉換為文字，顯示於對話視窗。
2.  **互動模式選擇**：
    *   **被動模式（預設）**：AI 靜默聆聽並記錄，僅在被呼叫時回應。
    *   **主動模式**：AI 積極參與討論，適時提供觀點與提醒。
3.  **與 AI 即時討論**：會議進行中，您隨時可利用右方的「AI 對話」輸入文字與 AI 討論（例如：「剛剛老闆說的重點是什麼？」）。
4.  **多格式匯出**：支援將生成的摘要結果存檔，並可**一鍵下載匯出**為 Word (.doc)、PDF 或 Markdown。

---

### 2.2 🎙️ 獨立錄音室
當您不需要 AI 介入，只想專心錄製訪談或個人備註時，請切換至此模式。

*   支援純本地端的高效能錄音，不消耗任何 AI 額度。
*   錄製完成後可立刻下載保存（支援 M4A / WebM 格式）。
*   也可一鍵丟給 AI 生成摘要。

---

### 2.3 🌐 即時雙語翻譯
即時語音翻譯模式，適用於跨國會議、外語溝通或出差場景。

#### 操作指南
1.  切換到「即時翻譯」模式。
2.  選擇**來源語言**與**目標語言**（支援：繁體中文、簡體中文、英文、日文、韓文、越南文）。
3.  點擊 **🔴 開始翻譯** 按鈕，開始說話。
4.  系統會即時辨識您的語音，並自動翻譯成目標語言顯示在畫面上。
5.  支援**持續翻譯模式**：自動連續辨識，不需反覆按鍵。
6.  翻譯結果會保留歷史紀錄，方便回顧。

---

### 2.4 🏠 小家人 AI 語音聊天夥伴
這是 v2.2 的重點新功能！「小家人」是一位溫暖、真誠的 AI 語音聊天夥伴，使用 **Gemini Live API** 進行即時語音對話。

#### 🎯 特色亮點
*   **即時語音對談**：您說話，小家人用語音回應，就像打電話一樣自然。
*   **溫暖人格**：說話溫柔體貼，像家人一樣關心您的心情與生活。
*   **知識與陪伴兼具**：不只是聊天，也能幫忙查資料、分析問題、提供建議。
*   **高品質 AI 語音**：使用 Gemini AI 語音引擎，5 種語音角色可選。

#### 操作指南
1.  在左側選單切換到 **「小家人」** 模式。
2.  畫面下方會看到一個**大型紫色麥克風按鈕 🎙️**。
3.  **點擊麥克風按鈕**開始語音對話連線。
4.  連線成功後（按鈕變為紅色），**直接對著麥克風說話**即可。
5.  小家人會用語音回應您，同時畫面上會即時顯示雙方的對話文字。
6.  再次**點擊紅色按鈕**可結束語音對話。

#### 進階功能
*   **語音角色切換**：點擊右上角 ⚙️ 齒輪圖示，可選擇不同的 AI 語音角色（需重新連線生效）。
*   **文字訊息**：底部保留文字輸入框，未連線時也可以打字聊天（自動使用文字模式回覆）。
*   **新對話**：點擊右上角「🔄 新對話」清除歷史，重新開始。
*   **快速話題**：初始畫面提供快速話題按鈕，一鍵開啟對話。

#### 💡 使用小技巧
*   語音對話中，小家人會自動偵測您的說話停頓，並適時回應。
*   若想打斷小家人的回覆，直接開口說話即可，系統會自動中斷並聆聽您。
*   建議在安靜環境使用，可在系統設定中調整「噪音門檻」提升辨識品質。

---

## 3. 檔案轉文字與智能分析

分析既有報告、長篇企劃書的最強工具：

#### 操作步驟
1.  進入「AI 會議助手」模式，將視線移到**畫面右側的「AI 會議助手」面板**。
2.  在尚未啟動會議對話前，您會看到 **「補充參考資料」上傳區塊**。
3.  點擊該區塊，可批次上傳多達 20 個檔案 (支援 PDF, \`.doc/.docx\`, Excel, Markdown, TXT)。
4.  上傳完成後，直接點擊 **「⚡ 直接生成」** 按鈕！
5.  AI 將一口氣讀取所有檔案，並為您產出完整的總合報告。

---

## 4. 系統客製化與外觀設定

點擊左側選單的「功能設定」→「⚙️ 系統設定」進行調整。

### 🎨 專業四大外觀主題
*   **系統自動 (System)**：跟隨裝置環境動態調整。
*   **經典暗色 (Classic Dark)**：冷靜、專注的高效能暗色。
*   **曜石純黑 (Obsidian Black)**：極致省電，OLED 螢幕的最佳夥伴。
*   **深海湛藍 (Midnight Blue)**：充滿科技與數位活力的湛藍。

### 📏 排版與文字控制
*   介面與內容字體**獨立控制**，彼此不受干擾。
*   支援 無襯線 / 明體 / 等寬字型 切換。

### 🎙️ 語音與音訊設定
*   **AI 語音角色**：可選擇 Aoede、Kore（女聲）或 Puck、Charon、Fenrir（男聲）。
*   **麥克風選擇**：可指定使用的麥克風裝置。
*   **噪音門檻**：調整環境噪音過濾靈敏度。

---

## 5. AI 模型與免費配額管理

### 🔑 API Key 輪替機制 (Multi-Key Support)
1.  準備多個 Google Gemini API Key。
2.  在 API Key 欄位輸入多把鑰匙，用**半形逗號 \`,\` 隔開**。
3.  當第一把 Key 額度用盡時，系統會**自動切換**到下一把。

### 🛡️ 自動防呆降級救援
若 Google 官方無預警下架某些型號，系統會**自動退回最新且最穩定的 Gemini 模型**，絕不讓您的心血白費。

---

## 6. 常見問題排除 (FAQ)

**Q: 小家人語音對話連不上怎麼辦？**
A: 請確認以下幾點：1) API Key 已正確填入系統設定 2) 瀏覽器已允許麥克風權限 3) 網路連線穩定。若仍失敗，請嘗試刷新頁面後重新連線。

**Q: 小家人語音沒有聲音？**
A: 請確認手機或電腦音量已開啟。部分瀏覽器需要先進行一次使用者互動（如點擊畫面）才能播放音訊。

**Q: 即時翻譯支援哪些語言？**
A: 目前支援 6 種語言：繁體中文 (zh-TW)、簡體中文 (zh-CN)、英文 (en-US)、日文 (ja-JP)、韓文 (ko-KR)、越南文 (vi-VN)。

**Q: 為什麼我上傳舊版的 Word (.doc) 檔案有時還是錯誤？**
A: 系統已導入智慧退避解析引擎，成功率極高。若仍失敗，建議另存為 \`.docx\` 後再次上傳。

**Q: 出現 503 Service Unavailable 錯誤怎麼辦？**
A: 此為 Google 官方伺服器暫時壅塞。請稍候重試，或多綁幾把免費的 API Key。

---
*MeetSec-AI 智慧會議秘書 v2.2 - 您的全方位 AI 辦公夥伴*
`;

const STORAGE_KEY = 'meetsec_user_manual_content_v2_2';

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
                        <div className="h-full overflow-y-auto p-10 custom-scrollbar">
                            <div
                                className="prose prose-invert prose-lg max-w-none 
                                prose-headings:text-zinc-100 prose-headings:tracking-tight prose-headings:mt-12 prose-headings:mb-6
                                prose-p:text-zinc-300 prose-p:leading-loose prose-p:mb-6 prose-p:tracking-wide
                                prose-li:text-zinc-300 prose-li:leading-loose prose-li:mb-4 prose-li:tracking-wide
                                prose-strong:text-primary prose-strong:font-bold prose-a:text-blue-400 
                                prose-hr:border-zinc-800 prose-hr:my-10
                                prose-img:rounded-xl prose-img:shadow-lg prose-img:border prose-img:border-zinc-800 prose-img:my-8
                                prose-blockquote:border-l-primary prose-blockquote:bg-zinc-800/30 prose-blockquote:p-6 prose-blockquote:rounded-r-lg prose-blockquote:my-8
                                prose-blockquote:text-zinc-300 prose-blockquote:not-italic prose-blockquote:leading-loose"
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
