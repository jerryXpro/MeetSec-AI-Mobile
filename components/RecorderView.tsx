import React, { useEffect, useRef, useState } from 'react';
import { useAudioRecorder, AudioFormat } from '../hooks/useAudioRecorder';
import { useApp } from '../contexts/AppContext';

const RecorderView: React.FC = () => {
    const { settings } = useApp();
    const {
        isRecording,
        duration,
        volume,
        frequencyData,
        blob,
        error,
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
                // If no mic selected yet, pick first or default
                if (!selectedMicId && inputs.length > 0) {
                    // check if default exists
                    const def = inputs.find(d => d.deviceId === 'default');
                    setSelectedMicId(def ? 'default' : inputs[0].deviceId);
                }
            } catch (err) {
                console.error("Error fetching devices", err);
            }
        };
        getDevices();
        // Listen for changes
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    }, []);

    // Sync with global settings on mount if changed elsewhere, but allow local override
    useEffect(() => {
        if (settings.selectedMicrophoneId) {
            setSelectedMicId(settings.selectedMicrophoneId);
        }
    }, [settings.selectedMicrophoneId]);

    // Format Duration
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Draw Visualizer
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const width = canvas.width;
        const height = canvas.height;
        const barWidth = (width / frequencyData.length) * 2.5;
        let x = 0;

        // Draw Bars
        for (let i = 0; i < frequencyData.length; i++) {
            const barHeight = (frequencyData[i] / 255) * height;

            const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
            gradient.addColorStop(0, '#3b82f6'); // Blue
            gradient.addColorStop(1, '#a855f7'); // Purple

            ctx.fillStyle = gradient;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);

            x += barWidth + 1;
        }

        // Add a centerline or reflection if desired, but bars are fine for "Waveform" feel
        // Let's add a "live" wave line overlay
        if (isRecording) {
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            for (let i = 0; i < frequencyData.length; i++) {
                const v = frequencyData[i] / 128.0;
                const y = v * height / 2;
                // Just a simple representation
            }
        }

    }, [frequencyData, isRecording]);

    // Handle Save
    const handleSave = async () => {
        if (!blob) return;

        try {
            // Use File System Access API if available
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
                // Fallback to download
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
        <div className="flex flex-col items-center justify-center p-8 h-full bg-background animate-fade-in">
            {/* Header */}
            <div className="mb-8 text-center">
                <h2 className="text-2xl font-bold text-zinc-100 mb-2">獨立錄音室</h2>
                <p className="text-zinc-400 text-sm">高品質音訊錄製 • 無 AI 介入 • 本地儲存</p>
            </div>

            {/* Visualizer Area */}
            <div className="relative w-full max-w-2xl h-64 bg-zinc-900/50 rounded-xl border border-zinc-800 mb-8 overflow-hidden flex items-center justify-center shadow-inner">
                <canvas
                    ref={canvasRef}
                    width={600}
                    height={250}
                    className="w-full h-full opacity-80"
                />
                {!isRecording && !blob && (
                    <div className="absolute text-zinc-600 text-sm font-mono">
                        等待錄音...
                    </div>
                )}
                {/* Timer Overlay */}
                <div className="absolute top-4 right-4 font-mono text-2xl font-bold text-primary tabular-nums drop-shadow-md">
                    {formatTime(duration)}
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center gap-6 w-full max-w-md">

                {/* Settings Row */}
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
                            <option key={device.deviceId} value={device.deviceId}>
                                {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Main Buttons */}
                <div className="flex items-center gap-6">
                    {!isRecording ? (
                        <button
                            onClick={() => startRecording(selectedMicId, selectedFormat)}
                            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/20 transition-all hover:scale-105 active:scale-95"
                            title="開始錄音"
                        >
                            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /></svg>
                        </button>
                    ) : (
                        <button
                            onClick={stopRecording}
                            className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-red-500 text-red-500 flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
                            title="停止錄音"
                        >
                            <div className="w-6 h-6 bg-current rounded-sm" />
                        </button>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="w-full text-center p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm animate-fade-in-up">
                        {error}
                    </div>
                )}

                {/* Save Section */}
                {blob && !isRecording && (
                    <div className="flex items-center gap-4 animate-fade-in-up mt-4 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700 w-full justify-between">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-white">錄音完成</span>
                            <span className="text-xs text-zinc-400">{(blob.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            儲存檔案
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecorderView;
