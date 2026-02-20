import React, { useEffect, useRef, useState } from 'react';
import { useAudioRecorder, AudioFormat } from '../hooks/useAudioRecorder';
import { useApp } from '../contexts/AppContext';

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

    // Analysis State
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summaryResult, setSummaryResult] = useState<string | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

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

    // Reset summary when starting new recording
    useEffect(() => {
        if (isRecording) {
            setSummaryResult(null);
            setAnalysisError(null);
        }
    }, [isRecording]);

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
    }, [frequencyData, isRecording]);

    // Audio Playback URL Management
    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    useEffect(() => {
        if (blob) {
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
            return () => {
                URL.revokeObjectURL(url);
                setAudioUrl(null);
            };
        } else {
            setAudioUrl(null);
        }
    }, [blob]);

    const getFileName = () => {
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
        const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        return `Recording_${date}_${time}`;
    };

    const handleSave = async () => {
        if (!blob) return;
        try {
            if ('showSaveFilePicker' in window) {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: `${getFileName()}.${selectedFormat}`,
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
                a.download = `${getFileName()}.${selectedFormat}`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Save cancelled or failed', err);
        }
    };

    const handleGenerateSummary = async () => {
        if (!blob) return;
        setIsSummarizing(true);
        setAnalysisError(null);
        setSummaryResult(null);

        try {
            const file = new File([blob], `recording.${selectedFormat}`, { type: blob.type });
            const { transcribeAudioFile } = await import('../services/fileUploadService');
            const transcript = await transcribeAudioFile(file, settings);
            const { generateSummaryFromText } = await import('../services/analysisService');
            const summary = await generateSummaryFromText(transcript, settings, formatTime(duration));
            setSummaryResult(summary);
        } catch (err: any) {
            console.error("Summary generation failed", err);
            setAnalysisError(err.message || "生成摘要失敗");
        } finally {
            setIsSummarizing(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-start pt-16 h-full w-full max-w-2xl mx-auto animate-fade-in pb-10">
            {/* Visualizer Area */}
            <div className="relative w-full h-32 bg-zinc-900/50 rounded-xl border border-zinc-800 mb-8 overflow-hidden flex items-center justify-center shadow-inner">
                <canvas ref={canvasRef} width={600} height={128} className="w-full h-full opacity-80" />
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

                {blob && !isRecording && audioUrl && (
                    <div className="flex flex-col items-center gap-4 animate-fade-in-up mt-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 w-full mb-4">
                        {/* Audio Player */}
                        <div className="w-full">
                            <audio
                                controls
                                src={audioUrl}
                                className="w-full h-10 block rounded-lg focus:outline-none"
                            />
                        </div>

                        <div className="flex w-full items-center gap-2">
                            <button
                                onClick={handleGenerateSummary}
                                disabled={isSummarizing}
                                className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                            >
                                {isSummarizing ? (
                                    <>
                                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        分析中...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        生成摘要 (AI)
                                    </>
                                )}
                            </button>

                            <button onClick={handleSave} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                下載
                            </button>
                        </div>

                        {analysisError && (
                            <div className="w-full text-center p-2 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-xs animate-fade-in">
                                {analysisError}
                            </div>
                        )}

                        {summaryResult && (
                            <div className="w-full mt-2 animate-fade-in-up">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">分析結果</h3>
                                </div>
                                <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 max-h-[300px] overflow-y-auto custom-scrollbar text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                    {summaryResult}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const RecorderView: React.FC = () => {
    return (
        <div className="flex flex-col h-full bg-background">
            <div className="flex flex-col items-center pt-8 pb-4 bg-zinc-950/50 border-b border-zinc-800/50">
                <h2 className="text-2xl font-bold text-zinc-100 mb-2 tracking-tight">獨立錄音室</h2>
                <p className="text-zinc-500 text-xs">高品質音訊錄製 • 無 AI 介入 • 本地儲存</p>
            </div>
            <div className="flex-1 overflow-y-auto">
                <RecorderTab />
            </div>
        </div>
    );
};

export default RecorderView;
