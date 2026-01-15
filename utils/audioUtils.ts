// @ts-ignore
// import * as lamejs from 'lamejs';
import * as Mp4Muxer from 'mp4-muxer';
import * as WebmMuxer from 'webm-muxer';

export function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export interface AudioData {
  data: string;
  mimeType: string;
  nativeBlob?: Blob;
}

export function createPcmBlob(data: Float32Array): AudioData {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return {
    data: bytesToBase64(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// New: Encode raw PCM samples to WAV format so they can be played in <audio> elements
export function encodeWAV(samples: Float32Array, sampleRate: number = 16000): AudioData {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF identifier
  writeString(0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(8, 'WAVE');
  // format chunk identifier
  writeString(12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(36, 'data');
  // data chunk length
  view.setUint32(40, samples.length * 2, true);

  // Write the PCM samples
  const length = samples.length;
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return {
    data: "",
    mimeType: "audio/wav",
    // @ts-ignore
    nativeBlob: new window.Blob([view], { type: 'audio/wav' })
  };
}

export function encodeWAVToBlob(samples: Float32Array, sampleRate: number = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(8, 'WAVE');
  /* format chunk identifier */
  writeString(12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  const length = samples.length;
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new window.Blob([view], { type: 'audio/wav' });
}

export function encodeMP3(samples: Float32Array, sampleRate: number = 44100): Blob {
  // Use global lamejs loaded via script tag
  // @ts-ignore
  const lame = (window as any).lamejs;
  if (!lame) {
    console.error("lamejs not loaded globally");
    throw new Error("lamejs library not loaded. Check script tag.");
  }

  const Mp3Encoder = lame.Mp3Encoder;
  const channels = 1; // Mono
  const kbps = 128;
  const mp3encoder = new Mp3Encoder(channels, sampleRate, kbps);

  // Convert Float32 to Int16
  const sampleData = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    sampleData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  const mp3Data: Int8Array[] = [];

  const mp3buf = mp3encoder.encodeBuffer(sampleData);
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf);
  }

  const mp3end = mp3encoder.flush();
  if (mp3end.length > 0) {
    mp3Data.push(mp3end);
  }

  // Cast to any to avoid strict ArrayBufferLike mismatch with BlobPart
  return new Blob(mp3Data as any[], { type: 'audio/mp3' });
}

// New: Mixer for System + Mic
export class AudioMixer {
  private ctx: AudioContext;
  private merger: ChannelMergerNode;
  private sources: MediaStreamAudioSourceNode[] = [];
  private destination: MediaStreamAudioDestinationNode;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.merger = ctx.createChannelMerger(2); // Stereo processing
    this.destination = ctx.createMediaStreamDestination();
    this.merger.connect(this.destination);
  }

  addStream(stream: MediaStream) {
    const source = this.ctx.createMediaStreamSource(stream);
    // Connect source to merger. 
    // Note: In a real app we might want GainNodes here for individual volume control
    source.connect(this.merger);
    this.sources.push(source);
  }

  getMixedStream(): MediaStream {
    return this.destination.stream;
  }

  cleanup() {
    this.sources.forEach(s => s.disconnect());
    this.merger.disconnect();
    this.sources = [];
  }
}

export function downsampleBuffer(buffer: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array {
  if (outputSampleRate >= inputSampleRate) {
    return buffer;
  }
  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    // Simple averaging (low-pass filter effect) to prevent aliasing
    let accum = 0, count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

export async function convertAudioFast(
  audioBuffer: AudioBuffer,
  format: 'm4a' | 'webm',
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<Blob> {
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels; // usually 1 or 2
  const duration = audioBuffer.duration;

  if (signal?.aborted) {
    throw new Error('AbortError');
  }

  // Configuration based on format
  let muxer: any;
  let audioEncoderConfig: AudioEncoderConfig;

  if (format === 'm4a') {
    muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      audio: {
        codec: 'mp4a.40.2', // AAC LC
        numberOfChannels,
        sampleRate
      },
      fastStart: 'in-memory',
    });
    audioEncoderConfig = {
      codec: 'mp4a.40.2' as any, // "aac" is not always reliable string, use specific profile
      sampleRate,
      numberOfChannels,
      bitrate: 128_000,
    };
  } else {
    // WebM
    muxer = new WebmMuxer.Muxer({
      target: new WebmMuxer.ArrayBufferTarget(),
      audio: {
        codec: 'Z', // Opus
        numberOfChannels,
        sampleRate,
        bitDepth: 0 // Opus doesn't use bit depth
      }
    });
    audioEncoderConfig = {
      codec: 'opus',
      sampleRate,
      numberOfChannels,
      // Opus is adaptable, but we can set a target bitrate
      bitrate: 128_000,
    };
  }

  const encoder = new AudioEncoder({
    output: (chunk, meta) => {
      muxer.addAudioChunk(chunk, meta);
    },
    error: (e) => {
      console.error(e);
      throw new Error(`Encoding failed: ${e.message}`);
    }
  });

  encoder.configure(audioEncoderConfig);

  // Process data in chunks
  const data = new Float32Array(audioBuffer.length * numberOfChannels);
  // Interleave if stereo
  if (numberOfChannels === 1) {
    data.set(audioBuffer.getChannelData(0));
  } else {
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.getChannelData(1);
    for (let i = 0; i < audioBuffer.length; i++) {
      data[i * 2] = ch0[i];
      data[i * 2 + 1] = ch1[i];
    }
  }

  // AudioData requires planar data for some codecs, but AudioData constructor 
  // takes interleaved data for simple float32 format. 
  // Correction: AudioData init dictionary wants `data` as BufferSource.
  // We can create AudioData frame by frame.

  // Actually, WebCodecs AudioEncoder works best by feeding it AudioData objects.
  // One AudioData object can hold a chunk of samples.
  // 1 second definition: 
  const chunkSize = sampleRate; // 1 second of audio
  const totalSamples = audioBuffer.length;

  try {
    for (let i = 0; i < totalSamples; i += chunkSize) {
      if (signal?.aborted) {
        throw new Error('AbortError');
      }

      const length = Math.min(chunkSize, totalSamples - i);
      const timestamp = (i / sampleRate) * 1_000_000; // microseconds

      // Extract chunk data (interleaved)
      const chunkData = new Float32Array(length * numberOfChannels);
      if (numberOfChannels === 1) {
        chunkData.set(data.subarray(i, i + length));
      } else {
        chunkData.set(data.subarray(i * 2, (i + length) * 2));
      }

      const audioData = new AudioData({
        format: 'f32',
        sampleRate,
        numberOfChannels,
        numberOfFrames: length,
        timestamp,
        data: chunkData
      });

      encoder.encode(audioData);
      audioData.close();

      if (onProgress) {
        onProgress(Math.min(99, Math.round(((i + length) / totalSamples) * 100)));
      }

      // Yield to UI
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    await encoder.flush();
    muxer.finalize();

    const buffer = muxer.target.buffer;
    return new Blob([buffer], { type: format === 'm4a' ? 'audio/mp4' : 'audio/webm' });
  } finally {
    // Ensure encoder is closed if we abort
    if (encoder.state !== 'closed') {
      encoder.close();
    }
  }
}