import { ipcMain } from 'electron';
import Logger from './logger';

type PsListFn = () => Promise<Array<{ pid: number; name: string; cmd?: string }>>;
type PsListModule = { default: PsListFn };
let psList: PsListFn | undefined;
(async () => {
  try {
    const mod = await import('ps-list') as PsListModule;
    psList = mod.default;
  } catch (e) {
    Logger.error('Failed to load ps-list:', e);
  }
})();

export const registerMiscHandlers = (): void => {
  ipcMain.handle('log-info', async (_event, message: string) => {
    Logger.info(`[RENDERER] ${message}`);
  });

  ipcMain.handle('log-error', async (_event, message: string) => {
    Logger.error(`[RENDERER] ${message}`);
  });

  ipcMain.handle('get-game-processes', async () => {
    if (!psList) return [];
    try {
      const processes = await psList();
      const gameNames = ['duck', 'firefox', 'csgo', 'dota2', 'valorant', 'fortnite', 'minecraft', 'edge'];
      return processes
        .filter(p => gameNames.some(g => p.name.toLowerCase().includes(g)))
        .map(p => ({ pid: p.pid, name: p.name.replace(/\.exe$/i, ''), path: p.cmd || 'Unknown path' }));
    } catch {
      return [];
    }
  });
};
