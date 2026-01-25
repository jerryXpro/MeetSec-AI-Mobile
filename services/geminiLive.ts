import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, base64ToBytes, decodeAudioData, AudioMixer, encodeWAV, downsampleBuffer } from '../utils/audioUtils';
import { ConnectionState } from '../types';

interface GeminiLiveOptions {
  apiKey: string;
  appName: string; // New
  model: string;
  voiceName: string;
  systemInstruction?: string;
  previousContext?: string | null;
  useSystemAudio?: boolean;
  recordingLanguage?: string;
  microphoneId?: string;
  noiseThreshold?: number;
  interactionMode?: 'passive' | 'active';
  onStateChange: (state: ConnectionState) => void;
  onTranscript: (text: string, role: 'user' | 'model', isPartial: boolean, audioBlob?: Blob) => void;
  onAudioData: (volume: number) => void;
  onError: (error: string) => void;
  onSessionEnd?: (audioBlob: Blob) => void;
}

export class GeminiLiveService {
  private ai: GoogleGenAI | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private mixer: AudioMixer | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private active = false;
  private isMuted = false;
  private isAiMuted = false;

  private isUserInitiatedStop = false;
  private retryCount = 0;
  private maxRetries = 3;
  private currentOptions: GeminiLiveOptions | null = null;
  private reconnectTimeoutId: any = null;
  private connectionStartTime = 0;

  private currentInputTranscription = '';
  private currentOutputTranscription = '';

  private userAudioChunks: Float32Array[] = [];
  private modelAudioChunks: Float32Array[] = [];
  private currentSession: any = null; // Store session for sending text

  constructor() { }

  setMute(muted: boolean) {
    this.isMuted = muted;
  }

  setAiMute(muted: boolean) {
    this.isAiMuted = muted;
  }

  // Allow sending text messages to the live session
  async sendTextMessage(text: string) {
    if (!this.active || !this.currentSession) {
      console.warn("Cannot send text message: Session not active");
      return;
    }

    try {
      console.log("[GeminiLive] Sending text message:", text);

      // 1. Send Text Turn using the correct SDK method
      // The SDK's Session class does not have a generic `send` method, but has `sendClientContent`.
      // It handles wrapping into { clientContent: ... } automatically.
      await this.currentSession.sendClientContent({
        turns: [
          {
            role: 'user',
            parts: [{ text: text }]
          }
        ],
        turnComplete: true
      });

      // 2. Hack Restored: Send a tiny silent audio frame to force the model to "wake up"
      // This is often needed if the model is purely expecting audio flow
      try {
        const silence = new Float32Array(160); // 10ms at 16kHz
        const pcmBlob = createPcmBlob(silence);
        // Don't await this, just fire and forget to wake up the socket
        this.currentSession.sendRealtimeInput({ media: pcmBlob });
      } catch (e) {
        console.warn("Failed to send silence trigger", e);
      }

      // Locally echo
      if (this.currentOptions) {
        this.currentOptions.onTranscript(text, 'user', false);
      }
    } catch (e) {
      console.error("Failed to send text message:", e);
    }
  }

  async connect(options: GeminiLiveOptions) {
    this.currentOptions = options;
    this.isUserInitiatedStop = false; // Reset flag on new connection

    if (this.active) return;

    try {
      if (this.retryCount === 0) {
        options.onStateChange(ConnectionState.CONNECTING);
      } else {
        options.onStateChange(ConnectionState.RECONNECTING);
      }

      this.ai = new GoogleGenAI({ apiKey: options.apiKey });

      // Use system default sample rate (usually 44.1k or 48k) for better recording quality
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      const audioConstraints = {
        echoCancellation: true,
        deviceId: options.microphoneId ? { exact: options.microphoneId } : undefined
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });

      let combinedStream = this.mediaStream;
      if (options.useSystemAudio) {
        try {
          this.systemStream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: 1, height: 1 },
            audio: { echoCancellation: true }
          });

