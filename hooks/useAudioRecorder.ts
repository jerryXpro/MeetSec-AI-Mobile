import { useState, useRef, useCallback, useEffect } from 'react';
import { encodeWAVToBlob, encodeMP3 } from '../utils/audioUtils';

export interface RecorderState {
    isRecording: boolean;
    duration: number; // in seconds
    volume: number; // 0-1
    frequencyData: Uint8Array;
    blob: Blob | null;
    error: string | null;
    isProcessing: boolean;
}

export type AudioFormat = 'wav' | 'webm' | 'mp3' | 'm4a';

export const useAudioRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0);
    const [frequencyData, setFrequencyData] = useState<Uint8Array>(new Uint8Array(128));
    const [blob, setBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);

    const chunksRef = useRef<Blob[]>([]);
    const audioBuffersRef = useRef<Float32Array[]>([]); // For WAV PCM data
    const startTimeRef = useRef<number>(0);
    const timerIntervalRef = useRef<number>(0);
    const rafRef = useRef<number>(0);
    const sampleRateRef = useRef<number>(44100);

    const formatRef = useRef<AudioFormat>('wav');

    const startRecording = useCallback(async (selectedDeviceId?: string, format: AudioFormat = 'wav') => {
        try {
            formatRef.current = format;
            setBlob(null);
            setError(null);
            setDuration(0);
            chunksRef.current = [];
            audioBuffersRef.current = [];

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });

            streamRef.current = stream;
            audioContextRef.current = new AudioContext();
            const ctx = audioContextRef.current;
            sampleRateRef.current = ctx.sampleRate;

            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            const source = ctx.createMediaStreamSource(stream);
            sourceRef.current = source;

            // Analyser for Visualization
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            source.connect(analyser);
            analyserRef.current = analyser;

            if (format === 'wav' || format === 'mp3') {
                // PCM Recording using ScriptProcessor (Legacy but works without extra files)
                const bufferSize = 4096;
                const processor = ctx.createScriptProcessor(bufferSize, 1, 1);
                processorRef.current = processor;

                processor.onaudioprocess = (e) => {
                    // Logic is handled via closing in stopRecording, but we check ref existence
                    if (!processorRef.current) return;
                    const inputData = e.inputBuffer.getChannelData(0);
                    // Clone the data
                    audioBuffersRef.current.push(new Float32Array(inputData));
                };

                source.connect(processor);
                processor.connect(ctx.destination); // Creating a fake connection to keep it alive
                setIsRecording(true); // Set state inside to ensure it starts processing
            } else {
                // MediaRecorder (WebM or M4A)
                let mimeType = 'audio/webm';
                if (format === 'm4a') {
                    mimeType = 'audio/mp4';
                    // Fallback check if needed? Browsers usually support it or throw.
                }

                const recorder = new MediaRecorder(stream, { mimeType });
                mediaRecorderRef.current = recorder;

                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunksRef.current.push(e.data);
                };

                recorder.start(100);
            }

            setIsRecording(true);
            startTimeRef.current = Date.now();

            // Timer
            timerIntervalRef.current = window.setInterval(() => {
                setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 1000);

            // Visualizer Loop
            const updateVisualizer = () => {
                if (!analyserRef.current) return;
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);

                // Calculate volume
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const avg = sum / dataArray.length;

                setVolume(avg / 255);
                setFrequencyData(dataArray);

                rafRef.current = requestAnimationFrame(updateVisualizer);
            };
            updateVisualizer();

        } catch (err) {
            console.error('Failed to start recording', err);
            setError(err instanceof Error ? err.message : 'Failed to start recording');
        }
    }, [isRecording]); // Added dependency though logic guards handle it

    const stopRecording = useCallback(async () => {
        if (!isRecording) return;

        setIsProcessing(true);

        // Stop loops
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        // Stop Media Recorder (WebM)
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            // Need to wait for last data? internal onstop handle? 
            // Simplified: Just process immediately after short delay or promise
        }

        // Stop ScriptProcessor (WAV)
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }

        // Stop Stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }

        // Close Audio Context
        if (audioContextRef.current) {
            await audioContextRef.current.close();
            audioContextRef.current = null;
        }

        setIsRecording(false);

        // Process Data
        // Process Data
        try {
            if (formatRef.current === 'wav' || formatRef.current === 'mp3') {
                // Merge buffers
                const buffers = audioBuffersRef.current;
                if (buffers.length === 0) {
                    setError("無法擷取音訊資料 (No audio data captured)");
                    return;
                }

                const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
                const result = new Float32Array(totalLength);
                let offset = 0;
                for (const buf of buffers) {
                    result.set(buf, offset);
                    offset += buf.length;
                }

                const sampleRate = sampleRateRef.current;

                if (formatRef.current === 'wav') {
                    const wavBlob = encodeWAVToBlob(result, sampleRate);
                    setBlob(wavBlob);
                } else {
                    const mp3Blob = encodeMP3(result, sampleRate);
                    setBlob(mp3Blob);
                }
            } else {
                // WebM or M4A
                const mimeType = formatRef.current === 'm4a' ? 'audio/mp4' : 'audio/webm';
                const finalBlob = new Blob(chunksRef.current, { type: mimeType });
                setBlob(finalBlob);
            }
        } catch (error) {
            console.error("Audio processing failed:", error);
            setError(`儲存失敗: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsProcessing(false);
        }

    }, [isRecording]);

    return {
        isRecording,
        duration,
        volume,
        frequencyData,
        blob,
        error,
        isProcessing,
        startRecording,
        stopRecording
    };
};
