import path from 'path';
import { app, BrowserWindow, desktopCapturer, globalShortcut, Tray, Menu, protocol, net } from 'electron';
import logger from './logger';
import { pendingRecordingTarget } from './utils';

const getAssetPath = (...paths: string[]) => path.join(__dirname, '..', '..', ...paths);

const normalizeCaptureName = (value: string): string =>
  value
    .toLocaleLowerCase()
    .replace(/\.exe$/i, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export const createWindow = (): BrowserWindow => {
  const mainWindow = new BrowserWindow({
    width: 500,
    height: 800,
    minWidth: 480,
    minHeight: 600,
    icon: getAssetPath('recorder.ico'),
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      sandbox: false
    },
  });

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    delete responseHeaders['Content-Security-Policy'];
    delete responseHeaders['content-security-policy'];
    delete responseHeaders['Content-Security-Policy-Report-Only'];
    responseHeaders['Permissions-Policy'] = [
      'camera=(self)', 'microphone=(self)', 'display-capture=(self)',
      'media=(self)', 'fullscreen=(self)'
    ];
    callback({ responseHeaders });
  });

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'mediaKeySystem', 'microphone', 'camera', 'display-capture', 'fullscreen'];
    callback(allowed.includes(permission));
  });

  mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['window', 'screen'] }).then((sources: any[]) => {
      let source: any;
      if (pendingRecordingTarget.current) {
        const target = pendingRecordingTarget.current;
        const targetName = normalizeCaptureName(target.name);
        const windowSources = sources.filter(src => String(src.id).startsWith('window:'));
        source = windowSources.find(src => normalizeCaptureName(src.name) === targetName);
        if (!source) {
          source = windowSources
            .filter(src => {
              const sourceName = normalizeCaptureName(src.name);
              return sourceName.includes(targetName) || targetName.includes(sourceName);
            })
            .sort((a, b) => a.name.length - b.name.length)[0];
        }
        pendingRecordingTarget.current = null;
        if (!source) {
          // Chromium reports an empty source as NotAllowedError, which looks
          // like a permission problem to the renderer. Keep recording usable
          // when a game renamed/restarted between selection and capture by
          // falling back to the first available window (or screen below).
          source = windowSources[0];
          logger.warn(
            `No window capture source matched ${target.name} (PID ${target.pid}); ` +
            `${source ? `falling back to ${source.name}` : 'falling back to screen'}`
          );
        }
      }
      if (!source) source = sources.find(src => (src as any).type === 'screen');
      if (!source) source = sources[0];
      callback({ video: source || (request as any).requestedVideoSources?.[0], audio: 'loopback' as const });
    }).catch(error => {
      logger.error('Unable to enumerate recording sources:', error);
      pendingRecordingTarget.current = null;
      callback({});
    });
  });

  mainWindow.setMenu(null);

  mainWindow.on('close', (event) => {
    if (!(app as unknown as Record<string, boolean>).isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  const isDev = process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL;
  logger.info('isDev:', isDev);

  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    mainWindow.loadURL(url);
  } else {
    mainWindow.loadURL('app://./index.html');
  }

  if (isDev) mainWindow.webContents.openDevTools();

  globalShortcut.register('CommandOrControl+Shift+I', () => mainWindow.webContents.toggleDevTools());
  globalShortcut.register('F12', () => mainWindow.webContents.toggleDevTools());
  globalShortcut.register('CommandOrControl+Shift+S', () => mainWindow.webContents.send('start-recording-shortcut'));
  globalShortcut.register('CommandOrControl+Shift+D', () => mainWindow.webContents.send('stop-recording-shortcut'));

  return mainWindow;
};

export let tray: Tray | null = null;

export const createTray = (mainWindow: BrowserWindow): void => {
  const iconPath = getAssetPath('recorder.ico');
  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示', click: () => mainWindow.show() },
    { label: '退出', click: () => { (app as unknown as Record<string, boolean>).isQuiting = true; app.quit(); } }
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip('ggdRecorder');
  tray.on('click', () => mainWindow.show());
};
