import { GoogleGenAI } from "@google/genai";
import { AppSettings, Message } from "../types";

interface ContextFile {
    name: string;
    content: string;
}

// Helper to format transcript
const formatTranscript = (messages: Message[], appName: string) => {
    return messages
        .filter(m => !m.isPartial)
        .map(m => {
            const time = new Date(m.timestamp).toLocaleTimeString();
            const speakerName = m.speaker ? m.speaker : (m.role === 'model' ? appName : 'User');
            return `[${time}] ${speakerName}: ${m.text}`;
        })
        .join('\n');
}

// Helper to format context files
const formatContextFiles = (files?: ContextFile[]) => {
    if (!files || files.length === 0) return "";
    return files.map((f, i) => `\n>>> 補充文件 ${i + 1}: ${f.name} <<<\n${f.content}\n-----------------------------------`).join('\n');
}

export const generateMeetingMinutes = async (
    messages: Message[],
    settings: AppSettings,
    meetingTitle: string,
    meetingDate: string,
    meetingDuration: string,
    customInstruction?: string,
    contextFiles?: ContextFile[],
    templatePrompt?: string
): Promise<string> => {
    const transcript = formatTranscript(messages, settings.appName);
    const filesContent = formatContextFiles(contextFiles);

    const hasTranscript = transcript.trim().length > 0;
    const hasFiles = filesContent.trim().length > 0;

    // Only throw if NO transcript AND NO custom instruction AND NO files
    if (!hasTranscript && (!customInstruction || !customInstruction.trim()) && !hasFiles) {
        throw new Error("尚無逐字稿內容或補充資料。請確保麥克風已開啟並開始說話，或上傳檔案，或輸入特定指令。");
    }

    const systemPrompt = buildSummaryPrompt(
        transcript,
        settings.appName,
        meetingTitle,
        meetingDate,
        meetingDuration,
        customInstruction,
        filesContent,
        hasFiles,
        templatePrompt
    );

    return await callLLM(systemPrompt, settings);
};

export const generateSummaryFromText = async (
    transcriptText: string,
    settings: AppSettings,
    durationStr: string = "未知",
    customInstruction?: string
): Promise<string> => {
    const meetingTitle = "錄音檔分析";
    const now = new Date();
    const meetingDate = now.toLocaleDateString('zh-TW');

    const systemPrompt = buildSummaryPrompt(
        transcriptText,
        settings.appName,
        meetingTitle,
        meetingDate,
        durationStr,
        customInstruction,
        "",
        false
    );

    return await callLLM(systemPrompt, settings);
};

