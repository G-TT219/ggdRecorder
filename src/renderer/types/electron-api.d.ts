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
  FavoritesMetadata,
  AppConfig,
  AnalyzeRecordingResult,
  ElectronAPI,
} from '../shared/types';

declare global {
  interface Window {
    electronAPI: import('../shared/types').ElectronAPI;
  }
}