          this.mixer = new AudioMixer(this.audioContext);
          this.mixer.addStream(this.mediaStream);
          this.mixer.addStream(this.systemStream);
          combinedStream = this.mixer.getMixedStream();
        } catch (e) {
          console.warn("System audio denied or cancelled:", e);
        }
      }

      this.recordedChunks = [];
      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

        this.mediaRecorder = new MediaRecorder(combinedStream, { mimeType });

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
          if (options.onSessionEnd) {
            options.onSessionEnd(blob);
          }
        };

        this.mediaRecorder.start(1000);
      } catch (e) {
        console.error("Failed to initialize MediaRecorder:", e);
      }

      let modelInstructions = "";
      if (options.interactionMode === 'active') {
        modelInstructions = `
          你是 ${options.appName}，一個專業且積極的會議協作者。

          【核心指令 - 主動模式】
          1. **積極參與**：你不只是紀錄者，更是與會者。請仔細聆聽討論，並在適當時機**簡短地**提供價值。
          2. **適時介入**：
             - 當發現討論偏題時，溫和地提醒。
             - 當有人提出問題無人回答時，嘗試提供答案。
             - 當討論陷入僵局時，提供新的觀點或總結目前進度。
          3. **例外狀況 (ALWAYS RESPOND)**：
             - **最高優先順序**: 當收到**文字訊息** (Text Message) 時，代表使用者正在直接對你說話。**必須**立即回答，忽略其他規則。
             - **一般規範**: 保持專業，但不要過度打斷或是廢話。發言應精簡有力。
          `;
      } else {
        // Default to Passive
        modelInstructions = `
          你是 ${options.appName} (也可稱為「小助手」)，在這場會議中擔任**靜默的紀錄者**。
          
          3. **例外狀況 (ALWAYS RESPOND)**：
             - **最高優先順序**: 當收到**文字訊息** (Text Message) 時，代表使用者正在直接對你說話。**必須**立即回答，忽略任何靜默規則。
             - **次要**: 當使用者明確說出喚醒詞（如「小助手」、「${options.appName}」）時，也請立即回答。
             
          4. **回應原則**：
             - 被呼叫或收到文字時，請簡短、直接地回答問題。
             - 回答完畢後，請繼續保持聆聽。
          `;
      }

      // Add Image Generation Capability Instruction
      const imageInstruction = `
      【圖片生成能力】
      如果使用者要求看圖片、照片或視覺範例（例如："給我看一張...的照片"），請務必使用以下 Markdown 格式產生圖片連結：
      ![描述](https://image.pollinations.ai/prompt/{描述}?width=1024&height=768&nologo=true)
      
      規則：
      1. {描述} 必須是詳細的英文描述。例如：使用者說「給我看一隻貓」，你輸出 \`![Cat](https://image.pollinations.ai/prompt/cute%20cat%20fluffy?width=1024&height=768&nologo=true)\`
      2. 不要解釋你在產生圖片，直接給出 Markdown 連結即可。
      `;

      const baseSystemPrompt = modelInstructions + "\n" + imageInstruction;

      let contextPrompt = "";
      if (options.previousContext) {
        contextPrompt = `
          \n【重要：上次會議摘要】
          以下是使用者上傳的上一次會議摘要。請將其視為你已知悉的背景知識。
          
          === 上次會議摘要開始 ===
          ${options.previousContext}
          === 上次會議摘要結束 ===

          `;
      }

      let languagePrompt = "";
      if (options.recordingLanguage === 'zh-TW') {
        languagePrompt = "這場會議主要使用【繁體中文(台灣)】進行。請使用繁體中文準確轉錄，特別注意台灣的專業術語與慣用語。";
      } else if (options.recordingLanguage === 'en-US') {
        languagePrompt = "This meeting is primarily in English (US). Transcribe accurately.";
      } else if (options.recordingLanguage === 'ja-JP') {
        languagePrompt = "この会議は主に【日本語】で行われます。正確に書き起こしてください。";
      }

      const finalSystemInstruction = `${baseSystemPrompt}\n${contextPrompt}\n${languagePrompt}\n${options.systemInstruction || ''}`;

      const config = {
        model: options.model,
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: options.voiceName } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: finalSystemInstruction,
      };

      const sessionPromise = this.ai.live.connect({
        model: config.model,
        config: config,
        callbacks: {
          onopen: async () => {
            options.onStateChange(ConnectionState.CONNECTED);
            this.active = true;
            this.connectionStartTime = Date.now();
            try {
              this.currentSession = await sessionPromise;
              console.log("[GeminiLive] Session established:", this.currentSession);
            } catch (e) {
              console.error("[GeminiLive] Failed to capturing session object:", e);
            }
            this.startAudioStreaming(sessionPromise, combinedStream);

            if (options.previousContext) {
              // Silent mode: AI passively receives context. No active greeting.
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            this.handleMessage(message, options);
          },
          onclose: () => {
            this.active = false;
            // Only reset retry count if the session lasted longer than 5 seconds (stable connection)
            if (Date.now() - this.connectionStartTime > 5000) {
              this.retryCount = 0;
            }

            if (!this.isUserInitiatedStop) {
              this.handleUnexpectedDisconnect();
            } else {
              options.onStateChange(ConnectionState.DISCONNECTED);
              this.stop();
            }
          },
          onerror: (err: any) => {
            options.onStateChange(ConnectionState.ERROR);
            options.onError(err.message || "Unknown error");
            this.stop();
          }
        }
      });

      await sessionPromise;

    } catch (error: any) {
      options.onStateChange(ConnectionState.ERROR);
      options.onError(error.message);
      this.stop();
    }
  }

  private startAudioStreaming(sessionPromise: Promise<any>, stream: MediaStream) {
    if (!this.audioContext) return;

    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
    this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (e) => {
      if (!this.active) return;

      const inputData = e.inputBuffer.getChannelData(0);

      const inputSampleRate = this.audioContext?.sampleRate || 16000;

      // Downsample to 16kHz for AI processing if needed
      const downsampledData = downsampleBuffer(inputData, inputSampleRate, 16000);

      let sum = 0;
      for (let i = 0; i < downsampledData.length; i++) {
        sum += downsampledData[i] * downsampledData[i];
      }
      const rms = Math.sqrt(sum / downsampledData.length);

      // Use dynamic threshold from options, default to 0.002 if not set
      const threshold = this.currentOptions?.noiseThreshold !== undefined ? this.currentOptions.noiseThreshold : 0.002;

      let processedData = downsampledData;
      if (this.isMuted || rms < threshold) {
        processedData = new Float32Array(downsampledData.length); // Silence
      }

      const inputDataCopy = new Float32Array(processedData);
      this.userAudioChunks.push(inputDataCopy);

      const pcmBlob = createPcmBlob(processedData);
      sessionPromise.then((session) => {
        if (this.active) {
          session.sendRealtimeInput({ media: pcmBlob });
        }
      });
    };

    this.sourceNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.audioContext.destination);
  }

  private flattenAudioChunks(chunks: Float32Array[]): Float32Array {
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  private async handleMessage(message: LiveServerMessage, options: GeminiLiveOptions) {
    if (!this.audioContext) return;

    // Debug logging to see how server responds to text injection
    if (Object.keys(message.serverContent || {}).length > 0) {
      // console.log("[GeminiLive] Server Content:", JSON.stringify(message.serverContent).substring(0, 200));
    }


    if (message.serverContent?.outputTranscription) {
      const text = message.serverContent.outputTranscription.text;
      this.currentOutputTranscription += text;
      options.onTranscript(this.currentOutputTranscription, 'model', true);
    } else if (message.serverContent?.inputTranscription) {
      const text = message.serverContent.inputTranscription.text;
      this.currentInputTranscription += text;
      options.onTranscript(this.currentInputTranscription, 'user', true);
    }

    if (message.serverContent?.turnComplete) {
      if (this.currentInputTranscription.trim()) {
        const userAudioData = this.flattenAudioChunks(this.userAudioChunks);
        // @ts-ignore
        const wavBlob = encodeWAV(userAudioData, 16000).nativeBlob as Blob;
        options.onTranscript(this.currentInputTranscription, 'user', false, wavBlob);
        this.userAudioChunks = [];
      }

      if (this.currentOutputTranscription.trim()) {
        const modelAudioData = this.flattenAudioChunks(this.modelAudioChunks);
        // @ts-ignore
        const wavBlob = encodeWAV(modelAudioData, 24000).nativeBlob as Blob;
        options.onTranscript(this.currentOutputTranscription, 'model', false, wavBlob);
        this.modelAudioChunks = [];
      }

      this.currentInputTranscription = '';
      this.currentOutputTranscription = '';
    }

    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64Audio) {
      options.onAudioData(0.5);
      this.nextStartTime = Math.max(this.nextStartTime, this.audioContext.currentTime);

      const audioBytes = base64ToBytes(base64Audio);

      const int16 = new Int16Array(audioBytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }
      this.modelAudioChunks.push(float32);

      if (!this.isAiMuted) {
        const audioBuffer = await decodeAudioData(audioBytes, this.audioContext, 24000, 1);
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        source.addEventListener('ended', () => this.sources.delete(source));
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
        this.sources.add(source);
      }
    }

    if (message.serverContent?.interrupted) {
      this.sources.forEach(source => { try { source.stop(); } catch (e) { } });
      this.sources.clear();
      this.nextStartTime = 0;
      this.currentOutputTranscription = '';
      this.modelAudioChunks = [];
      options.onTranscript('', 'model', true);
    }
  }

  async stop() {
    this.isUserInitiatedStop = true;
    this.active = false;

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    this.mediaStream?.getTracks().forEach(track => track.stop());
    this.systemStream?.getTracks().forEach(track => track.stop());
    if (this.mixer) this.mixer.cleanup();
    this.sourceNode?.disconnect();
    this.scriptProcessor?.disconnect();
    if (this.audioContext) await this.audioContext.close();
    this.mediaStream = null;
    this.systemStream = null;
    this.audioContext = null;
    this.userAudioChunks = [];
    this.modelAudioChunks = [];
    this.isMuted = false;
    this.isAiMuted = false;
    this.retryCount = 0;
  }

  private async handleUnexpectedDisconnect() {
    if (!this.currentOptions) return;

    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      const delay = Math.pow(2, this.retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s

      console.log(`Connection lost. Retrying in ${delay}ms... (Attempt ${this.retryCount}/${this.maxRetries})`);
      this.currentOptions.onStateChange(ConnectionState.RECONNECTING);

      this.reconnectTimeoutId = setTimeout(async () => {
        // Clean up previous AI/WebSocket resources but keep audio streams if possible?
        // Simplest approach: full reconnect but reuse options
        // To be safe: fully stop previous internals (except we don't want to kill the UI state) 
        // Ideally we should keep the AudioContext alive but for stability let's restart fresh

        // NOTE: We need to be careful not to kill the mediaStream if we want seamless resumption, 
        // but 'stop()' kills tracks. Let's try to just re-call connect() which re-initializes.
        // However, connect() creates NEW streams. 
        // To avoid permission prompts, detailed implementation would be needed. 
        // For now, let's allow full teardown and re-setup which is safer to clear bad states.

        // We need to temporarily set isUserInitiatedStop to true so stop() doesn't trigger ANOTHER loop, 
        // BUT we are already inside the "onclose" which triggered this.
        // We just need to make sure 'stop()' cleans up.

        // Partial cleanup without full reset might be better, but 'connect' allocates new everything.
        await this.stopInternalForRetry();
        if (this.currentOptions) {
          await this.connect(this.currentOptions);
        }
      }, delay);
    } else {
      console.log("Max retries reached. Giving up.");
      this.currentOptions.onStateChange(ConnectionState.DISCONNECTED);
      this.stop();
    }
  }

  private async stopInternalForRetry() {
    // Helper to clean up previous session resources without resetting flags like retryCount
    this.active = false;
    // Don't set isUserInitiatedStop because we ARE coming back

    this.mediaStream?.getTracks().forEach(track => track.stop());
    this.systemStream?.getTracks().forEach(track => track.stop());
    if (this.mixer) this.mixer.cleanup();
    this.sourceNode?.disconnect();
    this.scriptProcessor?.disconnect();
    if (this.audioContext) await this.audioContext.close();

    this.mediaStream = null;
    this.systemStream = null;
    this.audioContext = null;
    // Keep chunks? Maybe. But new session might send new history context if configured.
    // For now, clear buffer to avoid sync issues.
    this.userAudioChunks = [];
    this.modelAudioChunks = [];
  }
}
