const { spawn } = require('child_process');
const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, shell, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');

// 定义全局配置变量
let globalConfig = null;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// 开发环境下启用热重载
try {
  if (process.env.NODE_ENV === 'development') {
    // 使用 electron-reloader 实现热重载
    require('electron-reloader')(module, {
      watchRenderer: true,
      ignore: ['node_modules', 'dist', 'logs', 'game-record','out','public']
    });
  }
} catch (err) {
  logger.warn('Failed to load electron-reloader:', err);
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

// Compress video using ffmpeg
const compressVideo = async (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    // Check if ffmpeg is available
    const ffmpegPath = 'ffmpeg'; // You might need to specify the full path to ffmpeg

    const args = [
      '-i', inputPath,
      '-vcodec', 'libx264',
      '-crf', '28', // Compression quality (18-30, higher = more compression)
      '-preset', 'fast', // Encoding speed preset
      '-y', // Overwrite output files
      outputPath
    ];

    const ffmpegProcess = spawn(ffmpegPath, args);

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpegProcess.on('error', (error) => {
      reject(new Error(`Failed to start FFmpeg: ${error.message}`));
    });
  });
};

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 500,
    height: 800,
    icon: path.join(__dirname, 'recorder.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // Enable media access for desktop capture
      permissions: ['media', 'desktop-capturer'],
      webSecurity: false // Disable web security to allow loading local files
    },
  });

  // Remove default menu bar
  mainWindow.setMenu(null);

  // and load the index.html of the app.
  const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL;
  logger.info('isDev:', isDev);
  logger.info('VITE_DEV_SERVER_URL:', process.env.VITE_DEV_SERVER_URL);
  logger.info('NODE_ENV:', process.env.NODE_ENV);
  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    logger.info('Loading URL:', url);
    mainWindow.loadURL(url);
  } else {
    // 生产环境中正确加载打包后的文件
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    logger.info('Loading file:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  // Open the DevTools.
  if(isDev)
    mainWindow.webContents.openDevTools();

  // Register shortcut to toggle dev tools
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    mainWindow.webContents.toggleDevTools();
  });

  globalShortcut.register('F12', () => {
    mainWindow.webContents.toggleDevTools();
  });

  return mainWindow;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  const mainWindow = createWindow();

  // Load global config
  try {
    globalConfig = await getAppConfig();
    logger.info('Global config loaded:', globalConfig);
  } catch (error) {
    logger.error('Error loading global config:', error);
    // Initialize with default config
    globalConfig = { recordingsDir: null };
  }

  // Initialize game monitoring
  initializeGameMonitoring();

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Unregister all shortcuts when the app is closing
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
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
    logger.error('Error getting sources:', error);
    return [];
  }
});

// IPC handlers for recording functionality
let mediaRecorder;
let recordedChunks = [];

ipcMain.handle('pre-fetch-source', async (event, options) => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 150, height: 150 }
    });
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
    return {
      success: true,
      message: 'Recording started',
      source: {
        sourceId: source.id,
        sourceName: source.name
      }
    };
  } catch (error) {
    logger.error('Error get source:', error);
    return { success: false, message: error.message };
  }
})

ipcMain.handle('stop-recording', async (event) => {
  try {
    // Logic to stop recording
    logger.info('Stopping recording');

    // Notify renderer to stop recording
    event.sender.send('stop-recording');

    return { success: true, message: 'Recording stopped' };
  } catch (error) {
    logger.error('Error stopping recording:', error);
    return { success: false, message: error.message };
  }
});

