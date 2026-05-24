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
        const steps = 10;
        const currentBounds = win.getBounds();
        const widthStep = (width - currentBounds.width) / steps;
        const heightStep = (height - currentBounds.height) / steps;
        for (let i = 1; i <= steps; i++) {
          await new Promise(resolve => setTimeout(resolve, 20));
          win.setBounds({
            x: currentBounds.x, y: currentBounds.y,
            width: Math.round(currentBounds.width + widthStep * i),
            height: Math.round(currentBounds.height + heightStep * i),
          });
        }
      }
      return { success: true };
    } catch { return { success: false, error: 'resize failed' }; }
  });
};
