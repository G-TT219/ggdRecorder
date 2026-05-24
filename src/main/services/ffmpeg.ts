import { spawn } from 'child_process';
import path from 'path';
import logger from '../logger';

export const compressVideo = (inputPath: string, outputPath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-vcodec', 'libx264',
      '-crf', '28',
      '-preset', 'fast',
      '-y',
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });

    ffmpeg.on('error', (err) => reject(new Error(`Failed to start FFmpeg: ${err.message}`)));
  });
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
