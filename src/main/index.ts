import { app, globalShortcut, BrowserWindow } from 'electron';
import logger from './logger';
import { getAppConfig, setGlobalConfig } from './config';
import { registerPrivilegedSchemes, registerProtocolHandlers } from './protocol';
import { createWindow, createTray } from './window';
import { registerRecordingHandlers } from './ipc-recording';
import { registerFavoritesHandlers } from './ipc-favorites';
import { registerConfigHandlers } from './ipc-config';
import { registerWindowHandlers } from './ipc-window';
import { registerStatsHandlers } from './ipc-stats';
import { registerMiscHandlers } from './ipc-misc';
import { registerScreenshotHandlers } from './ipc-screenshot';
import { createRecordingFloatWindow, registerRecordingFloatHandlers, destroyRecordingFloatWindow } from './recording-float-window';

try {
  if (process.env.NODE_ENV === 'development') {
    require('electron-reloader')(module, {
      watchRenderer: true,
      ignore: ['node_modules', 'dist', 'logs', 'game-record', 'out', 'public']
    });
  }
} catch (err) {
  logger.warn('Failed to load electron-reloader:', err);
}

registerPrivilegedSchemes();

app.whenReady().then(async () => {
  try {
    const { config } = await import('dotenv');
    const envPath = app.isPackaged
      ? require('path').join(process.resourcesPath, '.env')
      : require('path').join(__dirname, '..', '..', '.env');
    config({ path: envPath });
    const { setGlobalDispatcher, ProxyAgent } = await import('undici');
    if (process.env.https_proxy) {
      logger.info('Using configured network proxy');
      const dispatcher = new ProxyAgent({ uri: new URL(process.env.https_proxy).toString() });
      setGlobalDispatcher(dispatcher);
    }
  } catch (error) {
    logger.error('Error loading env file:', error);
  }

  registerProtocolHandlers();

  const mainWindow = createWindow();
  createRecordingFloatWindow(mainWindow);
  registerRecordingFloatHandlers(mainWindow);
  createTray(mainWindow);

  try {
    const config = await getAppConfig();
    setGlobalConfig(config);
    logger.info('Global config loaded');
  } catch (error) {
    logger.error('Error loading global config:', error);
    setGlobalConfig({});
  }

  registerRecordingHandlers();
  registerFavoritesHandlers();
  registerConfigHandlers();
  registerWindowHandlers();
  registerStatsHandlers();
  registerMiscHandlers();
  registerScreenshotHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    destroyRecordingFloatWindow();
  });

});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  (app as unknown as Record<string, boolean>).isQuiting = true;
  const { tray } = require('./window');
  if (tray) tray.destroy();
});