// Save recording to file
ipcMain.handle('save-recording', async (event, buffer, filename, shouldCompress = false) => {
  try {
    // Get the custom recordings directory or use default
    let recordingsDir;
    try {
      recordingsDir = globalConfig.recordingsDir || await createRecordingsDir();
    } catch (error) {
      recordingsDir = await createRecordingsDir();
    }

    const filePath = path.join(recordingsDir, filename);
    // Convert ArrayBuffer to Buffer
    const bufferData = Buffer.from(buffer);

    if (shouldCompress) {
      // Save original file first
      const tempPath = path.join(recordingsDir, `temp_${Date.now()}_${filename}`);
      await fs.writeFile(tempPath, bufferData);

      try {
        // Compress the video
        const compressedPath = path.join(recordingsDir, filename.replace('.webm', '_compressed.mp4'));
        await compressVideo(tempPath, compressedPath);

        // Remove the temporary file
        await fs.unlink(tempPath);

        // Return the compressed file path
        return { success: true, filePath: compressedPath };
      } catch (compressError) {
        logger.error('Error compressing video:', compressError);
        // If compression fails, keep the original file
        await fs.unlink(tempPath);
        await fs.writeFile(filePath, bufferData);
        return { success: true, filePath, warning: 'Compression failed, saved original file' };
      }
    } else {
      await fs.writeFile(filePath, bufferData);
      return { success: true, filePath };
    }
  } catch (error) {
    logger.error('Error saving recording:', error);
    return { success: false, error: error.message };
  }
});