const buildSummaryPrompt = (
    transcript: string,
    appName: string,
    meetingTitle: string,
    meetingDate: string,
    meetingDuration: string,
    customInstruction: string | undefined,
    filesContent: string,
    hasFiles: boolean,
    templatePrompt?: string
): string => {
    const basePrompt = `
# 角色設定
你是一位專精於商業會議與學術討論的『${appName} 執行秘書』。你的語氣專業、客觀且結構條理分明。

# 任務
分析提供的會議逐字稿與補充資料，並生成一份完整的『會議後報告』。
**所有內容必須嚴格使用【繁體中文 (台灣)】撰寫。**

# 輸出格式 (請嚴格遵守 Markdown 格式)

# ${meetingTitle} - 會議記錄
**會議時間:** ${meetingDate}
**會議時長:** ${meetingDuration}

## 1. 📄 會議摘要 (Executive Summary)
> 請用 3-5 句話提供會議的高層次摘要，包含主要目的、關鍵決議與整體結論。目標是讓管理者能在 10 秒內掌握會議重點。

## 2. 🔑 關鍵議題與討論 (Key Topics)
* **[議題 1 名稱]**:
    * 討論細節與脈絡...
    * 提到的關鍵數據或論點...
* **[議題 2 名稱]**:
    * 細節...

## 3. ✅ 決議事項 (Decisions Made)
* [決議 1]: 說明決定了什麼。
* [決議 2]: ...

## 4. 🚀 待辦事項 (Action Items) - 重要
*請提取具有明確負責人的可執行任務，並使用表格格式呈現。*

| 負責人 (Owner) | 待辦事項 (Task) | 期限/優先級 (Deadline) |
| :--- | :--- | :--- |
| @姓名 | 任務描述... | YYYY/MM/DD 或 高/中/低 |
| @姓名 | ... | ... |

## 5. 💡 備註與下次會議 (Notes & Next Steps)
* **未決議題:** 列出尚待解決或需要進一步討論的問題。
* **下次會議:** 日期/時間 或 "待定"。

# 限制與規範
- **語言:** 嚴格使用 **繁體中文 (台灣)**。請使用台灣慣用的商業術語（例如：專案、行銷、數據、報告）。
- **語氣:** 專業、精簡、以行動為導向。
- **準確性:** 絕不捏造事實 (No Hallucinations)。只包含逐字稿或補充資料中出現的資訊。
- **格式:** 針對關鍵術語或重點使用 **粗體** 標示。
`;

    let finalPrompt = basePrompt;

    if (customInstruction && customInstruction.trim()) {
        finalPrompt = `
# 角色設定
你是一位專業的 AI 會議助理。

# 任務
請根據提供的會議逐字稿與補充資料，並**嚴格遵守使用者的以下指令**來生成或修改內容。

---
### 🔴 使用者特別指令 (最高優先級)：
"${customInstruction}"
---

如果使用者指令要求特定的格式（如表格、翻譯、摘要重點），請優先滿足該要求，忽略下方的預設格式。
如果使用者指令較為模糊（如「整理會議記錄」），則參考下方的預設格式。

注意：如果逐字稿內容為空但有補充資料，請根據補充資料進行摘要或回答。

# 預設參考格式 (僅在使用者無特定格式要求時參考)
${basePrompt}
      `;
    }

    // If a report template is provided, prepend it as a format override
    if (templatePrompt && templatePrompt.trim()) {
        finalPrompt = `
# 報告範本格式指令 (最高優先級)
請嚴格按照以下範本格式生成報告：
${templatePrompt}

---
${finalPrompt}
        `;
    }

    const hasTranscript = transcript && transcript.trim().length > 0;

    return `
${finalPrompt}

---

【補充參考資料 (Context Files)】
${hasFiles ? filesContent : "(無)"}

---
    
【會議逐字稿內容】
${hasTranscript ? transcript : "(目前尚無逐字稿內容)"}
  `;
};

