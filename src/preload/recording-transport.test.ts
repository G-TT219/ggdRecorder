import { describe, expect, it, vi } from 'vitest';
import { createRecordingChunkAppender } from './recording-transport';

describe('recording chunk transport', () => {
  it('uses invoke without an unsupported ArrayBuffer transfer list', async () => {
    const invoke = vi.fn().mockResolvedValue({ success: true, bytesWritten: 4 });
    const append = createRecordingChunkAppender(invoke);
    const buffer = new Uint8Array([1, 2, 3, 4]).buffer;

    await expect(append('session-1', 0, buffer)).resolves.toEqual({
      success: true,
      bytesWritten: 4,
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('append-recording-chunk', {
      sessionId: 'session-1',
      chunkId: 0,
      buffer,
    });
  });
});
