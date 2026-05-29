import path from 'path';
import { protocol, net } from 'electron';
import { Readable } from 'stream';
import * as fsSync from 'fs';
import { promises as fs } from 'fs';
import logger from './logger';
import { recordingUrlMap } from './utils';

export const registerPrivilegedSchemes = (): void => {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } },
    { scheme: 'recording', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }
  ]);
};

export const registerProtocolHandlers = (): void => {
  protocol.handle('app', (request) => {
    const url = request.url.replace('app://.', '');
    const decodedUrl = decodeURIComponent(url);
    const filePath = path.join(__dirname, '..', '..', 'dist', decodedUrl);
    logger.info(`App protocol serving: ${decodedUrl}`);
    return net.fetch('file://' + filePath.replace(/\\/g, '/'));
  });

  protocol.handle('recording', async (request) => {
    try {
      const url = new URL(request.url);
      const token = url.pathname.split('/').filter(Boolean)[0];
      const filePath = recordingUrlMap.get(token);
      if (filePath) {
        try { await fs.access(filePath); } catch { return new Response(null, { status: 404 }); }
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === '.mp4' ? 'video/mp4' : 'video/webm';
        const stat = await fs.stat(filePath);
        const fileSize = stat.size;
        const range = request.headers.get('range');

        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const nodeStream = fsSync.createReadStream(filePath, { start, end });
          const webStream = Readable.toWeb(nodeStream) as ReadableStream;
          return new Response(webStream, {
            status: 206,
            headers: {
              'Content-Type': mime,
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Content-Length': String(end - start + 1),
              'Accept-Ranges': 'bytes'
            }
          });
        }

        const nodeStream = fsSync.createReadStream(filePath);
        const webStream = Readable.toWeb(nodeStream) as ReadableStream;
        return new Response(webStream, {
          headers: {
            'Content-Type': mime,
            'Content-Length': String(fileSize),
            'Accept-Ranges': 'bytes'
          }
        });
      }
    } catch (error) {
      logger.error('Error serving recording:', error);
    }
    return new Response(null, { status: 404 });
  });
};
