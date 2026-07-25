import {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  ipcMain,
  nativeImage,
  screen,
  type NativeImage,
} from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import type {
  IpcResult,
  ScreenshotCaptureResult,
  ScreenshotSelectionInit,
  ScreenshotSelectionRect,
} from '../shared/types';

type ActiveCapture = {
  overlayWindow: BrowserWindow;
  mainWindow: BrowserWindow;
  screenshot: NativeImage;
  displayWidth: number;
  displayHeight: number;
  resolve: (result: IpcResult<ScreenshotCaptureResult>) => void;
};

let activeCapture: ActiveCapture | null = null;

const delay = (milliseconds: number) =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

const restoreMainWindow = (window: BrowserWindow): void => {
  if (window.isDestroyed()) return;
  window.show();
  window.focus();
};

const settleCapture = (result: IpcResult<ScreenshotCaptureResult>): void => {
  const capture = activeCapture;
  if (!capture) return;
  activeCapture = null;
  if (!capture.overlayWindow.isDestroyed()) capture.overlayWindow.destroy();
  restoreMainWindow(capture.mainWindow);
  capture.resolve(result);
};

const normalizeRect = (
  rect: ScreenshotSelectionRect,
  displayWidth: number,
  displayHeight: number
): ScreenshotSelectionRect | null => {
  const left = Math.max(0, Math.min(displayWidth, rect.x));
  const top = Math.max(0, Math.min(displayHeight, rect.y));
  const right = Math.max(left, Math.min(displayWidth, rect.x + rect.width));
  const bottom = Math.max(top, Math.min(displayHeight, rect.y + rect.height));
  const width = right - left;
  const height = bottom - top;
  if (width < 2 || height < 2) return null;
  return { x: left, y: top, width, height };
};