// Get list of recordings
ipcMain.handle('get-recordings', async () => {
  try {
    // Get the custom recordings directory or use default
    let recordingsDir;
    try {
      recordingsDir = globalConfig.recordingsDir || await createRecordingsDir();
    } catch (error) {
      recordingsDir = await createRecordingsDir();
    }

    const files = await fs.readdir(recordingsDir);
    const recordings = [];

    for (const file of files) {
      // Check for both webm and mp4 files
      if (file.endsWith('.webm') || file.endsWith('.mp4')) {
        const filePath = path.join(recordingsDir, file);
        const stats = await fs.stat(filePath);
        recordings.push({
          id: file,
          name: file.replace('.webm', '').replace('_compressed.mp4', ''),
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
    logger.error('Error getting recordings:', error);
    return [];
  }
});

// Delete recording
ipcMain.handle('delete-recording', async (event, filename) => {
  try {
    // Get the custom recordings directory or use default
    let recordingsDir;
    try {
      recordingsDir = globalConfig.recordingsDir || await createRecordingsDir();
    } catch (error) {
      recordingsDir = await createRecordingsDir();
    }

    const filePath = path.join(recordingsDir, filename);
    await fs.unlink(filePath);

    // Delete corresponding thumbnail if it exists
    const cacheDir = path.join(app.getPath('userData'), 'cache', 'thumbnails');
    const thumbnailPath = path.join(cacheDir, filename.replace(/\.[^/.]+$/, '_thumb.png'));
    try {
      await fs.unlink(thumbnailPath);
    } catch (error) {
      // Thumbnail may not exist, that's okay
      logger.info('Thumbnail not found or already deleted:', thumbnailPath);
    }

    return { success: true };
  } catch (error) {
    logger.error('Error deleting recording:', error);
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
    logger.error('Error reading recording:', error);
    return { success: false, error: error.message };
  }
});

// Generate thumbnail for a video file
ipcMain.handle('generate-thumbnail', async (event, filePath) => {
  try {
    const cacheDir = path.join(app.getPath('userData'), 'cache', 'thumbnails');
    const filename = path.basename(filePath);
    const thumbnailPath = path.join(cacheDir, filename.replace(/\.[^/.]+$/, '_thumb.png'));

    // Ensure cache directory exists
    try {
      await fs.access(cacheDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(cacheDir, { recursive: true });
    }

    // Check if thumbnail already exists
    try {
      await fs.access(thumbnailPath);
      const thumbnailData = await fs.readFile(thumbnailPath);
      return { success: true, data: thumbnailData.toString('base64') };
    } catch (error) {
      // Thumbnail doesn't exist, generate it
      return await generateVideoThumbnail(filePath, thumbnailPath);
    }
  } catch (error) {
    logger.error('Error generating thumbnail:', error);
    return { success: false, error: error.message };
  }
});

// Function to generate video thumbnail using ffmpeg
const generateVideoThumbnail = async (videoPath, thumbnailPath) => {
  return new Promise((resolve, reject) => {
    // Use ffmpeg to extract a frame from the video at 1 second mark
    const ffmpegPath = 'ffmpeg'; // You might need to specify the full path to ffmpeg

    const args = [
      '-i', videoPath,
      '-ss', '00:00:01.000', // Seek to 1 second
      '-vframes', '1',       // Extract only 1 frame
      '-vf', 'scale=320:180', // Scale to thumbnail size
      '-y',                  // Overwrite output files
      thumbnailPath
    ];

    const ffmpegProcess = spawn(ffmpegPath, args);

    ffmpegProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          // Read the generated thumbnail
          const thumbnailData = await fs.readFile(thumbnailPath);
          resolve({ success: true, data: thumbnailData.toString('base64') });
        } catch (readError) {
          reject(new Error(`Failed to read thumbnail: ${readError.message}`));
        }
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    ffmpegProcess.on('error', (error) => {
      reject(new Error(`Failed to start FFmpeg: ${error.message}`));
    });
  });
};

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
    // Update global config
    globalConfig = config;
    return { success: true };
  } catch (error) {
    logger.error('Error saving app config:', error);
    return { success: false, error: error.message };
  }
};

ipcMain.handle('get-app-config', async () => {
  try {
    return { success: true, config: globalConfig };
  } catch (error) {
    logger.error('Error getting app config:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-compressVideos', async (event, compressVideos) => {
  try {
    globalConfig.compressVideos = compressVideos;
    const result = await saveAppConfig(globalConfig);
    if (result.success) {
      return { success: true, compressVideos: compressVideos };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    logger.error('Error saving compressVideos config:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to get current recordings directory
ipcMain.handle('get-recordings-dir', async () => {
  try {
    return {
      success: true,
      recordingsDir: globalConfig.recordingsDir || await createRecordingsDir()
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
    globalConfig.recordingsDir = dirPath;
    const result = await saveAppConfig(globalConfig);

    if (result.success) {
      return { success: true, recordingsDir: dirPath };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    logger.error('Error setting recordings directory:', error);
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
      globalConfig.recordingsDir = dirPath;
      const saveResult = await saveAppConfig(globalConfig);

      if (saveResult.success) {
        return { success: true, recordingsDir: dirPath };
      } else {
        return { success: false, error: saveResult.error };
      }
    } else {
      return { success: false, canceled: true };
    }
  } catch (error) {
    logger.error('Error selecting recordings directory:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-dir', async (event, path) => {
  try {
    shell.openPath(path);
    return { success: true };
  } catch (error) {
    logger.error('Error opening recordings directory:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-game-path', async () => {
  try {
    if (globalConfig.gamePath)
      return { success: true, gamePath: globalConfig.gamePath }
    else 
      return { success: false, error: "please select game path" }
  } catch (error) {
    logger.error('Error getting game paths:', error);
    return { success: false, error: error.message };
  }
})

ipcMain.handle('select-game-path', async (event, gamePath) => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Executable Files', extensions: ['exe'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const gamePath = result.filePaths[0];
      // Save the new game path in config 
      globalConfig.gamePath = gamePath;
      const saveResult = await saveAppConfig(globalConfig);
      if (saveResult.success) {
        return { success: true, gamePath: gamePath }
      } else {
        return { success: false, error: saveResult.error }
      }
    } else {
      return { success: false, canceled: true };
    }
  }
  catch (error) {
    logger.error('Error selecting game path:', error);
    return { success: false, error: error.message };
  }
})

ipcMain.handle('start-game', (event, gamePath) => {
  try {
    const result = spawn(gamePath, { detached: true });
    if (result) return { success: true };
  } catch (error) {
    logger.error('Error starting game:', error);
  }
})

ipcMain.handle('log-info', async (event, message) => {
  logger.info(`[RENDERER] ${message}`);
});

ipcMain.handle('log-error', async (event, message) => {
  logger.error(`[RENDERER] ${message}`);
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// Game monitoring functionality
function initializeGameMonitoring() {
  // This would be where we implement game process monitoring
  logger.info('Initializing game monitoring...');
}

let psList;

// Load ps-list dynamically since it's an ES module
(async () => {
  try {
    psList = await import('ps-list');
  } catch (error) {
    logger.error('Failed to load ps-list:', error);
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
      'duck'
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
    logger.error('Error getting processes:', error);
    return [];
  }
});