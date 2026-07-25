import type { RecordingQuality } from '../../shared/types';

const MIME_TYPE_PREFERENCE = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp8',
  'video/webm',
] as const;

const QUALITY_BITRATE = {
  performance: { video: 6_000_000, audio: 128_000, min: 3_000_000, max: 12_000_000 },
  balanced: { video: 10_000_000, audio: 160_000, min: 5_000_000, max: 24_000_000 },
  quality: { video: 16_000_000, audio: 192_000, min: 8_000_000, max: 40_000_000 },
} satisfies Record<RecordingQuality, {
  video: number;
  audio: number;
  min: number;
  max: number;
}>;

export const getCaptureFrameRate = (quality: RecordingQuality): number =>
  quality === 'performance' ? 30 : 60;

export const getSupportedRecordingMimeTypes = (
  isTypeSupported: (mimeType: string) => boolean
): string[] => MIME_TYPE_PREFERENCE.filter(isTypeSupported);

export const calculateRecordingBitrates = (
  width: number,
  height: number,
  frameRate: number,
  quality: RecordingQuality
): { videoBitsPerSecond: number; audioBitsPerSecond: number } => {
  const profile = QUALITY_BITRATE[quality];
  const safeWidth = Math.max(640, Number.isFinite(width) ? width : 1920);
  const safeHeight = Math.max(360, Number.isFinite(height) ? height : 1080);
  const safeFrameRate = Math.max(15, Number.isFinite(frameRate) ? frameRate : 60);
  const referencePixelRate = 1920 * 1080 * 60;
  const pixelRateRatio = (safeWidth * safeHeight * safeFrameRate) / referencePixelRate;
  const scaledVideoBitrate = profile.video * Math.pow(pixelRateRatio, 0.72);

  return {
    videoBitsPerSecond: Math.round(
      Math.min(profile.max, Math.max(profile.min, scaledVideoBitrate)) / 100_000
    ) * 100_000,
    audioBitsPerSecond: profile.audio,
  };
};

export const getRecordingExtension = (mimeType: string): 'mp4' | 'webm' =>
  mimeType.toLowerCase().includes('mp4') ? 'mp4' : 'webm';
