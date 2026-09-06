import { spawn, execFile } from 'child_process';
import logger from '../logger';

export type FfmpegCapabilities = {
  available: boolean;
  version?: string;
  encoders: string[];
  hardwareEncoders: string[];
  recommendedEncoder?: string;
  error?: string;
};

let capabilitiesPromise: Promise<FfmpegCapabilities> | null = null;

export const detectFfmpegCapabilities = (): Promise<FfmpegCapabilities> => {
  if (capabilitiesPromise) return capabilitiesPromise;
  capabilitiesPromise = new Promise(resolve => {
    execFile('ffmpeg', ['-hide_banner', '-version'], { windowsHide: true }, (versionError, versionStdout, versionStderr) => {
      if (versionError) {
        capabilitiesPromise = null;
        resolve({ available: false, encoders: [], hardwareEncoders: [], error: versionError.message });
        return;
      }
      execFile('ffmpeg', ['-hide_banner', '-encoders'], { windowsHide: true }, (encoderError, stdout, stderr) => {
        if (encoderError) {
          capabilitiesPromise = null;
          resolve({ available: true, encoders: [], hardwareEncoders: [], version: `${versionStdout || versionStderr}`.split(/\r?\n/)[0], error: encoderError.message });
          return;
        }
        const encoders = [...String(stdout).matchAll(/^\s*V[A-Z.\s]{4,7}\s+(\S+)/gm)].map(match => match[1]);
        const hardwareEncoders = encoders.filter(name => /nvenc|qsv|amf|videotoolbox|vaapi/i.test(name));
        const preferred = ['h264_nvenc', 'h264_qsv', 'h264_amf', 'h264_videotoolbox', 'h264_vaapi'];
        const recommendedEncoder = preferred.find(name => hardwareEncoders.includes(name));
        const version = `${versionStdout || versionStderr}`.split(/\r?\n/)[0];
        logger.info(`FFmpeg capabilities: ${hardwareEncoders.join(', ') || 'software only'}`);
        resolve({ available: true, version, encoders, hardwareEncoders, recommendedEncoder });
      });
    });
  });
  return capabilitiesPromise;
};

/** Build a resilient H.264 encoding command for future native capture pipelines. */
export const buildRecordingEncoderArgs = (capabilities: FfmpegCapabilities, quality: 'performance' | 'balanced' | 'quality' = 'balanced'): string[] => {
  const encoder = capabilities.recommendedEncoder || 'libx264';
  const presets = { performance: 'veryfast', balanced: 'faster', quality: 'medium' } as const;
  const args = ['-c:v', encoder];
  if (encoder === 'libx264') args.push('-preset', presets[quality], '-pix_fmt', 'yuv420p');
  else args.push('-preset', quality === 'quality' ? 'slow' : 'fast');
  args.push('-movflags', '+faststart');
  return args;
};

export const generateVideoThumbnail = (videoPath: string, thumbnailPath: string): Promise<{ data: string }> => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-ss', '00:00:01.000',
      '-vframes', '1',
      '-vf', 'scale=320:180',
      '-y',
      thumbnailPath
    ]);

    ffmpeg.on('close', async (code) => {
      if (code === 0) {
        try {
          const fs = await import('fs/promises');
          const data = await fs.readFile(thumbnailPath);
          resolve({ data: data.toString('base64') });
        } catch (err) {
          reject(new Error(`Failed to read thumbnail: ${err instanceof Error ? err.message : String(err)}`));
        }
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on('error', (err) => reject(new Error(`Failed to start FFmpeg: ${err.message}`)));
  });
};
