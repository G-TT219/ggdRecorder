import { describe, expect, it } from 'vitest';
import {
  calculateRecordingBitrates,
  getCaptureFrameRate,
  getRecordingExtension,
  getSupportedRecordingMimeTypes,
} from './recording';

describe('recording profiles', () => {
  it('prefers H.264 MP4 and retains WebM fallbacks', () => {
    const supported = new Set([
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm',
    ]);

    expect(getSupportedRecordingMimeTypes(type => supported.has(type))).toEqual([
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm',
    ]);
  });

  it('scales bitrate by resolution and caps each quality profile', () => {
    const hdBalanced = calculateRecordingBitrates(1920, 1080, 60, 'balanced');
    const ultraHdBalanced = calculateRecordingBitrates(3840, 2160, 60, 'balanced');
    const ultraHdQuality = calculateRecordingBitrates(3840, 2160, 60, 'quality');

    expect(hdBalanced.videoBitsPerSecond).toBe(10_000_000);
    expect(ultraHdBalanced.videoBitsPerSecond).toBeGreaterThan(hdBalanced.videoBitsPerSecond);
    expect(ultraHdBalanced.videoBitsPerSecond).toBeLessThanOrEqual(24_000_000);
    expect(ultraHdQuality.videoBitsPerSecond).toBeLessThanOrEqual(40_000_000);
  });

  it('uses 30 FPS for the low-overhead profile and maps file containers', () => {
    expect(getCaptureFrameRate('performance')).toBe(30);
    expect(getCaptureFrameRate('quality')).toBe(60);
    expect(getRecordingExtension('video/mp4;codecs=avc1')).toBe('mp4');
    expect(getRecordingExtension('video/webm;codecs=vp9')).toBe('webm');
  });
});
