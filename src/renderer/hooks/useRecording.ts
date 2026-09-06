import { useCallback, useEffect, useRef, useState } from 'react';
import Logger from '../utils/logger';
import {
  calculateRecordingBitrates,
  getCaptureFrameRate,
  getRecordingExtension,
  getRecordingCapabilitySummary,
} from '../utils/recording';
import type { GameProcess, RecordingQuality } from '../types/electron-api';

const MIN_FREE_DISK_BYTES = 1024 * 1024 * 1024; // 1 GB
const MAX_PENDING_CHUNKS = 8;
const DISK_CHECK_INTERVAL_MS = 10_000;
// Half-second slices reduce the visible startup gap and make recovery files usable
// without creating a large IPC backlog (the queue is bounded below).
// 300ms keeps the first persisted chunk responsive while avoiding excessive IPC/write overhead.
const CHUNK_INTERVAL_MS = 300;

export type RecordingStatus = 'idle' | 'preparing' | 'recording' | 'paused' | 'finalizing' | 'error';

type UseRecordingOptions = {
  onRecordingSaved?: () => void;
};

export function useRecording({ onRecordingSaved }: UseRecordingOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingSessionIdRef = useRef<string | null>(null);
  const recordingWriteChainRef = useRef<Promise<void>>(Promise.resolve());
  const recordingChunkIdRef = useRef(0);
  const pendingChunksRef = useRef(0);
  const backpressurePausedRef = useRef(false);
  const userPausedRef = useRef(false);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingWriteErrorRef = useRef<Error | null>(null);
  const recordingBytesRef = useRef(0);
  const recordingChunksRef = useRef(0);
  const recordingMetricsAtRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const recordingPausedAtRef = useRef<number | null>(null);
  const stoppingRef = useRef(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const diskCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRecordingSavedRef = useRef(onRecordingSaved);

  useEffect(() => {
    onRecordingSavedRef.current = onRecordingSaved;
  }, [onRecordingSaved]);

  const clearRecordingTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const clearDiskCheckTimer = useCallback(() => {
    if (diskCheckIntervalRef.current) {
      clearInterval(diskCheckIntervalRef.current);
      diskCheckIntervalRef.current = null;
    }
  }, []);

  const updateRecordingTimer = useCallback(() => {
    const startedAt = recordingStartTimeRef.current;
    if (startedAt === null) return;
    setRecordingTime(Math.floor((Date.now() - startedAt) / 1000));
  }, []);

  const resetRecordingState = useCallback(() => {
    clearRecordingTimer();
    clearDiskCheckTimer();
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    setRecordingStatus('idle');
    recordingStartTimeRef.current = null;
    recordingPausedAtRef.current = null;
    userPausedRef.current = false;
    backpressurePausedRef.current = false;
    pendingChunksRef.current = 0;
    recordingBytesRef.current = 0;
    recordingChunksRef.current = 0;
    recordingMetricsAtRef.current = null;
    stoppingRef.current = false;
  }, [clearDiskCheckTimer, clearRecordingTimer]);

  const checkDiskSpace = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const result = await window.electronAPI.checkRecordingDiskSpace();
      if (!result.success) {
        return { ok: false, error: result.error };
      }
      if (result.freeBytes < MIN_FREE_DISK_BYTES) {
        return { ok: false, error: '磁盘空间不足，请清理后重试' };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '无法检查磁盘空间' };
    }
  }, []);

  const stopRecording = useCallback(() => {
    try {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive' && !stoppingRef.current) {
        stoppingRef.current = true;
        setRecordingStatus('finalizing');
        // Ask MediaRecorder to emit the current partial slice before stopping.
        // This reduces the chance of losing the final few hundred milliseconds
        // when the user stops between two timeslice boundaries.
        try { recorder.requestData(); } catch { /* some Chromium versions do not support it while paused */ }
        recorder.stop();
        setIsRecording(false);
        setIsPaused(false);
        clearRecordingTimer();
        Logger.info('Recording stopped; finalizing file');
      }
    } catch (error) {
      Logger.error('Error stopping recording:', error);
    }
  }, [clearRecordingTimer]);

  const togglePause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state === 'recording') {
      userPausedRef.current = true;
      recorder.pause();
      setIsPaused(true);
      setRecordingStatus('paused');
      recordingPausedAtRef.current = Date.now();
      clearRecordingTimer();
      Logger.info('Recording paused');
    } else if (recorder.state === 'paused') {
      userPausedRef.current = false;
      recorder.resume();
      setIsPaused(false);
      setRecordingStatus('recording');
      if (recordingPausedAtRef.current !== null && recordingStartTimeRef.current !== null) {
        recordingStartTimeRef.current += Date.now() - recordingPausedAtRef.current;
      }
      recordingPausedAtRef.current = null;
      timerIntervalRef.current = setInterval(updateRecordingTimer, CHUNK_INTERVAL_MS);
      Logger.info('Recording resumed');
    }
  }, [clearRecordingTimer, updateRecordingTimer]);

  const startRecording = useCallback(async (game: GameProcess, quality: RecordingQuality) => {
    if (!game) {
      Logger.error('No game selected');
      return;
    }

    if (recordingSessionIdRef.current || (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive')) {
      Logger.info('A recording is already active or being finalized');
      return;
    }

    setRecordingError(null);
    setRecordingStatus('preparing');

    const diskCheck = await checkDiskSpace();
    if (!diskCheck.ok) {
      setRecordingStatus('error');
      setRecordingError(diskCheck.error || '磁盘空间不足');
      Logger.error(diskCheck.error || 'Disk space check failed');
      return;
    }

    const sourceName = game.name;
    let stream: MediaStream | null = null;
    let sessionId: string | null = null;

    try {
      const targetResult = await window.electronAPI.setRecordingTarget({ name: game.name, pid: game.pid });
      if (!targetResult.success) {
        throw new Error(targetResult.error);
      }

      const targetFrameRate = getCaptureFrameRate(quality);
      Logger.info('Trying getDisplayMedia API...');
      const videoConstraints = {
        width: { ideal: 1920, max: 3840 },
        height: { ideal: 1080, max: 2160 },
        frameRate: { ideal: targetFrameRate, max: targetFrameRate },
        cursor: 'always',
      } as MediaTrackConstraints;
      try {
        // System audio is supported on Windows in most Electron builds, but
        // some GPU/OS combinations reject the entire request when loopback
        // audio is unavailable. Keep video recording usable in that case.
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: videoConstraints,
          audio: true,
        });
      } catch (captureError) {
        const errorName = captureError instanceof DOMException ? captureError.name : '';
        if (errorName === 'NotAllowedError' || errorName === 'AbortError') {
          throw new Error('未获得屏幕录制权限，或你取消了窗口选择');
        }
        Logger.info(`Display capture with audio failed (${errorName || 'unknown'}); retrying video-only`);
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: videoConstraints,
            audio: false,
          });
        } catch (videoOnlyError) {
          const name = videoOnlyError instanceof DOMException ? videoOnlyError.name : '';
          const message = videoOnlyError instanceof Error ? videoOnlyError.message : String(videoOnlyError);
          if (name === 'NotAllowedError' || name === 'AbortError') {
            throw new Error('未获得屏幕录制权限，或你取消了窗口选择');
          }
          if (name === 'NotFoundError' || name === 'OverconstrainedError') {
            throw new Error('没有找到可录制的窗口，请确认游戏正在运行');
          }
          throw new Error(`无法开始屏幕捕获${message ? `：${message}` : ''}`);
        }
      }
      Logger.info('getDisplayMedia succeeded');

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('未获取到可录制的视频画面');
      }
      const settings = videoTrack.getSettings();
      // Tell Chromium this is a motion-heavy game capture so its encoder
      // prioritizes temporal detail over still-image sharpness.
      try { videoTrack.contentHint = 'motion'; } catch { /* older Chromium */ }
      stream.getAudioTracks().forEach(track => {
        try { track.contentHint = 'music'; } catch { /* older Chromium */ }
      });
      Logger.info(
        `Actual recording resolution: ${settings.width}x${settings.height}@${settings.frameRate}fps`
      );

      const bitrates = calculateRecordingBitrates(
        settings.width || 1920,
        settings.height || 1080,
        settings.frameRate || targetFrameRate,
        quality
      );
      const capability = getRecordingCapabilitySummary((type) =>
        MediaRecorder.isTypeSupported(type)
      );
      const supportedMimeTypes = capability.supportedMimeTypes;
      Logger.info(
        `Recording capabilities: ${supportedMimeTypes.join(', ') || 'browser default'}; ` +
        `hardware-friendly=${capability.prefersHardwareFriendlyPath}`
      );
      let recorder: MediaRecorder | null = null;

      for (const candidate of supportedMimeTypes) {
        try {
          recorder = new MediaRecorder(stream, { mimeType: candidate, ...bitrates });
          break;
        } catch {
          try {
            recorder = new MediaRecorder(stream, { mimeType: candidate });
            break;
          } catch {
            // Try the next container/codec combination.
          }
        }
      }

      if (!recorder) {
        try {
          recorder = new MediaRecorder(stream, bitrates);
        } catch {
          recorder = new MediaRecorder(stream);
        }
      }

      const mimeType = recorder.mimeType || capability.recommendedMimeType || 'video/webm';
      Logger.info(`Selected recorder: ${mimeType}; candidates: ${supportedMimeTypes.join(', ') || 'browser default'}`);
      const extension = getRecordingExtension(mimeType);
      const now = new Date();
      const chinaTime = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);
      const filename = `${sourceName}_${chinaTime.replace(/[/: ]/g, '-')}.${extension}`;
      const sessionResult = await window.electronAPI.startRecordingSession({ filename, mimeType });
      if (!sessionResult.success) {
        throw new Error(sessionResult.error);
      }

      sessionId = sessionResult.sessionId;
      recordingSessionIdRef.current = sessionId;
      recordingWriteChainRef.current = Promise.resolve();
      recordingChunkIdRef.current = 0;
      pendingChunksRef.current = 0;
      recordingWriteErrorRef.current = null;
      recordingBytesRef.current = 0;
      recordingChunksRef.current = 0;
      recordingMetricsAtRef.current = Date.now();
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size <= 0) return;

        if (pendingChunksRef.current >= MAX_PENDING_CHUNKS && recorder.state === 'recording') {
          backpressurePausedRef.current = true;
          recorder.pause();
        }

        const chunk = event.data;
        const chunkId = recordingChunkIdRef.current;
        recordingChunkIdRef.current += 1;
        pendingChunksRef.current += 1;

        recordingWriteChainRef.current = recordingWriteChainRef.current
          .then(async () => {
            if (recordingWriteErrorRef.current) return;
            const buffer = await chunk.arrayBuffer();
            const result = await window.electronAPI.appendRecordingChunk(
              sessionId!,
              chunkId,
              buffer
            );
            if (!result.success) throw new Error(result.error);
            recordingBytesRef.current += buffer.byteLength;
            recordingChunksRef.current += 1;
            if (recordingChunksRef.current % 20 === 0 && recordingMetricsAtRef.current) {
              const elapsed = Math.max(1, (Date.now() - recordingMetricsAtRef.current) / 1000);
              Logger.info(
                `Recording throughput: ${(recordingBytesRef.current / elapsed / 1024 / 1024).toFixed(2)} MiB/s, ` +
                `${recordingChunksRef.current} chunks, pending ${pendingChunksRef.current}`
              );
            }
          })
          .catch((error) => {
            if (recordingWriteErrorRef.current) return;
            const writeError = error instanceof Error ? error : new Error(String(error));
            recordingWriteErrorRef.current = writeError;
            Logger.error('Recording chunk write failed:', writeError);
            if (recorder.state !== 'inactive') recorder.stop();
          })
          .finally(() => {
            pendingChunksRef.current = Math.max(0, pendingChunksRef.current - 1);
            if (
              backpressurePausedRef.current &&
              pendingChunksRef.current < MAX_PENDING_CHUNKS - 1 &&
              !userPausedRef.current &&
              recorder.state === 'paused'
            ) {
              backpressurePausedRef.current = false;
              try {
                recorder.resume();
              } catch {
                // Ignore resume failures; the user can resume manually.
              }
            }
          });
      };

      recorder.onerror = (event) => {
        const mediaError = (event as Event & { error?: DOMException }).error;
        recordingWriteErrorRef.current = mediaError || new Error('录像编码器发生错误');
        setRecordingStatus('error');
        Logger.error('MediaRecorder error:', recordingWriteErrorRef.current);
      };

      recorder.onstop = async () => {
        try {
          await recordingWriteChainRef.current;
          if (recordingWriteErrorRef.current) {
            const abortResult = await window.electronAPI.abortRecordingSession(sessionId!);
            if (abortResult.success && abortResult.filePath) {
              Logger.error(
                'Recording interrupted; partial file recovered at: ' + abortResult.filePath
              );
            } else if (!abortResult.success) {
              Logger.error('Failed to recover interrupted recording:', abortResult.error);
            }
          } else {
            const result = await window.electronAPI.finishRecordingSession(sessionId!);
            if (result.success) {
              Logger.info(
                `Recording saved: ${filename} (${result.chunks} chunks, ${result.size} bytes)`
              );
            } else {
              Logger.error('Failed to finish recording:', result.error);
            }
          }
          onRecordingSavedRef.current?.();
        } catch (error) {
          Logger.error('Error finalizing recording:', error);
          const abortResult = await window.electronAPI.abortRecordingSession(sessionId!);
          if (!abortResult.success) {
            Logger.error('Failed to abort recording session:', abortResult.error);
          }
        } finally {
          stream?.getTracks().forEach((track) => track.stop());
          if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null;
          if (recordingSessionIdRef.current === sessionId) recordingSessionIdRef.current = null;
          recordingStreamRef.current = null;
          resetRecordingState();
        }
      };

      videoTrack.addEventListener(
        'ended',
        () => {
          if (recorder.state !== 'inactive') recorder.stop();
        },
        { once: true }
      );

      recorder.start(CHUNK_INTERVAL_MS);
      // Ask Chromium for the first available segment immediately instead of waiting
      // for a full timeslice. Some implementations emit an empty blob here; the
      // data handler already ignores empty chunks safely.
      queueMicrotask(() => {
        if (recorder?.state === 'recording') {
          try { recorder.requestData(); } catch { /* recorder may still be starting */ }
        }
      });
      setIsRecording(true);
      setIsPaused(false);
      setRecordingStatus('recording');
      recordingStartTimeRef.current = Date.now();
      recordingPausedAtRef.current = null;
      timerIntervalRef.current = setInterval(updateRecordingTimer, CHUNK_INTERVAL_MS);

      diskCheckIntervalRef.current = setInterval(async () => {
        const check = await checkDiskSpace();
        if (!check.ok) {
          recordingWriteErrorRef.current = new Error(check.error || '磁盘空间不足');
          Logger.error('Disk space low; stopping recording');
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        }
      }, DISK_CHECK_INTERVAL_MS);

      Logger.info(
        `Recording started: ${mimeType}, ${Math.round(bitrates.videoBitsPerSecond / 1_000_000)}Mbps, ${quality}`
      );
    } catch (error) {
      Logger.error('Error starting media recording:', error);
      if (sessionId) {
        const abortResult = await window.electronAPI.abortRecordingSession(sessionId);
        if (!abortResult.success) {
          Logger.error('Failed to abort recording session:', abortResult.error);
        }
      }
      stream?.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      recordingSessionIdRef.current = null;
      recordingStreamRef.current = null;
      resetRecordingState();
      setRecordingStatus('error');
      setRecordingError(error instanceof Error ? error.message : String(error));
    }
  }, [checkDiskSpace, resetRecordingState, updateRecordingTimer]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore cleanup errors.
        }
      }
      clearRecordingTimer();
      clearDiskCheckTimer();
    };
  }, [clearDiskCheckTimer, clearRecordingTimer]);

  return {
    isRecording,
    isPaused,
    recordingTime,
    recordingError,
    recordingStatus,
    startRecording,
    stopRecording,
    togglePause,
  };
}
