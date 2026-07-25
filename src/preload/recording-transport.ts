export type RecordingChunkPayload = {
  sessionId: string;
  chunkId: number;
  buffer: ArrayBuffer;
};

type Invoke = (channel: string, payload: RecordingChunkPayload) => Promise<unknown>;

export const createRecordingChunkAppender = (invoke: Invoke) => (
  sessionId: string,
  chunkId: number,
  buffer: ArrayBuffer
): Promise<unknown> => invoke('append-recording-chunk', { sessionId, chunkId, buffer });