const getSelectionUrl = (): string => {
  const isDev = process.env.NODE_ENV === 'development' || !!process.env.VITE_DEV_SERVER_URL;
  if (isDev) {
    const baseUrl = (process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173').replace(/\/$/, '');
    return baseUrl + '/screenshot-selection.html';
  }
  return 'app://./screenshot-selection.html';
};

const createSelectionWindow = (
  displayBounds: Electron.Rectangle,
  payload: ScreenshotSelectionInit,
  mainWindow: BrowserWindow,
  screenshot: NativeImage
): Promise<IpcResult<ScreenshotCaptureResult>> => {
  const overlayWindow = new BrowserWindow({
    x: displayBounds.x,
    y: displayBounds.y,
    width: displayBounds.width,
    height: displayBounds.height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  overlayWindow.setMenu(null);
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  return new Promise(resolve => {
    activeCapture = {
      overlayWindow,
      mainWindow,
      screenshot,
      displayWidth: payload.displayWidth,
      displayHeight: payload.displayHeight,
      resolve,
    };

    overlayWindow.once('closed', () => {
      if (activeCapture?.overlayWindow === overlayWindow) {
        settleCapture({ success: false, error: '截图已取消', canceled: true });
      }
    });

    overlayWindow.webContents.once('did-finish-load', () => {
      if (overlayWindow.isDestroyed()) return;
      overlayWindow.webContents.send('screenshot-selection-init', payload);
      overlayWindow.show();
      overlayWindow.focus();
    });

    overlayWindow.loadURL(getSelectionUrl()).catch(error => {
      settleCapture({
        success: false,
        error: error instanceof Error ? error.message : '无法打开截图选区',
      });
    });
  });
};

const defaultScreenshotName = (): string => {
  const timestamp = new Date()
    .toISOString()
    .replace('T', '_')
    .replace(/:/g, '-')
    .replace(/\..+$/, '');
  return 'GGD截图_' + timestamp + '.png';
};

export const registerScreenshotHandlers = (): void => {
  ipcMain.handle('capture-screen-region', async event => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender);
    if (!mainWindow) {
      return { success: false, error: '找不到主窗口' };
    }
    if (activeCapture) {
      return { success: false, error: '已有截图选区正在进行' };
    }

    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const physicalWidth = Math.max(1, Math.round(display.bounds.width * display.scaleFactor));
    const physicalHeight = Math.max(1, Math.round(display.bounds.height * display.scaleFactor));

    try {
      mainWindow.hide();
      await delay(160);
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: physicalWidth, height: physicalHeight },
      });
      const availableSources = sources.filter(item => !item.thumbnail.isEmpty());
      const displayLabel = display.label.trim().toLocaleLowerCase();
      const labelMatches = displayLabel
        ? availableSources.filter(
            item => item.name.trim().toLocaleLowerCase() === displayLabel
          )
        : [];
      const source =
        availableSources.find(item => item.display_id === String(display.id)) ||
        (labelMatches.length === 1 ? labelMatches[0] : undefined) ||
        (availableSources.length === 1 ? availableSources[0] : undefined);

      if (!source) {
        restoreMainWindow(mainWindow);
        return {
          success: false,
          error: '无法准确识别当前显示器，请重试或暂时断开其他显示器',
        };
      }

      const screenshot = source.thumbnail;
      const payload: ScreenshotSelectionInit = {
        dataUrl: screenshot.toDataURL(),
        displayWidth: display.bounds.width,
        displayHeight: display.bounds.height,
      };

      return await createSelectionWindow(
        display.bounds,
        payload,
        mainWindow,
        screenshot
      );
    } catch (error) {
      restoreMainWindow(mainWindow);
      return {
        success: false,
        error: error instanceof Error ? error.message : '区域截图失败',
      };
    }
  });

  ipcMain.handle(
    'complete-screenshot-selection',
    async (event, rect: ScreenshotSelectionRect) => {
      const capture = activeCapture;
      if (!capture || capture.overlayWindow.webContents.id !== event.sender.id) {
        return { success: false, error: '截图选区已失效' };
      }

      const normalized = normalizeRect(
        rect,
        capture.displayWidth,
        capture.displayHeight
      );
      if (!normalized) {
        return { success: false, error: '截图区域过小' };
      }

      const imageSize = capture.screenshot.getSize();
      const scaleX = imageSize.width / capture.displayWidth;
      const scaleY = imageSize.height / capture.displayHeight;
      const cropX = Math.max(0, Math.floor(normalized.x * scaleX));
      const cropY = Math.max(0, Math.floor(normalized.y * scaleY));
      const cropWidth = Math.max(
        1,
        Math.min(imageSize.width - cropX, Math.round(normalized.width * scaleX))
      );
      const cropHeight = Math.max(
        1,
        Math.min(imageSize.height - cropY, Math.round(normalized.height * scaleY))
      );
      const cropped = capture.screenshot.crop({
        x: cropX,
        y: cropY,
        width: cropWidth,
        height: cropHeight,
      });

      const result: IpcResult<ScreenshotCaptureResult> = {
        success: true,
        dataUrl: cropped.toDataURL(),
        width: cropWidth,
        height: cropHeight,
      };
      capture.overlayWindow.hide();
      setTimeout(() => settleCapture(result), 0);
      return { success: true };
    }
  );

  ipcMain.handle('cancel-screenshot-selection', async event => {
    if (!activeCapture || activeCapture.overlayWindow.webContents.id !== event.sender.id) {
      return { success: false, error: '没有正在进行的截图' };
    }
    activeCapture.overlayWindow.hide();
    setTimeout(
      () => settleCapture({ success: false, error: '截图已取消', canceled: true }),
      0
    );
    return { success: true };
  });

  ipcMain.handle('save-screenshot', async (_event, dataUrl: string) => {
    try {
      const image = nativeImage.createFromDataURL(dataUrl);
      if (image.isEmpty()) return { success: false, error: '截图数据无效' };
      const result = await dialog.showSaveDialog({
        title: '保存截图',
        defaultPath: path.join(app.getPath('pictures'), defaultScreenshotName()),
        filters: [{ name: 'PNG 图片', extensions: ['png'] }],
      });
      if (result.canceled || !result.filePath) {
        return { success: false, error: '已取消保存', canceled: true };
      }
      await fs.writeFile(result.filePath, image.toPNG());
      return { success: true, filePath: result.filePath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存截图失败',
      };
    }
  });

  ipcMain.handle('copy-screenshot', async (_event, dataUrl: string) => {
    try {
      const image = nativeImage.createFromDataURL(dataUrl);
      if (image.isEmpty()) return { success: false, error: '截图数据无效' };
      clipboard.writeImage(image);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '复制截图失败',
      };
    }
  });
};
