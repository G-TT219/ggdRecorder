export type IpcSuccess<T = Record<never, never>> = T & { success: true; error?: undefined; canceled?: undefined };
export type IpcFailure = { success: false; error: string; canceled?: boolean };
export type IpcResult<T = Record<never, never>> = IpcSuccess<T> | IpcFailure;

export type Recording = {
  id: string;
  name: string;
  date: string | Date;
  filePath: string;
  size: number;
};

export type GameProcess = {
  pid: number;
  name: string;
  path: string;
};

export type FavoriteGroup = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type RecordingNotes = Record<string, string>;
export type FavoriteRecordingGroups = Record<string, string>;
export type RecordingThumbnails = Record<string, string>;

export type RecordingQuality = 'performance' | 'balanced' | 'quality';

export type RecordingSessionStartOptions = {
  filename: string;
  mimeType: string;
};

export type RecordingSessionStartResult = {
  sessionId: string;
  filePath: string;
};

export type RecordingSessionFinishResult = {
  filePath: string;
  size: number;
  chunks: number;
};

export type FavoritesMetadata = {
  favorites: string[];
  notes: RecordingNotes;
  groups: FavoriteGroup[];
  recordingGroups: FavoriteRecordingGroups;
};

export type AppConfig = {
  recordingsDir?: string | null;
  gamePath?: string | null;
  compressVideos?: boolean;
  recordingQuality?: RecordingQuality;
  apiKey?: string;
  ggdToken?: string;
};

export type AnalyzeRecordingResult = { text: string };

export type ScreenshotSelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ScreenshotSelectionInit = {
  dataUrl: string;
  displayWidth: number;
  displayHeight: number;
};

export type ScreenshotCaptureResult = {
  dataUrl: string;
  width: number;
  height: number;
};

export interface ElectronAPI {
  getGameProcesses: () => Promise<GameProcess[]>;
  startRecordingSession: (options: RecordingSessionStartOptions) => Promise<IpcResult<RecordingSessionStartResult>>;
  appendRecordingChunk: (sessionId: string, chunkId: number, buffer: ArrayBuffer) => Promise<IpcResult<{ bytesWritten: number }>>;
  finishRecordingSession: (sessionId: string) => Promise<IpcResult<RecordingSessionFinishResult>>;
  abortRecordingSession: (sessionId: string) => Promise<IpcResult<{ filePath?: string }>>;
  getRecordings: () => Promise<Recording[]>;
  deleteRecording: (filename: string) => Promise<IpcResult>;
  getRecordingUrl: (filePath: string) => Promise<IpcResult<{ url: string }>>;
  getRecordingsDir: () => Promise<IpcResult<{ recordingsDir: string }>>;
  setRecordingsDir: (dirPath: string) => Promise<IpcResult<{ recordingsDir: string }>>;
  selectRecordingsDir: () => Promise<IpcResult<{ recordingsDir: string }>>;
  openDir: (path: string) => Promise<IpcResult>;
  getGamePath: () => Promise<IpcResult<{ gamePath: string }>>;
  selectGamePath: () => Promise<IpcResult<{ gamePath: string }>>;
  startGame: (gamePath: string) => Promise<IpcResult>;
  generateThumbnail: (filePath: string) => Promise<IpcResult<{ data: string }>>;
  onStartRecordingShortcut: (callback: (...args: unknown[]) => void) => void;
  onStopRecordingShortcut: (callback: (...args: unknown[]) => void) => void;
  removeAllListeners: (channel: string) => void;
  setRecordingTarget: (target: { name: string; pid: number }) => Promise<IpcResult>;
  logInfo: (message: string) => Promise<void>;
  logError: (message: string) => Promise<void>;
  getAppConfig: () => Promise<IpcResult<{ config: AppConfig }>>;
  setRecordingQualityConfig: (value: RecordingQuality) => Promise<IpcResult<{ recordingQuality: RecordingQuality }>>;
  analyzeRecording: (filePath: string) => Promise<IpcResult<AnalyzeRecordingResult>>;
  saveApiKey: (apiKey: string) => Promise<IpcResult>;
  loadApiKey: () => Promise<IpcResult<{ apiKey: string }>>;
  clearApiKey: () => Promise<IpcResult>;
  saveGgdToken: (token: string) => Promise<IpcResult>;
  loadGgdToken: () => Promise<IpcResult<{ token: string }>>;
  clearGgdToken: () => Promise<IpcResult>;
  getFavoriteRecordings: () => Promise<IpcResult<FavoritesMetadata>>;
  toggleFavoriteRecording: (recordingId: string, isFavorite: boolean) => Promise<IpcResult<FavoritesMetadata>>;
  saveRecordingNote: (recordingId: string, note: string) => Promise<IpcResult<FavoritesMetadata>>;
  createFavoriteGroup: (name: string) => Promise<IpcResult<FavoritesMetadata>>;
  renameFavoriteGroup: (groupId: string, name: string) => Promise<IpcResult<FavoritesMetadata>>;
  deleteFavoriteGroup: (groupId: string) => Promise<IpcResult<FavoritesMetadata>>;
  setRecordingFavoriteGroup: (recordingId: string, groupId: string | null) => Promise<IpcResult<FavoritesMetadata>>;
  saveFavoriteToDirectory: (filePath: string, recordingName: string) => Promise<IpcResult<{ savePath: string }>>;
  windowMinimize: () => Promise<void>;
  windowMaximize: () => Promise<void>;
  windowClose: () => Promise<void>;
  resizeWindow: (width: number, height: number) => Promise<IpcResult>;
  captureScreenRegion: () => Promise<IpcResult<ScreenshotCaptureResult>>;
  onScreenshotSelectionInit: (callback: (payload: ScreenshotSelectionInit) => void) => () => void;
  completeScreenshotSelection: (rect: ScreenshotSelectionRect) => Promise<IpcResult>;
  cancelScreenshotSelection: () => Promise<IpcResult>;
  saveScreenshot: (dataUrl: string) => Promise<IpcResult<{ filePath: string }>>;
  copyScreenshot: (dataUrl: string) => Promise<IpcResult>;
  openExternal: (url: string) => Promise<unknown>;
  fetchMatchData: (matchId: string) => Promise<IpcResult<{ data: unknown; statusCode?: number }>>;
  fetchMatchHistory: (userId: string) => Promise<IpcResult<{ data: unknown; statusCode?: number }>>;
}
