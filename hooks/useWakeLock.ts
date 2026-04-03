import { useRef, useCallback, useEffect } from 'react';

/**
 * useWakeLock - 防止手機螢幕關閉導致錄音/語音中斷
 * 
 * 策略：
 * 1. Screen Wake Lock API (主要) — 保持螢幕常亮
 * 2. 靜音 Audio 播放 (備用) — 防止瀏覽器暫停 JavaScript
 */
export function useWakeLock() {
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);
    const silentAudioRef = useRef<HTMLAudioElement | null>(null);
    const isActiveRef = useRef(false);

    // 請求 Wake Lock
    const requestWakeLock = useCallback(async () => {
        if (isActiveRef.current) return;
        isActiveRef.current = true;

        // 策略 1: Screen Wake Lock API
        try {
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                console.log('[WakeLock] Screen Wake Lock acquired');

                // 螢幕重新可見時自動重新取得
                wakeLockRef.current?.addEventListener('release', () => {
                    console.log('[WakeLock] Screen Wake Lock released');
                    if (isActiveRef.current) {
                        // 重新取得
                        (navigator as any).wakeLock.request('screen')
                            .then((lock: WakeLockSentinel) => {
                                wakeLockRef.current = lock;
                                console.log('[WakeLock] Screen Wake Lock re-acquired');
                            })
                            .catch(() => {});
                    }
                });
            }
        } catch (err) {
            console.warn('[WakeLock] Screen Wake Lock not available:', err);
        }

        // 策略 2: 靜音 Audio 播放 (防止瀏覽器暫停 JS)
        try {
            if (!silentAudioRef.current) {
                const audio = new Audio();
                // 產生一小段靜音 WAV (最小有效 WAV)
                const silentWav = createSilentWav();
                audio.src = URL.createObjectURL(new Blob([silentWav], { type: 'audio/wav' }));
                audio.loop = true;
                audio.volume = 0.001; // 幾乎無聲
                silentAudioRef.current = audio;
            }
            await silentAudioRef.current.play();
            console.log('[WakeLock] Silent audio playback started');
        } catch (err) {
            console.warn('[WakeLock] Silent audio fallback failed:', err);
        }

        // 策略 3: 頁面可見性變更時重新取得
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // 釋放 Wake Lock
    const releaseWakeLock = useCallback(() => {
        isActiveRef.current = false;

        // 釋放 Screen Wake Lock
        if (wakeLockRef.current) {
            wakeLockRef.current.release().catch(() => {});
            wakeLockRef.current = null;
            console.log('[WakeLock] Screen Wake Lock released manually');
        }

        // 停止靜音播放
        if (silentAudioRef.current) {
            silentAudioRef.current.pause();
            silentAudioRef.current.currentTime = 0;
            console.log('[WakeLock] Silent audio stopped');
        }

        document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    const handleVisibilityChange = useCallback(() => {
        if (document.visibilityState === 'visible' && isActiveRef.current) {
            // 頁面重新可見時，重新取得 Wake Lock
            if ('wakeLock' in navigator && !wakeLockRef.current) {
                (navigator as any).wakeLock.request('screen')
                    .then((lock: WakeLockSentinel) => {
                        wakeLockRef.current = lock;
                        console.log('[WakeLock] Re-acquired on visibility change');
                    })
                    .catch(() => {});
            }
            // 重新播放靜音音訊
            silentAudioRef.current?.play().catch(() => {});
        }
    }, []);

    // 組件卸載時清理
    useEffect(() => {
        return () => {
            releaseWakeLock();
            if (silentAudioRef.current) {
                const src = silentAudioRef.current.src;
                silentAudioRef.current = null;
                if (src.startsWith('blob:')) URL.revokeObjectURL(src);
            }
        };
    }, []);

    return { requestWakeLock, releaseWakeLock };
}

/**
 * 產生最小的靜音 WAV 檔案 (44 bytes header + 2 seconds of silence)
 */
function createSilentWav(): ArrayBuffer {
    const sampleRate = 8000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const duration = 2; // seconds
    const numSamples = sampleRate * duration;
    const dataSize = numSamples * numChannels * (bitsPerSample / 8);
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // WAV Header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    // Data is already zeros (silence)

    return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}