export const chatWithTranscript = async (
    messages: Message[],
    userQuestion: string,
    history: { role: string, content: string }[],
    settings: AppSettings,
    contextFiles?: ContextFile[]
): Promise<string> => {
    const transcript = formatTranscript(messages, settings.appName);
    const filesContent = formatContextFiles(contextFiles);

    const conversationStr = history.map(h => `${h.role === 'user' ? 'User' : 'AI'}: ${h.content}`).join('\n');

    const systemPrompt = `
    你是一位聰明的會議助手 (Chatbot)。
    你的任務是：**回答使用者關於「會議逐字稿」與「補充資料」的特定問題**。
    
    重要規則：
    1. **不要**主動產生會議摘要，除非使用者明確要求。
    2. **不要**重複使用者的問題。
    3. 直接針對問題回答，答案盡量精簡。
    4. 必須根據下方提供的【會議逐字稿】與【補充參考資料】內容回答。如果找不到相關資訊，請誠實回答「資料中未提及此內容」。
    5. 請使用與會議內容一致的語言（通常是繁體中文）回答。
    
    ---
    【補充參考資料 (Context Files)】
    ${filesContent ? filesContent : "(無)"}
    ---

    【會議逐字稿】
    ${transcript}
    ---
    
    【先來的對話紀錄】
    ${conversationStr}
    
    【使用者的當前問題】
    ${userQuestion}
    `;

    return await callLLM(systemPrompt, settings);
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callLLM(prompt: string, settings: AppSettings): Promise<string> {

    // --- OpenRouter Handling ---
    if (settings.provider === 'openrouter') {
        if (!settings.apiKeys.openrouter) throw new Error("請先在設定中輸入 OpenRouter API Key。");

        const model = settings.openrouterModel || 'google/gemini-2.5-flash:free';

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${settings.apiKeys.openrouter}`,
                "HTTP-Referer": "https://github.com/jerryXpro/MeetSec-AI", // Required by OpenRouter
                "X-Title": settings.appName // Required by OpenRouter
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: `You are ${settings.appName}, a helpful meeting assistant. Answer in Traditional Chinese (Taiwan).` },
                    { role: "user", content: prompt }
                ]
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`OpenRouter Error: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "OpenRouter 未回傳任何內容。";
    }

    // --- Custom / Local LLM Handling ---
    if (settings.provider === 'custom') {
        const baseUrl = settings.customBaseUrl?.replace(/\/+$/, '') || 'http://localhost:11434/v1';
        const apiKey = settings.customApiKey || 'sk-no-key-required';
        const model = settings.customModelId || 'llama3';

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: `You are ${settings.appName}, a helpful meeting assistant. Answer in Traditional Chinese (Taiwan).` },
                    { role: "user", content: prompt }
                ]
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`Custom LLM Error (${response.status}): ${err.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "Local LLM 未回傳任何內容。";
    }

    // --- Gemini Handling with Rotation & Fallback ---
    if (settings.provider === 'gemini') {
        const rawKeys = settings.apiKeys.gemini;
        if (!rawKeys) throw new Error("請先在設定中輸入 Gemini API Key。");

        const keys = rawKeys.split(/[,;\n]+/).map(k => k.trim()).filter(k => k.length > 0);
        if (keys.length === 0) throw new Error("無效的 Gemini API Key");

        const executeGemini = async (key: string, model: string): Promise<string> => {
            // console.log(`[Gemini Analysis] Model: ${model} Key: ...${key.slice(-4)}`);
            const ai = new GoogleGenAI({ apiKey: key });
            const response = await ai.models.generateContent({
                model: model,
                contents: {
                    role: 'user',
                    parts: [{ text: prompt }]
                }
            });
            return response.text || "Gemini 未回傳任何內容。";
        };

        const tryKeysForModel = async (model: string): Promise<string | null> => {
            for (const key of keys) {
                try {
                    return await executeGemini(key, model);
                } catch (err: any) {
                    const msg = err.message || '';
                    if (msg.includes('429') || msg.includes('Quota') || msg.includes('RESOURCE_EXHAUSTED')) {
                        console.warn(`[Gemini] Key ...${key.slice(-4)} quota exhausted on ${model}. Trying next...`);
                        continue;
                    }
                    throw err; // Other errors (400, 500) fail fast usually
                }
            }
            return null; // All keys exhausted for this model
        };

        // 1. Try Primary Model (user setting or default 2.0-flash)
        const primaryModel = settings.geminiAnalysisModel || 'gemini-2.5-flash';
        let result = await tryKeysForModel(primaryModel);
        if (result) return result;

        // 2. Fallback to gemini-2.5-flash-lite if primary wasn't it
        if (primaryModel !== 'gemini-2.5-flash-lite') {
            console.warn(`[Gemini] All keys failed on ${primaryModel}. Falling back to gemini-2.5-flash-lite...`);
            result = await tryKeysForModel('gemini-2.5-flash-lite');
            if (result) return result;
        }

        throw new Error("Gemini 配額不足 (所有 Key 皆已耗盡)。請稍後再試。");
    }

    throw new Error(`供應商 ${settings.provider} 尚未實作。`);
}

export const testOpenRouterConnection = async (apiKey: string, model: string): Promise<{ success: boolean; message: string }> => {
    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://github.com/jerryXpro/MeetSec-AI",
                "X-Title": "MeetSec-AI Connect Test"
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "user", content: "Hi" }
                ],
                max_tokens: 5
            })
        });

        if (!response.ok) {
            const err = await response.json();
            const msg = err.error?.message || response.statusText;
            console.error("OpenRouter Test Error:", err);
            return { success: false, message: `連線失敗 (${response.status}): ${msg}` };
        }

        return { success: true, message: "OpenRouter 連線成功！" };
    } catch (e: any) {
        return { success: false, message: `連線錯誤: ${e.message}` };
    }
};

export const testCustomConnection = async (baseUrl: string, apiKey: string, model: string): Promise<{ success: boolean; message: string }> => {
    try {
        const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
        // Try simple chat completion
        const response = await fetch(`${cleanBaseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey || 'sk-no-key-required'}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "user", content: "Hi" }
                ],
                max_tokens: 5
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            const msg = err.error?.message || response.statusText;
            console.error("Custom LLM Test Error:", err);
            return {
                success: false,
                message: `連線失敗 (${response.status}): ${msg} (請確認 Ollama/LocalAI 已啟動並允許外部連線)`
            };
        }

        return { success: true, message: "本地端/自訂模型 連線成功！" };
    } catch (e: any) {
        return {
            success: false,
            message: `連線錯誤: ${e.message}. 請確認 URL 是否正確 (例如 http://localhost:11434/v1)`
        };
    }
};