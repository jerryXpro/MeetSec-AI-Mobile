import { GoogleGenAI } from "@google/genai";
import { AppSettings } from "../types";

export const transcribeAudioFile = async (
  file: File,
  settings: AppSettings
): Promise<string> => {
  if (!settings.apiKeys.gemini) {
    throw new Error("請先設定 Gemini API Key");
  }

  // 1. Convert File to Base64
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

  // 2. Initialize Gemini Client
  const ai = new GoogleGenAI({ apiKey: settings.apiKeys.gemini });

  // 3. Prepare Prompt
  // Use user-configured model, default to gemini-3-flash-preview if undefined
  const modelName = settings.geminiTranscriptionModel || 'gemini-3-flash-preview'; 

  const languageInstruction = settings.recordingLanguage === 'ja-JP'
    ? "The audio is in Japanese. Transcribe in Japanese."
    : settings.recordingLanguage === 'en-US'
    ? "The audio is in English. Transcribe in English."
    : "The audio is in Traditional Chinese (Taiwan). Transcribe in Traditional Chinese.";

  const systemPrompt = `
    You are an expert audio transcriber specializing in **Speaker Diarization**.
    
    **Context**: ${languageInstruction}
    
    **CRITICAL INSTRUCTION**: 
    The user is complaining that previous transcriptions confused different speakers. 
    You MUST distinguish between different voices clearly.
    
    **Rules**:
    1. **Identify Speakers**: Listen carefully to voice pitch, tone, and pause patterns. Assign a unique label to each distinct voice (e.g., "Speaker 1", "Speaker 2").
    2. **Infer Roles/Names**: If a name is mentioned (e.g., "Hi David"), rename "Speaker X" to "David" for that and subsequent lines. If a role is clear (e.g., "Chairman"), use that.
    3. **Strict Formatting**: 
       - Every single line of output MUST follow this format exactly:
       - \`[MM:SS] Speaker Name: Content\`
       - Do not group long monologues into huge blocks without timestamps. Break them up every 30-60 seconds.
    4. **No Merging**: Never merge two different speakers into one paragraph. Always start a new line for a new speaker.
    5. **Output Only**: Do not include introductory text like "Here is the transcript". Just start with the first timestamp.

    **Example Output**:
    [00:00] Speaker 1: Welcome everyone to the meeting.
    [00:05] Speaker 2: Thanks. I have the report ready.
    [00:10] Speaker 1: Great, let's hear it.
  `;

  // Determine correct MIME type for Gemini
  // Browsers sometimes detect .m4a as empty or audio/x-m4a, which Gemini might reject.
  // Gemini expects standard types like audio/mp3, audio/wav, audio/aac, audio/mp4 (for m4a), etc.
  let mimeType = file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (!mimeType || mimeType === 'audio/x-m4a') {
      if (ext === 'mp3') mimeType = 'audio/mp3';
      else if (ext === 'wav') mimeType = 'audio/wav';
      else if (ext === 'aac') mimeType = 'audio/aac';
      else if (ext === 'm4a') mimeType = 'audio/mp4'; // Gemini treats m4a usually as audio/mp4 container
      else if (ext === 'flac') mimeType = 'audio/flac';
      else if (ext === 'ogg') mimeType = 'audio/ogg';
      else if (ext === 'aiff') mimeType = 'audio/aiff';
      else if (ext === 'webm') mimeType = 'audio/webm';
  }

  // 4. Call API
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/mp3', // Fallback
              data: base64Data
            }
          },
          {
            text: systemPrompt
          }
        ]
      }
    });

    return response.text || "無法識別音訊內容。";
  } catch (error: any) {
    console.error("Transcription Error:", error);
    throw new Error(error.message || "音檔轉錄失敗");
  }
};