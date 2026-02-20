import React, { useEffect, useRef, useState } from 'react';

const MicrophoneTester: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [permissionState, setPermissionState] = useState<PermissionState | 'unknown' | 'prompt'>('unknown');
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [volume, setVolume] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isTesting, setIsTesting] = useState(false);

    // Playback test
    const [isRecording, setIsRecording] = useState(false);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number>(0);

    // Initial permission check (Chrome specific for now)
    useEffect(() => {
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'microphone' as PermissionName })
                .then(currentPermission => {
                    setPermissionState(currentPermission.state);
                    currentPermission.onchange = () => {
                        setPermissionState(currentPermission.state);
                    };
                })
                .catch(() => setPermissionState('unknown'));
        }

        // Enumerate devices regardless
        getDevices();
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    }, []);

    const getDevices = async () => {
        try {
            const devs = await navigator.mediaDevices.enumerateDevices();
            const inputs = devs.filter(d => d.kind === 'audioinput');
            setDevices(inputs);
            if (inputs.length > 0 && !selectedDeviceId) {
                // Try to find default or first
                const def = inputs.find(d => d.deviceId === 'default');
                setSelectedDeviceId(def ? def.deviceId : inputs[0].deviceId);
            }
        } catch (e) {
            console.error("Failed to enumerate devices", e);
        }
    };

    const startTest = async () => {
        stopTest();
        setError(null);
        setIsTesting(true);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                    echoCancellation: true
                }
            });

            streamRef.current = stream;
            setPermissionState('granted');

            const ctx = new AudioContext();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            const updateVolume = () => {
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);

                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                const avg = sum / dataArray.length;
                setVolume(avg / 255);

                rafRef.current = requestAnimationFrame(updateVolume);
            };
            updateVolume();

        } catch (err: any) {
            console.error("Mic test failed", err);
            setError(err.message || "Failed to access microphone");
            setPermissionState('denied');
            setIsTesting(false);
        }
    };

    const stopTest = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        setIsTesting(false);
        setVolume(0);
    };

    // Recorder Test
    const startRecordTest = async () => {
        setRecordedBlob(null);
        if (!streamRef.current) {
            await startTest();
            // Wait a bit?
            await new Promise(r => setTimeout(r, 200));
        }

        if (!streamRef.current) return; // Should allow error if failed

        try {
            chunksRef.current = [];
            const recorder = new MediaRecorder(streamRef.current);
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = e => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setRecordedBlob(blob);
            };

            recorder.start();
            setIsRecording(true);

            // Auto stop after 5 seconds
            setTimeout(() => {
                if (mediaRecorderRef.current?.state === 'recording') {
                    stopRecordTest();
                }
            }, 5000);

        } catch (e: any) {
            setError("Recording failed: " + e.message);
        }
    };

    const stopRecordTest = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    useEffect(() => {
        return () => {
            stopTest();
        };
    }, []);

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-zinc-700 flex justify-between items-center bg-zinc-800">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                        麥克風測試 (Microphone Check)
                    </h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {/* 1. Permission Status */}
                    <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                        <span className="text-sm text-zinc-400">權限狀態 (Permission)</span>
                        <span className={`text-sm font-bold px-2 py-1 rounded ${permissionState === 'granted' ? 'bg-green-500/20 text-green-400' :
                                permissionState === 'denied' ? 'bg-red-500/20 text-red-400' :
                                    'bg-amber-500/20 text-amber-400'
                            }`}>
                            {permissionState === 'granted' ? '已允許 (Granted)' :
                                permissionState === 'denied' ? '被拒絕 (Denied)' : '未確認 (Unknown)'}
                        </span>
                    </div>

                    {/* 2. Device Selection */}
                    <div className="space-y-2">
                        <label className="text-sm text-zinc-400">選擇裝置 (Select Device)</label>
                        <select
                            value={selectedDeviceId}
                            onChange={(e) => {
                                setSelectedDeviceId(e.target.value);
                                setIsTesting(false); // Restart test on change
                            }}
                            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white text-sm focus:border-primary outline-none"
                        >
                            {devices.length === 0 && <option value="">未偵測到裝置 (No devices)</option>}
                            {devices.map(d => (
                                <option key={d.deviceId} value={d.deviceId}>{d.label || `Device ${d.deviceId.slice(0, 5)}...`}</option>
                            ))}
                        </select>
                    </div>

                    {/* 3. Visualizer */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <label className="text-sm text-zinc-400">訊號檢測 (Signal Level)</label>
                            <button
                                onClick={isTesting ? stopTest : startTest}
                                className={`text-xs px-3 py-1 rounded-full transition-colors ${isTesting ? 'bg-zinc-700 text-zinc-300' : 'bg-primary text-white hover:bg-primary/90'
                                    }`}
                            >
                                {isTesting ? '停止檢測' : '開始檢測'}
                            </button>
                        </div>
                        <div className="h-6 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700 relative">
                            {/* Background grid */}
                            <div className="absolute inset-0 flex">
                                {[...Array(10)].map((_, i) => (
                                    <div key={i} className="flex-1 border-r border-zinc-600/30 h-full last:border-0"></div>
                                ))}
                            </div>
                            <div
                                className="h-full bg-gradient-to-r from-green-500 to-red-500 transition-all duration-100 ease-out"
                                style={{ width: `${Math.min(100, volume * 300)}%` }} // Boost visual gain
                            />
                        </div>
                        <p className="text-xs text-zinc-500 text-right">請對著麥克風說話，確認綠條有跳動</p>
                    </div>

                    {/* 4. Record Test */}
                    <div className="pt-4 border-t border-zinc-800 space-y-4">
                        <h4 className="text-sm font-semibold text-zinc-300">錄音測試 (Sound Check)</h4>
                        <div className="flex gap-4 items-center">
                            {!isRecording ? (
                                <button
                                    onClick={startRecordTest}
                                    className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-white text-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                    測試錄音 (5秒)
                                </button>
                            ) : (
                                <button
                                    onClick={stopRecordTest}
                                    className="flex-1 py-2 bg-red-500/20 text-red-500 border border-red-500/50 rounded-lg text-sm flex items-center justify-center gap-2 animate-pulse"
                                >
                                    <div className="w-3 h-3 rounded bg-current"></div>
                                    停止測試
                                </button>
                            )}
                        </div>

                        {recordedBlob && !isRecording && (
                            <div className="bg-zinc-800 rounded-lg p-3 animate-fade-in-up">
                                <p className="text-xs text-zinc-400 mb-2">試聽剛才的錄音：</p>
                                <audio controls src={URL.createObjectURL(recordedBlob)} className="w-full h-8" />
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-sm text-red-200">
                            錯誤: {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MicrophoneTester;
