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
    contextFiles?: ContextFile[]
): Promise<string> => {
    const transcript = formatTranscript(messages, settings.appName);
    const filesContent = formatContextFiles(contextFiles);

    const hasTranscript = transcript.trim().length > 0;
    const hasFiles = filesContent.trim().length > 0;

    // Only throw if NO transcript AND NO custom instruction AND NO files
    if (!hasTranscript && (!customInstruction || !customInstruction.trim()) && !hasFiles) {
        throw new Error("尚無逐字稿內容或補充資料。請確保麥克風已開啟並開始說話，或上傳檔案，或輸入特定指令。");
    }

    const basePrompt = `
# 角色設定
你是一位專精於商業會議與學術討論的『${settings.appName} 執行秘書』。你的語氣專業、客觀且結構條理分明。

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

    // Apply custom instruction logic
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

    const systemPrompt = `
${finalPrompt}

---

【補充參考資料 (Context Files)】
${hasFiles ? filesContent : "(無)"}

---
    
【會議逐字稿內容】
${hasTranscript ? transcript : "(目前尚無逐字稿內容)"}
  `;

    return await callLLM(systemPrompt, settings);
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

async function callLLM(prompt: string, settings: AppSettings, retries = 3): Promise<string> {
    try {
        if (settings.provider === 'gemini') {
            if (!settings.apiKeys.gemini) throw new Error("請先在設定中輸入 Gemini API Key。");

            // Use hardcoded model if not set, BUT respect the user setting if present.
            // Note: The error message mentioned 'gemini-3-flash', so user might be using that.
            const modelName = settings.geminiAnalysisModel || 'gemini-2.0-flash-exp';

            const ai = new GoogleGenAI({ apiKey: settings.apiKeys.gemini });

            const response = await ai.models.generateContent({
                model: modelName,
                contents: {
                    role: 'user',
                    parts: [{ text: prompt }]
                }
            });
            return response.text || "Gemini 未回傳任何內容。";
        }

        if (settings.provider === 'openai') {
            if (!settings.apiKeys.openai) throw new Error("請先在設定中輸入 OpenAI API Key。");

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${settings.apiKeys.openai}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: `You are ${settings.appName}, a helpful meeting assistant.` },
                        { role: "user", content: prompt }
                    ]
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(`OpenAI Error: ${err.error?.message || response.statusText}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "OpenAI 未回傳任何內容。";
        }

        if (settings.provider === 'ollama') {
            const url = settings.ollamaUrl.replace(/\/$/, '');
            let response;
            try {
                response = await fetch(`${url}/api/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: "llama3",
                        messages: [
                            { role: "user", content: prompt }
                        ],
                        stream: false
                    })
                });
            } catch (e: any) {
                throw new Error(`無法連線至 Ollama (${url})。\n請檢查：\n1. Ollama 是否已啟動？\n2. 若為 HTTPS 網頁，無法連線 HTTP 本地服務(混合內容)。\n3. 是否開啟 CORS？(OLLAMA_ORIGINS="*")`);
            }

            if (!response.ok) throw new Error("Ollama 連線成功但回傳錯誤，請檢查模型名稱是否正確。");

            const data = await response.json();
            return data.message?.content || "Ollama 未回傳任何內容。";
        }

        if (settings.provider === 'lmstudio') {
            const url = settings.lmStudioUrl.replace(/\/$/, '');

            // Check if model is loaded (optional but good practice with LM Studio APIs)
            // Skipping detailed check for brevity unless errors persist.

            let response;
            try {
                response = await fetch(`${url}/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer lm-studio"
                    },
                    body: JSON.stringify({
                        model: "local-model",
                        messages: [
                            { role: "system", content: `You are ${settings.appName}.` },
                            { role: "user", content: prompt }
                        ],
                        temperature: 0.7
                    })
                });
            } catch (e: any) {
                throw new Error(`無法連線至 LM Studio (${url})。\n可能原因：\n1. LM Studio 未啟動 Server。\n2. 若網頁為 HTTPS (如 Vercel)，瀏覽器會阻擋連線至 HTTP (請改用 Localhost 開發或 ngrok)。\n3. 跨域 (CORS) 被阻擋 (請在 LM Studio 設定開啟 CORS)。\n4. 若使用區網 IP，請確認 LM Studio 允許外部連線。`);
            }

            if (!response.ok) throw new Error("已連線 LM Studio 但回傳錯誤，請確認模型是否已載入 (狀態應為 Loaded)。");

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "LM Studio 未回傳任何內容。";
        }

        if (settings.provider === 'anythingllm') {
            const url = settings.anythingLlmUrl.replace(/\/$/, '');
            let response;
            try {
                response = await fetch(`${url}/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${settings.apiKeys.anythingllm || 'dummy'}`
                    },
                    body: JSON.stringify({
                        model: "anythingllm",
                        messages: [
                            { role: "system", content: `You are ${settings.appName}.` },
                            { role: "user", content: prompt }
                        ]
                    })
                });
            } catch (e: any) {
                throw new Error(`無法連線至 AnythingLLM (${url})。\n請檢查 Server 狀態、CORS 設定或混合內容 (Mixed Content) 問題。`);
            }

            if (!response.ok) {
                let errorMsg = response.statusText;
                try {
                    const err = await response.json();
                    errorMsg = err.message || errorMsg;
                } catch (e) { }
                throw new Error(`AnythingLLM 回傳錯誤: ${errorMsg}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "AnythingLLM 未回傳任何內容。";
        }

        throw new Error(`供應商 ${settings.provider} 尚未實作。`);

    } catch (error: any) {
        // Handle Rate Limiting (429) specifically
        if (retries > 0 && (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED') || error.status === 429)) {
            // Try to extract wait time from error message, e.g., "Please retry in 57.89569092s."
            let waitSeconds = 20;
            const match = error.message?.match(/retry in\s+([0-9.]+)\s*s/i);
            if (match && match[1]) {
                waitSeconds = Math.ceil(parseFloat(match[1])) + 2; // Add 2s buffer
            } else if (error.message?.includes('Quota exceeded')) {
                // Fallback for quota exceeded which might be longer
                waitSeconds = 60;
            }

            console.warn(`Rate limit hit. Retrying in ${waitSeconds}s... (${retries} retries left)`);

            // Wait
            await sleep(waitSeconds * 1000);
            return callLLM(prompt, settings, retries - 1);
        }

        console.error("LLM Error:", error);
        throw new Error(error.message || "AI 處理失敗。");
    }
}