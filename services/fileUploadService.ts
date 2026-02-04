import { GoogleGenAI } from "@google/genai";
import { AppSettings } from "../types";

/**
 * Universal Transcription Service
 * Supports:
 * 1. Google Gemini (via Native Audio API)
 * 2. OpenAI Whisper (via API)
 * 3. Local LLMs (LM Studio/Ollama) if they support OpenAI-compatible /v1/audio/transcriptions
 */

export const transcribeAudioFile = async (
  file: File,
  settings: AppSettings
): Promise<string> => {

  if (settings.provider === 'gemini') {
    return await transcribeWithGemini(file, settings);
  }

  if (settings.provider === 'openai') {
    return await transcribeWithOpenAI(file, settings);
  }

  throw new Error(`未知的供應商 (Unknown Provider): ${settings.provider}`);
};


// --- Provider Implementations ---

/**
 * Google Gemini Implementation (Multimodal) with Key Rotation & Fallback
 */
const transcribeWithGemini = async (file: File, settings: AppSettings): Promise<string> => {
  const rawKeys = settings.apiKeys.gemini;
  if (!rawKeys) {
    throw new Error("請先設定 Gemini API Key");
  }

  // Parse keys (comma or newline separated)
  const keys = rawKeys.split(/[,;\n]+/).map(k => k.trim()).filter(k => k.length > 0);
  if (keys.length === 0) throw new Error("無效的 API Key");

  // Helper: Try a specific key and model
  const executeTranscribe = async (key: string, model: string, retryCount = 0): Promise<string> => {
    // 1. Convert File to Base64 (Only once effectively, but cheap to redo)
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const ai = new GoogleGenAI({ apiKey: key });

    // System Prompt
    const languageInstruction = settings.recordingLanguage === 'ja-JP'
      ? "The audio is in Japanese. Transcribe in Japanese."
      : settings.recordingLanguage === 'en-US'
        ? "The audio is in English. Transcribe in English."
        : "The audio is in Traditional Chinese (Taiwan). Transcribe in Traditional Chinese.";

    const systemPrompt = `
      You are an expert audio transcriber specializing in **Speaker Diarization**.
      **Context**: ${languageInstruction}
      **CRITICAL**: Distinguish speakers (Speaker 1, Speaker 2) clearly.
      **Format**: [MM:SS] Speaker Name: Content
    `;

    // MimeType Fallback
    let mimeType = file.type;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!mimeType || mimeType === 'audio/x-m4a' || mimeType === '') {
      const map: Record<string, string> = {
        'mp3': 'audio/mp3', 'wav': 'audio/wav', 'm4a': 'audio/mp4', 'aac': 'audio/aac',
        'flac': 'audio/flac', 'ogg': 'audio/ogg', 'webm': 'audio/webm'
      };
      mimeType = map[ext || ''] || 'audio/mp3';
    }

    console.log(`[Gemini Transcribe] ${file.name} (${mimeType}) Model: ${model} Key: ...${key.slice(-4)}`);

    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: systemPrompt }
          ]
        }
      });
      return response.text || "無法識別音訊內容 (Gemini returned empty).";

    } catch (error: any) {
      const msg = error.message || '';
      console.warn(`[Gemini Error] ${model} failed:`, msg);

      // Check for Quota/Rate Limit Errors
      if (msg.includes('429') || msg.includes('Quota') || msg.includes('Resource has been exhausted')) {
        throw new Error('QUOTA_EXCEEDED');
      }
      throw error;
    }
  };

  // Rotation Logic
  let lastError = null;

  // Try Primary Model (gemini-2.0-flash) with all keys
  const primaryModel = settings.geminiTranscriptionModel || 'gemini-2.0-flash';

  for (const key of keys) {
    try {
      return await executeTranscribe(key, primaryModel);
    } catch (err: any) {
      if (err.message === 'QUOTA_EXCEEDED') {
        console.warn(`Key ...${key.slice(-4)} exhausted on ${primaryModel}, trying next key...`);
        lastError = err;
        continue;
      }
      // If genuine error (not 429), maybe fail immediately or try next key? 
      // Safe to try next key mostly.
      lastError = err;
      console.warn(`Key ...${key.slice(-4)} error: ${err.message}, trying next key...`);
    }
  }

  // If we are here, all keys failed on Primary Model.
  // Fallback: Try Stable Model (gemini-1.5-flash) with all keys
  // Only if the primary wasn't already 1.5-flash
  if (primaryModel !== 'gemini-1.5-flash') {
    console.warn("All keys failed on primary model. Attempting fallback to gemini-1.5-flash...");

    for (const key of keys) {
      try {
        return await executeTranscribe(key, 'gemini-1.5-flash');
      } catch (err: any) {
        lastError = err;
        if (err.message === 'QUOTA_EXCEEDED') continue;
      }
    }
  }

  // Final failure
  if (lastError?.message === 'QUOTA_EXCEEDED') {
    throw new Error(`Gemini 配額不足 (所有 Key 皆已耗盡)。請稍後再試，或使用 OpenAI / Local 模式。`);
  }

  throw new Error(`Gemini 轉錄失敗: ${lastError?.message || '未知錯誤'}`);
};

/**
 * OpenAI Whisper Implementation
 */
const transcribeWithOpenAI = async (file: File, settings: AppSettings): Promise<string> => {
  if (!settings.apiKeys.openai) {
    throw new Error("請先設定 OpenAI API Key (用於 Whisper 轉錄)");
  }

  console.log(`[OpenAI Whisper] Uploading ${file.name}...`);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "whisper-1");

  // Language hint (ISO-639-1)
  if (settings.recordingLanguage === 'zh-TW') formData.append("language", "zh");
  else if (settings.recordingLanguage === 'ja-JP') formData.append("language", "ja");
  else if (settings.recordingLanguage === 'en-US') formData.append("language", "en");

  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.apiKeys.openai}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.text || "OpenAI 未回傳轉錄文字。";

  } catch (error: any) {

    if (error.message?.includes('exceeded your current quota') || error.message?.includes('429')) {
      throw new Error("OpenAI 額度不足或已過期 (Quota Exceeded)。請檢查您的 Billing 設定或餘額。");
    }
    throw new Error(`OpenAI 轉錄失敗: ${error.message}`);
  }
};

