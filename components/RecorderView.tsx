import React, { useEffect, useRef, useState } from 'react';
import { useAudioRecorder, AudioFormat } from '../hooks/useAudioRecorder';
import { useApp } from '../contexts/AppContext';
import { encodeWAVToBlob } from '../utils/audioUtils';

// --- Sub-Component: Recorder Tab ---
const RecorderTab: React.FC = () => {
    const { settings } = useApp();
    const {
        isRecording,
        duration,
        volume,
        frequencyData,
        blob,
        error,
        isProcessing: isRecordingProcessing,
        startRecording,
        stopRecording
    } = useAudioRecorder();

    const [selectedFormat, setSelectedFormat] = useState<AudioFormat>('wav');
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedMicId, setSelectedMicId] = useState<string>(settings.selectedMicrophoneId || '');
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Fetch Devices
    useEffect(() => {
        const getDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const inputs = devices.filter(d => d.kind === 'audioinput');
                setAudioDevices(inputs);
                if (!selectedMicId && inputs.length > 0) {
                    const def = inputs.find(d => d.deviceId === 'default');
                    setSelectedMicId(def ? 'default' : inputs[0].deviceId);
                }
            } catch (err) {
                console.error("Error fetching devices", err);
            }
        };
        getDevices();
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    }, []);

    useEffect(() => {
        if (settings.selectedMicrophoneId) {
            setSelectedMicId(settings.selectedMicrophoneId);
        }
    }, [settings.selectedMicrophoneId]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const width = canvas.width;
        const height = canvas.height;
        const barWidth = (width / frequencyData.length) * 2.5;
        let x = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            const barHeight = (frequencyData[i] / 255) * height;
            const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
            gradient.addColorStop(0, '#3b82f6');
            gradient.addColorStop(1, '#a855f7');
            ctx.fillStyle = gradient;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
        if (isRecording) {
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            for (let i = 0; i < frequencyData.length; i++) {
                // specific visualization logic
            }
        }
    }, [frequencyData, isRecording]);

    const handleSave = async () => {
        if (!blob) return;
        try {
            if ('showSaveFilePicker' in window) {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: `Recording_${new Date().toISOString().replace(/[:.]/g, '-')}.${selectedFormat}`,
                    types: [{
                        description: 'Audio File',
                        accept: { [`audio/${selectedFormat === 'm4a' ? 'mp4' : selectedFormat}`]: [`.${selectedFormat}`] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Recording_${new Date().toISOString().replace(/[:.]/g, '-')}.${selectedFormat}`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Save cancelled or failed', err);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl mx-auto animate-fade-in">
            {/* Visualizer Area */}
            <div className="relative w-full h-64 bg-zinc-900/50 rounded-xl border border-zinc-800 mb-8 overflow-hidden flex items-center justify-center shadow-inner">
                <canvas ref={canvasRef} width={600} height={250} className="w-full h-full opacity-80" />
                {!isRecording && !blob && (
                    <div className="absolute text-zinc-600 text-sm font-mono">等待錄音...</div>
                )}
                <div className="absolute top-4 right-4 font-mono text-2xl font-bold text-primary tabular-nums drop-shadow-md">
                    {formatTime(duration)}
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-6 w-full max-w-md">
                <div className="flex items-center gap-4 w-full justify-center">
                    <select
                        value={selectedFormat}
                        onChange={(e) => setSelectedFormat(e.target.value as AudioFormat)}
                        disabled={isRecording}
                        className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:border-primary outline-none disabled:opacity-50"
                    >
                        <option value="wav">WAV (無損 PCM)</option>
                        <option value="mp3">MP3 (通用格式)</option>
                        <option value="m4a">M4A (AAC)</option>
                        <option value="webm">WebM (輕量)</option>
                    </select>
                    <select
                        value={selectedMicId}
                        onChange={(e) => setSelectedMicId(e.target.value)}
                        disabled={isRecording}
                        className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 focus:border-primary outline-none disabled:opacity-50 max-w-[200px]"
                    >
                        <option value="">預設麥克風</option>
                        {audioDevices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-6">
                    {!isRecording ? (
                        <button onClick={() => startRecording(selectedMicId, selectedFormat)} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/20 transition-all hover:scale-105 active:scale-95" title="開始錄音">
                            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /></svg>
                        </button>
                    ) : (
                        <button onClick={stopRecording} className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-red-500 text-red-500 flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95" title="停止錄音">
                            <div className="w-6 h-6 bg-current rounded-sm" />
                        </button>
                    )}
                </div>

                {isRecordingProcessing && (
                    <div className="text-primary text-sm animate-pulse">正在處理錄音檔案...</div>
                )}

                {error && (
                    <div className="w-full text-center p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm animate-fade-in-up">{error}</div>
                )}

                {blob && !isRecording && (
                    <div className="flex items-center gap-4 animate-fade-in-up mt-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 w-full justify-between">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-white">錄音完成</span>
                            <span className="text-xs text-zinc-400">{(blob.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                        <button onClick={handleSave} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            儲存檔案
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Sub-Component: Converter Tab ---
const ConverterTab: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [targetFormat, setTargetFormat] = useState<'mp3' | 'wav'>('mp3');
    const [isConverting, setIsConverting] = useState(false);
    const [progress, setProgress] = useState(0); // 0-100
    const [statusText, setStatusText] = useState("");
    const [resultBlob, setResultBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setResultBlob(null);
            setError(null);
            setProgress(0);
            setStatusText("");
        }
    };

    const handleConvert = async () => {
        if (!file) return;
        setIsConverting(true);
        setError(null);
        setResultBlob(null);
        setProgress(0);
        setStatusText("正在讀取檔案...");

        try {
            // 1. Read File
            const arrayBuffer = await file.arrayBuffer();

            // 2. Decode Audio
            setStatusText("正在解碼音訊... (這可能需要一點時間)");
            const audioContext = new AudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const pcmData = audioBuffer.getChannelData(0);
            const sampleRate = audioBuffer.sampleRate;
            let outputBlob: Blob;

            // 3. Encode
            if (targetFormat === 'mp3') {
                setStatusText("正在轉碼為 MP3...");
                // Manual Chunked Encoding for Progress
                // @ts-ignore
                const lame = (window as any).lamejs;
                if (!lame) throw new Error("Lamejs not loaded");

                const Mp3Encoder = lame.Mp3Encoder;
                const mp3encoder = new Mp3Encoder(1, sampleRate, 128); // Mono, 128kbps

                const chunkSize = 11520 * 4; // Process ~1s chunks (multiple of 1152) to reduce UI updates overhead
                const totalSamples = pcmData.length;
                const mp3Data: Int8Array[] = [];

                for (let i = 0; i < totalSamples; i += chunkSize) {
                    const chunkEnd = Math.min(i + chunkSize, totalSamples);
                    const chunk = pcmData.slice(i, chunkEnd);

                    // Convert Float to Int16
                    const sampleData = new Int16Array(chunk.length);
                    for (let j = 0; j < chunk.length; j++) {
                        const s = Math.max(-1, Math.min(1, chunk[j]));
                        sampleData[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }

                    const mp3buf = mp3encoder.encodeBuffer(sampleData);
                    if (mp3buf.length > 0) mp3Data.push(mp3buf);

                    // Update Progress
                    const percent = Math.round((chunkEnd / totalSamples) * 100);
                    setProgress(percent);

                    // Yield to UI thread
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

                const mp3end = mp3encoder.flush();
                if (mp3end.length > 0) mp3Data.push(mp3end);

                outputBlob = new Blob(mp3Data, { type: 'audio/mp3' });

            } else {
                setStatusText("正在封裝為 WAV...");
                setProgress(50);
                await new Promise(resolve => setTimeout(resolve, 100)); // Fake visual delay
                outputBlob = encodeWAVToBlob(pcmData, sampleRate);
                setProgress(100);
            }

            setResultBlob(outputBlob);
            setStatusText("轉檔完成！");
        } catch (err: any) {
            console.error("Conversion failed", err);
            setError(`轉檔失敗: ${err.message || "未知錯誤"}`);
            setStatusText("");
        } finally {
            setIsConverting(false);
            // setProgress(0); // Keep 100% shown
        }
    };

    const handleDownload = () => {
        if (!resultBlob || !file) return;
        const url = URL.createObjectURL(resultBlob);
        const a = document.createElement('a');
        a.href = url;
        const originalName = file.name.split('.').slice(0, -1).join('.');
        a.download = `${originalName}_converted.${targetFormat}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col items-center justify-center h-full w-full max-w-lg mx-auto animate-fade-in p-8 text-center">
            <h3 className="text-xl font-semibold text-zinc-100 mb-6">音訊轉檔工具</h3>

            <div
                className={`w-full h-40 border-2 border-dashed transition-all mb-6 relative flex flex-col items-center justify-center cursor-pointer rounded-xl 
                    ${isConverting ? 'border-zinc-700 bg-zinc-900/10 cursor-not-allowed opacity-50' : 'border-zinc-700 bg-zinc-900/30 hover:border-primary hover:bg-zinc-900/50'}
                `}
                onClick={() => !isConverting && fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    accept="audio/*,video/mp4,video/webm"
                    onChange={handleFileChange}
                    className="hidden"
                    ref={fileInputRef}
                    disabled={isConverting}
                />

                {isConverting ? (
                    <div className="flex flex-col items-center justify-center w-full px-8 animate-fade-in">
                        <div className="text-primary font-medium mb-2 text-sm">{statusText}</div>
                        <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden border border-zinc-700">
                            <div
                                className="bg-primary h-full transition-all duration-100 ease-linear rounded-full box-border"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div className="text-zinc-500 text-xs mt-2 font-mono">{progress}%</div>
                    </div>
                ) : (
                    <>
                        <svg className="w-10 h-10 text-zinc-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        {file ? (
                            <div className="text-primary font-mono text-sm px-4 truncate max-w-full">{file.name}</div>
                        ) : (
                            <span className="text-zinc-500 text-sm">點擊或拖算檔案至此<br />(支援 WebM, M4A, WAV, MP3)</span>
                        )}
                    </>
                )}
            </div>

            <div className="flex items-center gap-4 mb-8 w-full">
                <span className="text-zinc-400 text-sm">轉出格式：</span>
                <div className="flex bg-zinc-800 p-1 rounded-lg flex-1">
                    <button
                        onClick={() => setTargetFormat('mp3')}
                        disabled={isConverting}
                        className={`flex-1 py-1 text-sm rounded transition-colors ${targetFormat === 'mp3' ? 'bg-primary text-white shadow' : 'text-zinc-400 hover:text-zinc-200'} disabled:opacity-50`}
                    >
                        MP3
                    </button>
                    <button
                        onClick={() => setTargetFormat('wav')}
                        disabled={isConverting}
                        className={`flex-1 py-1 text-sm rounded transition-colors ${targetFormat === 'wav' ? 'bg-primary text-white shadow' : 'text-zinc-400 hover:text-zinc-200'} disabled:opacity-50`}
                    >
                        WAV
                    </button>
                </div>
            </div>

            {error && (
                <div className="text-red-400 text-sm mb-4 bg-red-500/10 p-2 rounded w-full animate-fade-in">{error}</div>
            )}

            {!resultBlob ? (
                <button
                    onClick={handleConvert}
                    disabled={!file || isConverting}
                    className={`w-full py-3 rounded-lg font-medium transition-all ${!file || isConverting ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 text-white shadow-lg hover:shadow-primary/20'}`}
                >
                    {isConverting ? '轉檔中...' : '開始轉檔'}
                </button>
            ) : (
                <div className="w-full animate-fade-in-up">
                    <div className="text-sm text-green-400 mb-3 flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        轉檔成功！ ({(resultBlob.size / 1024 / 1024).toFixed(2)} MB)
                    </div>
                    <button
                        onClick={handleDownload}
                        className="w-full py-3 rounded-lg font-medium bg-green-600 hover:bg-green-700 text-white shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        下載檔案
                    </button>
                    <button
                        onClick={() => { setFile(null); setResultBlob(null); setProgress(0); setStatusText(""); }}
                        className="mt-4 text-zinc-500 text-sm hover:text-zinc-300 underline"
                    >
                        轉換其他檔案
                    </button>
                </div>
            )}
        </div>
    );
};

const RecorderView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'recorder' | 'converter'>('recorder');

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header / Tabs */}
            <div className="flex flex-col items-center pt-8 pb-4 bg-zinc-950/50 border-b border-zinc-800/50">
                <h2 className="text-2xl font-bold text-zinc-100 mb-4 tracking-tight">獨立錄音室</h2>

                <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
                    <button
                        onClick={() => setActiveTab('recorder')}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'recorder' ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        錄音
                    </button>
                    <button
                        onClick={() => setActiveTab('converter')}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'converter' ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        轉檔
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'recorder' ? (
                    <div className="absolute inset-0 overflow-y-auto">
                        <div className="mb-2 text-center pt-2">
                            <p className="text-zinc-500 text-xs">高品質音訊錄製 • 無 AI 介入 • 本地儲存</p>
                        </div>
                        <RecorderTab />
                    </div>
                ) : (
                    <div className="absolute inset-0 overflow-y-auto">
                        <div className="mb-2 text-center pt-2">
                            <p className="text-zinc-500 text-xs">本地音訊格式轉換 • 隱私安全</p>
                        </div>
                        <ConverterTab />
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecorderView;
