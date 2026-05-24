import { ipcMain, BrowserWindow } from 'electron';

export const registerWindowHandlers = (): void => {
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

  ipcMain.handle('resize-window', async (_event, width: number, height: number) => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      if (win) {
        win.setBounds({ width, height });
      }
      return { success: true };
    } catch { return { success: false, error: 'resize failed' }; }
  });
};
