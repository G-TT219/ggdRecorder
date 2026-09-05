import path from 'path';
import { BrowserWindow, ipcMain, screen } from 'electron';

export type RecordingFloatState = {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  gameName?: string;
};

export type RecordingFloatAction = 'toggle-pause' | 'stop' | 'show-main';

let floatWindow: BrowserWindow | null = null;
let hostWindow: BrowserWindow | null = null;
let currentState: RecordingFloatState = {
  isRecording: false,
  isPaused: false,
  recordingTime: 0,
  gameName: '',
};

const getFloatUrl = (): string => {
  const isDev = process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL;
  return isDev
    ? `${process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'}/recording-float.html`
    : 'app://./recording-float.html';
};

const positionFloatWindow = (window: BrowserWindow): void => {
  const workArea = screen.getPrimaryDisplay().workArea;
  const [width, height] = window.getSize();
  window.setPosition(
    Math.max(workArea.x + 12, workArea.x + workArea.width - width - 18),
    Math.max(workArea.y + 12, workArea.y + workArea.height - height - 18),
    false,
  );
};

export const createRecordingFloatWindow = (mainWindow: BrowserWindow): BrowserWindow => {
  hostWindow = mainWindow;
  if (floatWindow && !floatWindow.isDestroyed()) return floatWindow;

  floatWindow = new BrowserWindow({
    width: 360,
    height: 86,
    minWidth: 320,
    minHeight: 78,
    maxWidth: 460,
    maxHeight: 100,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  floatWindow.setMenu(null);
  floatWindow.setAlwaysOnTop(true, 'floating');
  floatWindow.on('close', (event) => {
    // Closing the small control surface should never terminate the recording/app.
    if (!floatWindow?.isDestroyed()) {
      event.preventDefault();
      floatWindow.hide();
    }
  });
  floatWindow.on('closed', () => { floatWindow = null; });

  const loadPromise = floatWindow.loadURL(getFloatUrl());
  loadPromise.catch(() => undefined);
  floatWindow.webContents.once('did-finish-load', () => {
    floatWindow?.webContents.send('recording-float-state', currentState);
  });
  positionFloatWindow(floatWindow);
  return floatWindow;
};

export const updateRecordingFloatState = (state: RecordingFloatState): void => {
  currentState = { ...currentState, ...state };
  if (!currentState.isRecording) {
    hideRecordingFloatWindow();
  }
  if (floatWindow && !floatWindow.isDestroyed()) {
    floatWindow.webContents.send('recording-float-state', currentState);
  }
  if (currentState.isRecording && hostWindow?.isMinimized()) {
    showRecordingFloatWindow();
  }
};

export const showRecordingFloatWindow = (): void => {
  if (!floatWindow || floatWindow.isDestroyed() || !currentState.isRecording) return;
  // Position the window only when it is created. Re-positioning here would
  // overwrite the user's chosen drag location every time the timer updates.
  floatWindow.showInactive();
};

export const hideRecordingFloatWindow = (): void => {
  if (floatWindow && !floatWindow.isDestroyed() && floatWindow.isVisible()) {
    floatWindow.hide();
  }
};

export const destroyRecordingFloatWindow = (): void => {
  if (floatWindow && !floatWindow.isDestroyed()) {
    floatWindow.removeAllListeners('close');
    floatWindow.destroy();
  }
  floatWindow = null;
  hostWindow = null;
};

export const registerRecordingFloatHandlers = (mainWindow: BrowserWindow): void => {
  hostWindow = mainWindow;
  ipcMain.on('recording-float-state-update', (_event, state: RecordingFloatState) => {
    updateRecordingFloatState(state);
  });
  ipcMain.on('recording-float-action', (_event, action: RecordingFloatAction) => {
    if (action === 'show-main') {
      hideRecordingFloatWindow();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      return;
    }
    mainWindow.webContents.send('recording-float-action', action);
  });

  mainWindow.on('minimize', () => {
    if (currentState.isRecording) showRecordingFloatWindow();
  });
  mainWindow.on('restore', hideRecordingFloatWindow);
  mainWindow.on('show', () => {
    if (!mainWindow.isMinimized()) hideRecordingFloatWindow();
  });
  mainWindow.on('closed', destroyRecordingFloatWindow);
};
