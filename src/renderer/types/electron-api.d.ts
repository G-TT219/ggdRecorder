export type {
  IpcSuccess,
  IpcFailure,
  IpcResult,
  Recording,
  GameProcess,
  FavoriteGroup,
  RecordingNotes,
  FavoriteRecordingGroups,
  RecordingThumbnails,
  RecordingQuality,
  RecordingSessionStartOptions,
  RecordingSessionStartResult,
  RecordingSessionFinishResult,
  FavoritesMetadata,
  AppConfig,
  AnalyzeRecordingResult,
  ElectronAPI,
} from '../../shared/types';

declare global {
  interface Window {
    electronAPI: import('../../shared/types').ElectronAPI;
  }
}
