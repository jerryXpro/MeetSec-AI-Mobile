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

  constructor() { }

  setMute(muted: boolean) {
    this.isMuted = muted;
  }

  setAiMute(muted: boolean) {
    this.isAiMuted = muted;
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
          3. **保持專業**：雖然主動，但不要過度打斷或是廢話。發言應精簡有力。
          `;
      } else {
        // Default to Passive
        modelInstructions = `
          你是 ${options.appName}，一個專業的會議紀錄員與被動觀察者。
          
          【核心指令 - 被動模式】
          1. **絕對保持安靜**：你的預設模式是「靜默聆聽」。除非使用者明確呼叫你的名字（例如：「小助理」、「Assistant」、「會議助手」）或向你提問，否則**絕對不要發言**。
          2. **準確紀錄**：你的主要任務是聆聽並準確轉錄所有對話內容。
          3. **被動回應**：只有在被呼叫時，才提供簡短、精確的協助或回答。不要主動提供建議，不要主動打招呼。
          `;
      }

      const baseSystemPrompt = modelInstructions;

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
