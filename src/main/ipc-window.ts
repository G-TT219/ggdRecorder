import { ipcMain, BrowserWindow } from 'electron';

const DEFAULT_WORKSPACE_SIZE = { width: 1400, height: 1000 };
let rememberedWorkspaceSize = { ...DEFAULT_WORKSPACE_SIZE };

export const registerWindowHandlers = (mainWindow?: BrowserWindow): void => {
  // BrowserWindow resize events also capture manual edge resizing, which does
  // not pass through the renderer's resizeWindow IPC call.
  mainWindow?.on('resize', () => {
    if (!mainWindow.isDestroyed() && !mainWindow.isMaximized()) {
      const [width, height] = mainWindow.getSize();
      if (width >= 700 && height >= 600) rememberedWorkspaceSize = { width, height };
    }
  });
  ipcMain.handle('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.handle('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    }
  });

  ipcMain.handle('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      const { app } = require('electron');
      (app as unknown as Record<string, boolean>).isQuiting = true;
      win.close();
    }
  });

  ipcMain.handle('resize-window', async (event, width: number, height: number) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
      if (win && !win.isDestroyed()) {
        if (win.isMaximized()) win.unmaximize();
        win.setSize(width, height, true);
        win.center();
      }
      return { success: true };
    } catch { return { success: false, error: 'resize failed' }; }
  });

  ipcMain.handle('get-workspace-window-size', () => ({ success: true, ...rememberedWorkspaceSize }));
};
