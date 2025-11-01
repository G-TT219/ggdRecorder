const { app, BrowserWindow, ipcMain, desktopCapturer, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Get recordings directory path
const getRecordingsDir = () => {
  return path.join(app.getPath('videos'), 'GameRecorder');
};

// Create recordings directory if it doesn't exist
const createRecordingsDir = async () => {
  const recordingsDir = getRecordingsDir();
  try {
    await fs.access(recordingsDir);
  } catch (error) {
    // Directory doesn't exist, create it
    await fs.mkdir(recordingsDir, { recursive: true });
  }
  return recordingsDir;
};

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // Enable media access for desktop capture
      permissions: ['media', 'desktop-capturer'],
      webSecurity: false // Disable web security to allow loading local files
    },
  });

  // and load the index.html of the app.
  const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL;
  console.log('isDev:', isDev);
  console.log('VITE_DEV_SERVER_URL:', process.env.VITE_DEV_SERVER_URL);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    console.log('Loading URL:', url);
    mainWindow.loadURL(url);
  } else {
    // 生产环境中正确加载打包后的文件
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    console.log('Loading file:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();
  
  // Initialize game monitoring
  initializeGameMonitoring();
  
  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Add handler for desktop capturer sources
ipcMain.handle('get-sources', async (event, options) => {
  try {
    const sources = await desktopCapturer.getSources(options);
    return sources;
  } catch (error) {
    console.error('Error getting sources:', error);
    return [];
  }
});

// IPC handlers for recording functionality
let mediaRecorder;
let recordedChunks = [];

ipcMain.handle('start-recording', async (event, options) => {
  try {

    // Get available sources
    const sources = await desktopCapturer.getSources({ 
      types: ['window', 'screen'],
      thumbnailSize: { width: 150, height: 150 }
    });

    // Try to find the matching window by name
    let source;
    if (options.gameName) {
      // Look for a window source that matches the game name
      source = sources.find(src => 
        src.name.toLowerCase().includes(options.gameName.toLowerCase())
      );
      
      // If we didn't find a specific window, try to find any game-like window
      if (!source) {
        const gameIndicators = ['game', 'minecraft', 'fortnite', 'valorant', 'overwatch', 'csgo', 'dota'];
        source = sources.find(src => 
          src.type === 'window' && 
          gameIndicators.some(indicator => 
            src.name.toLowerCase().includes(indicator.toLowerCase())
          )
        );
      }
    }
    
    // Fallback to entire screen if no specific window found
    if (!source) {
      source = sources.find(src => src.name === 'Entire Screen' || src.name === 'Screen 1');
      if (!source) source = sources.find(src => src.type === 'screen');
    }
    
    // Final fallback to first source
    if (!source) source = sources[0];
    
    if (!source) {
      throw new Error('No suitable source found for recording');
    }
    // Send the source ID back to the renderer process to get the stream
    event.sender.send('source-id-selected', source.id, source.name);
    
    return { 
      success: true, 
      message: 'Recording started', 
      sourceId: source.id,
      sourceName: source.name
    };
  } catch (error) {
    console.error('Error starting recording:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('stop-recording', async (event) => {
  try {
    // Logic to stop recording
    console.log('Stopping recording');
    
    // Notify renderer to stop recording
    event.sender.send('stop-recording');
    
    return { success: true, message: 'Recording stopped' };
  } catch (error) {
    console.error('Error stopping recording:', error);
    return { success: false, message: error.message };
  }
});

// Save recording to file
ipcMain.handle('save-recording', async (event, buffer, filename) => {
  try {
    // Get the custom recordings directory or use default
    let recordingsDir;
    try {
      const config = await getAppConfig();
      recordingsDir = config.recordingsDir || await createRecordingsDir();
    } catch (error) {
      recordingsDir = await createRecordingsDir();
    }
    
    const filePath = path.join(recordingsDir, filename);
    // Convert ArrayBuffer to Buffer
    const bufferData = Buffer.from(buffer);
    await fs.writeFile(filePath, bufferData);
    return { success: true, filePath };
  } catch (error) {
    console.error('Error saving recording:', error);
    return { success: false, error: error.message };
  }
});

// Get list of recordings
ipcMain.handle('get-recordings', async () => {
  try {
    // Get the custom recordings directory or use default
    let recordingsDir;
    try {
      const config = await getAppConfig();
      recordingsDir = config.recordingsDir || await createRecordingsDir();
    } catch (error) {
      recordingsDir = await createRecordingsDir();
    }
    
    const files = await fs.readdir(recordingsDir);
    const recordings = [];
    
    for (const file of files) {
      if (file.endsWith('.webm')) {
        const filePath = path.join(recordingsDir, file);
        const stats = await fs.stat(filePath);
        recordings.push({
          id: file,
          name: file.replace('.webm', ''),
          date: stats.birthtime,
          filePath: filePath,
          size: stats.size
        });
      }
    }
    
    // Sort by date, newest first
    recordings.sort((a, b) => b.date - a.date);
    return recordings;
  } catch (error) {
    console.error('Error getting recordings:', error);
    return [];
  }
});

// Delete recording
ipcMain.handle('delete-recording', async (event, filename) => {
  try {
    // Get the custom recordings directory or use default
    let recordingsDir;
    try {
      const config = await getAppConfig();
      recordingsDir = config.recordingsDir || await createRecordingsDir();
    } catch (error) {
      recordingsDir = await createRecordingsDir();
    }
    
    const filePath = path.join(recordingsDir, filename);
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error deleting recording:', error);
    return { success: false, error: error.message };
  }
});

// Read recording file as base64
ipcMain.handle('read-recording', async (event, filePath) => {
  try {
    const data = await fs.readFile(filePath);
    const base64Data = data.toString('base64');
    return { success: true, data: base64Data };
  } catch (error) {
    console.error('Error reading recording:', error);
    return { success: false, error: error.message };
  }
});

// Get app configuration
const getAppConfigPath = () => {
  return path.join(app.getPath('userData'), 'config.json');
};

const getAppConfig = async () => {
  try {
    const configPath = getAppConfigPath();
    const data = await fs.readFile(configPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Return default config if file doesn't exist or is invalid
    return { recordingsDir: null };
  }
};

const saveAppConfig = async (config) => {
  try {
    const configPath = getAppConfigPath();
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving app config:', error);
    return { success: false, error: error.message };
  }
};

// IPC handler to get current recordings directory
ipcMain.handle('get-recordings-dir', async () => {
  try {
    const config = await getAppConfig();
    return {
      success: true,
      recordingsDir: config.recordingsDir || await createRecordingsDir()
    };
  } catch (error) {
    const defaultDir = await createRecordingsDir();
    return { success: true, recordingsDir: defaultDir };
  }
});

// IPC handler to set recordings directory
ipcMain.handle('set-recordings-dir', async (event, dirPath) => {
  try {
    // Verify the directory exists or can be created
    try {
      await fs.access(dirPath);
    } catch (error) {
      // Directory doesn't exist, try to create it
      await fs.mkdir(dirPath, { recursive: true });
    }
    
    // Save the new directory in config
    const config = await getAppConfig();
    config.recordingsDir = dirPath;
    const result = await saveAppConfig(config);
    
    if (result.success) {
      return { success: true, recordingsDir: dirPath };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Error setting recordings directory:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to open directory selection dialog
ipcMain.handle('select-recordings-dir', async (event) => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      const dirPath = result.filePaths[0];
      
      // Save the new directory in config
      const config = await getAppConfig();
      config.recordingsDir = dirPath;
      const saveResult = await saveAppConfig(config);
      
      if (saveResult.success) {
        return { success: true, recordingsDir: dirPath };
      } else {
        return { success: false, error: saveResult.error };
      }
    } else {
      return { success: false, canceled: true };
    }
  } catch (error) {
    console.error('Error selecting recordings directory:', error);
    return { success: false, error: error.message };
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// Game monitoring functionality
function initializeGameMonitoring() {
  // This would be where we implement game process monitoring
  console.log('Initializing game monitoring...');
}

let psList;

// Load ps-list dynamically since it's an ES module
(async () => {
  try {
    psList = await import('ps-list');
  } catch (error) {
    console.error('Failed to load ps-list:', error);
  }
})();

ipcMain.handle('get-game-processes', async () => {
  // Logic to get list of running game processes
  if (!psList) {
    // Return mock data if ps-list is not available
    return [
      { pid: 1234, name: 'Minecraft', path: 'C:\\Program Files\\Minecraft\\Minecraft.exe' },
      { pid: 5678, name: 'Fortnite', path: 'C:\\Games\\Fortnite\\Fortnite.exe' },
      { pid: 9012, name: 'Valorant', path: 'C:\\Riot Games\\Valorant\\Valorant.exe' }
    ];
  }
  
  try {
    const processes = await psList.default();
    
    // Filter for common game processes
    const gameProcessNames = [
      'minecraft', 'fortnite', 'valorant', 'overwatch', 'csgo', 'dota2',
      'lol', 'leagueclient', 'origin', 'uplay', 'epicgameslauncher',
      'genshin', 'among us', 'apex', 'warzone', 'pubg', 'rocket league','duck'
    ];
    
    const gameProcesses = processes.filter(process => 
      gameProcessNames.some(gameName => 
        process.name.toLowerCase().includes(gameName.toLowerCase())
      )
    );
        
    return gameProcesses.map(process => ({
      pid: process.pid,
      name: process.name.replace(/\.exe$/i, ''), // Remove .exe suffix
      path: process.cmd || 'Unknown path'
    }));
  } catch (error) {
    console.error('Error getting processes:', error);
    return [];
  }
});