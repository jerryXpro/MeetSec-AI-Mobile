import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, base64ToBytes, decodeAudioData, AudioMixer, encodeWAV } from '../utils/audioUtils';
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

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

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

      const baseSystemPrompt = `
      你是 ${options.appName}，一個超越被動轉錄的會議生產力專家。
      你的任務是：
      1. 聆聽即時對話，理解語意與情境。
      2. 準確轉錄所有語音內容。
      3. 預測需求，隨時準備提供建議或任務追蹤。
      4. 展現全面的記憶能力，保持對話情境的連續性。
      `;

      let contextPrompt = "";
      if (options.previousContext) {
        contextPrompt = `
          \n【重要：上次會議摘要】
          以下是使用者上傳的上一次會議摘要。請將其視為你已知悉的背景知識。
          
          === 上次會議摘要開始 ===
          ${options.previousContext}
          === 上次會議摘要結束 ===

          \n【指令】
          當你接收到「請回顧上次會議」的訊號（或會議剛開始）時，請主動向與會者打招呼，並「口頭朗讀」這份摘要的重點回顧。語氣要專業且流暢，幫助大家快速進入狀況。
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
            this.retryCount = 0; // Reset retries on successful connection
            this.startAudioStreaming(sessionPromise, combinedStream);

            if (options.previousContext) {
              const session = await sessionPromise;
              session.send({
                parts: [{ text: "會議開始了。請向大家問好，並根據我提供的上次會議摘要，向大家朗讀重點回顧，幫助我們銜接進度。" }],
                role: "user"
              });
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            this.handleMessage(message, options);
          },
          onclose: () => {
            this.active = false;
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

      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);

      const NOISE_THRESHOLD = 0.01;

      let processedData = inputData;
      if (this.isMuted || rms < NOISE_THRESHOLD) {
        processedData = new Float32Array(inputData.length);
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
