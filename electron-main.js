const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, shell, globalShortcut, Tray, Menu, protocol, net } = require('electron');
const path = require('path');
const { Readable } = require('stream');
const fs = require('fs').promises;
const fsSync = require('fs');
const logger = require('./logger');
const {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} = require("@google/genai");
const { setGlobalDispatcher, ProxyAgent } = require("undici");
const { config } = require("dotenv");

// 加载 .env 文件中的环境变量
config();

// 定义全局配置变量
let globalConfig = null;
let tray = null;
const recordingUrlMap = new Map();
let pendingRecordingTarget = null;

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
      ignore: ['node_modules', 'dist', 'logs', 'game-record', 'out', 'public']
    });
  }
} catch (err) {
  logger.warn('Failed to load electron-reloader:', err);
}

// 获取正确的资源路径
const getAssetPath = (...paths) => path.join(__dirname, ...paths);

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

const isPathInside = (parentPath, childPath) => {
  const parent = path.resolve(parentPath);
  const child = path.resolve(childPath);
  const relative = path.relative(parent, child);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
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
    minWidth: 480,
    minHeight: 600,
    icon: getAssetPath('recorder.ico'),
    frame: false, // 无边框窗口
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // 启用 WebRTC 需要安全上下文 (webSecurity:true)
      webSecurity: true,
      sandbox: false
    },
  });

  // 完全禁用 CSP，移除所有安全限制
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };

    // 删除所有可能存在的 CSP 头（包括大小写变体）
    delete responseHeaders['Content-Security-Policy'];
    delete responseHeaders['content-security-policy'];
    delete responseHeaders['Content-Security-Policy-Report-Only'];
    delete responseHeaders['content-security-policy-report-only'];

    // 添加权限策略允许桌面录制、媒体设备和全屏
    responseHeaders['Permissions-Policy'] = [
      'camera=(self)',
      'microphone=(self)',
      'display-capture=(self)',
      'media=(self)',
      'fullscreen=(self)'
    ];

    callback({ responseHeaders });
  });

  // 设置权限自动授予
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'mediaKeySystem', 'microphone', 'camera', 'display-capture', 'fullscreen'];
    callback(allowedPermissions.includes(permission));
  });

  // getDisplayMedia 时自动匹配已选游戏窗口，不弹出系统选择器
  mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['window', 'screen'] }).then(sources => {
      let source;
      if (pendingRecordingTarget) {
        source = sources.find(src =>
          src.name.toLowerCase().includes(pendingRecordingTarget.toLowerCase())
        );
        pendingRecordingTarget = null;
      }
      if (!source) source = sources.find(src => src.type === 'screen');
      if (!source) source = sources[0];
      callback({ video: source || request.requestedVideoSources?.[0], audio: 'loopback' });
    }).catch(() => callback({ video: request.requestedVideoSources?.[0] }));
  });

  // Remove default menu bar
  mainWindow.setMenu(null);

  // 当窗口被关闭时，最小化到系统托盘而不是退出
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  // and load the index.html of the app.
  const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL;
  logger.info('isDev:' + isDev);
  logger.info('VITE_DEV_SERVER_URL:' + process.env.VITE_DEV_SERVER_URL);
  logger.info('NODE_ENV:' + process.env.NODE_ENV);
  if (isDev) {
    const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    logger.info('Loading URL:', url);
    mainWindow.loadURL(url);
  } else {
    // 生产环境中正确加载打包后的文件
    const indexPath = getAssetPath('dist', 'index.html');
    logger.info('Loading index.html file:' + indexPath);
    
    // 使用 app:// 自定义协议加载，确保资源路径正确
    mainWindow.loadURL('app://./index.html');
  }

  // Open the DevTools.
  if (isDev)
    mainWindow.webContents.openDevTools();

  // Register shortcut to toggle dev tools
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    mainWindow.webContents.toggleDevTools();
  });

  globalShortcut.register('F12', () => {
    mainWindow.webContents.toggleDevTools();
  });

  // Register shortcut for start recording
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    mainWindow.webContents.send('start-recording-shortcut');
  });

  // Register shortcut for stop recording
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    mainWindow.webContents.send('stop-recording-shortcut');
  });

  return mainWindow;
};

// 创建系统托盘
const createTray = (mainWindow) => {
  // 使用应用图标作为托盘图标
  const iconPath = getAssetPath('recorder.ico');
  tray = new Tray(iconPath);

  // 创建托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // 设置托盘图标提示
  tray.setToolTip('ggdRecorder');

  // 点击托盘图标时显示窗口
  tray.on('click', () => {
    mainWindow.show();
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

// 注册 app:// 协议为安全协议（需要 webSecurity:true 时才能启用 mediaDevices）
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } },
  { scheme: 'recording', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true } }
]);

app.whenReady().then(async () => {
  // 注册自定义协议来处理静态资源请求
  protocol.handle('app', (request) => {
    const url = request.url.replace('app://.', '');
    const decodedUrl = decodeURIComponent(url);
    const filePath = path.join(__dirname, 'dist', decodedUrl);
    logger.info(`App protocol serving: ${decodedUrl} -> ${filePath}`);
    return net.fetch('file://' + filePath.replace(/\\/g, '/'));
  });

  protocol.handle('recording', async (request) => {
    try {
      const url = new URL(request.url);
      const token = url.pathname.split('/').filter(Boolean)[0];
      const filePath = recordingUrlMap.get(token);
      if (filePath && fsSync.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === '.mp4' ? 'video/mp4' : 'video/webm';
        const stat = fsSync.statSync(filePath);
        const fileSize = stat.size;
        const range = request.headers.get('range');

        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const nodeStream = fsSync.createReadStream(filePath, { start, end });
          const webStream = Readable.toWeb(nodeStream);
          return new Response(webStream, {
            status: 206,
            headers: {
              'Content-Type': mime,
              'Content-Range': 'bytes ' + start + '-' + end + '/' + fileSize,
              'Content-Length': String(end - start + 1),
              'Accept-Ranges': 'bytes'
            }
          });
        }

        const nodeStream = fsSync.createReadStream(filePath);
        const webStream = Readable.toWeb(nodeStream);
        return new Response(webStream, {
          headers: {
            'Content-Type': mime,
            'Content-Length': String(fileSize),
            'Accept-Ranges': 'bytes'
          }
        });
      }
    } catch (error) {
      logger.error('Error serving recording:', error);
    }
    return new Response(null, { status: 404 });
  });

  const mainWindow = createWindow();

  // 创建系统托盘
  createTray(mainWindow);

  // Load global config
  try {
    globalConfig = await getAppConfig();
    logger.info('Global config loaded');
  } catch (error) {
    logger.error('Error loading global config:' + error);
    // Initialize with default config
    globalConfig = { recordingsDir: null };
  }

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

  try {
    const envPath = app.isPackaged
      ? path.join(process.resourcesPath,'.env')
      : path.join(__dirname, '.env');
    config({ path: envPath });
    //全局fetch调用启用代理
    logger.info('Using proxy:' + process.env.https_proxy);
    const dispatcher = new ProxyAgent({ uri: new URL(process.env.https_proxy).toString() });
    setGlobalDispatcher(dispatcher);
  } catch (error) {
    logger.error('Error loading env file:' + error);
  }

});


// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 当窗口关闭时最小化到托盘而不是退出应用
app.on('before-quit', (event) => {
  app.isQuiting = true;
  tray.destroy();
});

ipcMain.handle('set-recording-target', async (event, gameName) => {
  pendingRecordingTarget = gameName;
  return { success: true };
});

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
    let recordingsDir;
    try {
      recordingsDir = globalConfig.recordingsDir || await createRecordingsDir();
    } catch (error) {
      recordingsDir = await createRecordingsDir();
    }

    const filePath = path.join(recordingsDir, path.basename(filename));
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

ipcMain.handle('get-recording-url', async (event, filePath) => {
  try {
    const recordingsDir = globalConfig.recordingsDir || await createRecordingsDir();
    const resolvedFilePath = path.resolve(filePath);

    if (!isPathInside(recordingsDir, resolvedFilePath)) {
      return { success: false, error: 'Recording path is outside recordings directory' };
    }

    if (!resolvedFilePath.endsWith('.webm') && !resolvedFilePath.endsWith('.mp4')) {
      return { success: false, error: 'Unsupported recording file type' };
    }

    await fs.access(resolvedFilePath);
    const token = randomUUID();
    recordingUrlMap.set(token, resolvedFilePath);

    return {
      success: true,
      url: `recording://local/${token}/${encodeURIComponent(path.basename(resolvedFilePath))}`
    };
  } catch (error) {
    logger.error('Error creating recording URL:', error);
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

// Get favorites configuration path
const getFavoritesConfigPath = () => {
  return path.join(app.getPath('userData'), 'favorites.json');
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

// Get favorites configuration
const getFavoritesConfig = async () => {
  try {
    const favoritesPath = getFavoritesConfigPath();
    const data = await fs.readFile(favoritesPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Return empty favorites if file doesn't exist or is invalid
    return { favorites: [] };
  }
};

// Save favorites configuration
const saveFavoritesConfig = async (favorites) => {
  try {
    const favoritesPath = getFavoritesConfigPath();
    await fs.writeFile(favoritesPath, JSON.stringify(favorites, null, 2));
    return { success: true };
  } catch (error) {
    logger.error('Error saving favorites config:', error);
    return { success: false, error: error.message };
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

ipcMain.handle('open-dir', async (event, dirPath) => {
  try {
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) {
      return { success: false, error: 'Path is not a directory' };
    }
    shell.openPath(dirPath);
    return { success: true };
  } catch (error) {
    logger.error('Error opening directory:', error);
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

// 调整窗口大小
ipcMain.handle('resize-window', async (event, width, height) => {
  try {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      // 使用动画效果平滑调整
      const currentBounds = win.getBounds();
      const steps = 10;
      const widthStep = (width - currentBounds.width) / steps;
      const heightStep = (height - currentBounds.height) / steps;
      
      for (let i = 1; i <= steps; i++) {
        await new Promise(resolve => setTimeout(resolve, 20));
        win.setBounds({
          x: currentBounds.x,
          y: currentBounds.y,
          width: Math.round(currentBounds.width + widthStep * i),
          height: Math.round(currentBounds.height + heightStep * i)
        });
      }
      
      return { success: true };
    }
    return { success: false, error: 'No window found' };
  } catch (error) {
    logger.error('Error resizing window:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('log-info', async (event, message) => {
  logger.info(`[RENDERER] ${message}`);
});

ipcMain.handle('log-error', async (event, message) => {
  logger.error(`[RENDERER] ${message}`);
});

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
      'duck', 'firefox','csgo', 'dota2', 'valorant', 'fortnite', 'minecraft','edge'
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const analyze = async (path, apiKey) => {
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const myfile = await ai.files.upload({
      file: path,
      config: { mimeType: "video/webm" },
    });

    let fileState = myfile.state; // 获取当前状态
    // 只要状态是 "PROCESSING" 就一直等待
    while (fileState === "PROCESSING") {
      await sleep(2000);  // 等待 2 秒

      const freshFile = await ai.files.get({ name: myfile.name });
      fileState = freshFile.state;

      // 检查是否有错误状态
      if (fileState === "FAILED") {
        throw new Error("视频处理失败 (FAILED)，请检查视频格式是否受支持。");
      }
    }

    logger.info("视频处理完毕 (ACTIVE)，开始请求模型");

    const prompt = "你是一个鹅鸭杀游戏高手，你可以在游戏界面右上角的地图确认玩家的位置，你可以在游戏界面左上角获取玩家阵营和身份信息。"
      + "这里有一份地点名称列表供你参考：[祭坛，前堂，书房，礼堂，储物间，储物柜，奇珍异品收藏室，地牢，隧道，隧道入口，坑，实验室，锅炉房，走廊，雾洞]。"
      + "这是一局鹅鸭杀游戏的录像，请你简单描述被玩家操控的角色的主要行动轨迹，"
      + "以及在哪里什么时候遇上了什么玩家、以及这些玩家值得关注的行为。"
      + "并根据这些信息提供一个20s的会议发言稿，需要包括我的行动轨迹，遇上的人，和怀疑目标";
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: createUserContent([
        createPartFromUri(myfile.uri, myfile.mimeType),
        prompt
      ]),
    });
    ai.files.delete({ name: myfile.name });
    return response.text;
  } catch (e) {
    throw e;
  }
}


// 在 electron-main.js 中添加ai调用功能
ipcMain.handle('analyze-recording', async (event, filePath) => {
  try {
    const apiKey = globalConfig.apiKey;
    if (!apiKey) return { success: false, error: 'API key not found' };
    const result = await analyze(filePath, apiKey);
    return {
      success: true,
      text: result
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-api-key', async (event, apiKey) => {
  try {
    globalConfig.apiKey = apiKey;
    const result = await saveAppConfig(globalConfig);
    return { success: true };
  } catch (error) {
    logger.error('Error saving API key:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-api-key', async () => {
  try {
    const apiKey = globalConfig.apiKey || '';
    return { success: true, apiKey: apiKey };
  } catch (error) {
    // 如果文件不存在或其他错误，返回空的API密钥
    if (error.code === 'ENOENT') {
      return { success: true, apiKey: '' };
    } else {
      logger.error('Error loading API key:', error);
      return { success: false, error: error.message };
    }
  }
});

ipcMain.handle('clear-api-key', async () => {
  try {
    globalConfig.apiKey = '';
    const result = await saveAppConfig(globalConfig);
    return { success: true };
  } catch (error) {
    // 如果文件不存在，也视为成功
    if (error.code === 'ENOENT') {
      return { success: true };
    } else {
      logger.error('Error clearing API key:', error);
      return { success: false, error: error.message };
    }
  }
});

// GGD Token handlers
ipcMain.handle('save-ggd-token', async (event, token) => {
  try {
    globalConfig.ggdToken = token;
    const result = await saveAppConfig(globalConfig);
    logger.info('GGD Token saved successfully');
    return { success: true };
  } catch (error) {
    logger.error('Error saving GGD Token:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-ggd-token', async () => {
  try {
    const token = globalConfig.ggdToken || '';
    return { success: true, token: token };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: true, token: '' };
    } else {
      logger.error('Error loading GGD Token:', error);
      return { success: false, error: error.message };
    }
  }
});

ipcMain.handle('clear-ggd-token', async () => {
  try {
    globalConfig.ggdToken = '';
    const result = await saveAppConfig(globalConfig);
    logger.info('GGD Token cleared successfully');
    return { success: true };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { success: true };
    } else {
      logger.error('Error clearing GGD Token:', error);
      return { success: false, error: error.message };
    }
  }
});

// Favorite recordings handlers
ipcMain.handle('get-favorite-recordings', async () => {
  try {
    const favorites = await getFavoritesConfig();
    return { success: true, favorites: favorites.favorites || [] };
  } catch (error) {
    logger.error('Error getting favorite recordings:', error);
    return { success: true, favorites: [] };
  }
});

ipcMain.handle('toggle-favorite-recording', async (event, recordingId, isFavorite) => {
  try {
    const favorites = await getFavoritesConfig();
    const favoriteList = favorites.favorites || [];

    if (isFavorite) {
      // Add to favorites
      if (!favoriteList.includes(recordingId)) {
        favoriteList.push(recordingId);
      }
    } else {
      // Remove from favorites
      const index = favoriteList.indexOf(recordingId);
      if (index > -1) {
        favoriteList.splice(index, 1);
      }
    }

    const result = await saveFavoritesConfig({ favorites: favoriteList });
    if (result.success) {
      return { success: true, favorites: favoriteList };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    logger.error('Error toggling favorite recording:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-favorite-to-directory', async (event, filePath, recordingName) => {
  try {
    // 确保文件名有正确的扩展名
    const defaultFileName = recordingName.endsWith('.webm') || recordingName.endsWith('.mp4')
      ? recordingName
      : `${recordingName}.webm`;

    const result = await dialog.showSaveDialog({
      title: '保存录像',
      defaultPath: defaultFileName,
      filters: [
        { name: '视频文件', extensions: ['webm', 'mp4'] },
        { name: 'WebM 视频', extensions: ['webm'] },
        { name: 'MP4 视频', extensions: ['mp4'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['showOverwriteConfirmation']
    });

    if (!result.canceled && result.filePath) {
      const targetPath = result.filePath;

      // Copy the file
      const sourceData = await fs.readFile(filePath);
      await fs.writeFile(targetPath, sourceData);

      return { success: true, savePath: targetPath };
    } else {
      return { success: false, canceled: true };
    }
  } catch (error) {
    logger.error('Error saving favorite to directory:', error);
    return { success: false, error: error.message };
  }
});

// Window control handlers
ipcMain.handle('window-minimize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    window.minimize();
  }
});

ipcMain.handle('window-maximize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  }
});

ipcMain.handle('window-close', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window) {
    app.isQuiting = true;
    window.close();
  }
});

// Fetch match data through main process to avoid CORS
ipcMain.handle('fetch-match-data', async (event, matchId) => {
  try {
    const https = require('https');
    const { HttpsProxyAgent } = require('https-proxy-agent');
    const { SocksProxyAgent } = require('socks-proxy-agent');
    
    return new Promise((resolve, reject) => {
      const url = `https://ggdmatchdata.gaggle.fun/match-timelines/${matchId}.json`;
      
      // 检测环境变量中的代理配置
      const proxyUrl = process.env.https_proxy ||process.env.http_proxy || process.env.all_proxy;
      
      let agent = undefined;
      if (proxyUrl) {
        // 判断是否为 SOCKS5 代理
        if (proxyUrl.startsWith('socks5://') || proxyUrl.startsWith('socks://')) {
          agent = new SocksProxyAgent(proxyUrl);
          logger.info(`Fetch match data - Using SOCKS5 proxy: ${proxyUrl}`);
        } else {
          agent = new HttpsProxyAgent(proxyUrl);
          logger.info(`Fetch match data - Using HTTP/HTTPS proxy: ${proxyUrl}`);
        }
      } else {
        logger.info('Fetch match data - No proxy configured, using direct connection');
      }
      
      logger.info(`Fetch match data - Match ID: ${matchId}`);
      logger.info(`Fetch match data - URL: ${url}`)
      const request = https.get(url, {
        agent: agent,
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://gaggle.fun/',
          'Origin': 'https://gaggle.fun',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0'
        }
      }, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            if (response.statusCode === 200) {
              const jsonData = JSON.parse(data);
              logger.info('print http response:', JSON.stringify(jsonData));
              resolve({ success: true, data: jsonData });
            } else {
              resolve({ 
                success: false, 
                error: `HTTP Error: ${response.statusCode}`,
                statusCode: response.statusCode
              });
            }
          } catch (parseError) {
            resolve({ 
              success: false, 
              error: `JSON Parse Error: ${parseError.message}` 
            });
          }
        });
      });
      
      request.on('error', (error) => {
        resolve({ 
          success: false, 
          error: `Network Error: ${error.message}` 
        });
      });
      
      request.setTimeout(10000, () => {
        request.destroy();
        resolve({ 
          success: false, 
          error: 'Request timeout' 
        });
      });
    });
  } catch (error) {
    return { 
      success: false, 
      error: `Unexpected Error: ${error.message}` 
    };
  }
});

// Fetch match history list
ipcMain.handle('fetch-match-history', async (event, userId) => {
  try {
    const https = require('https');
    const { HttpsProxyAgent } = require('https-proxy-agent');
    
    return new Promise((resolve, reject) => {
      const url = 'https://us-central1-gaggle-staging.cloudfunctions.net/ggdPlayerMatch?action=FetchList';
      
      const postData = JSON.stringify({ uid: userId });
      
      // 检测环境变量中的代理配置
      const proxyUrl = process.env.http_proxy || process.env.https_proxy || process.env.all_proxy;
      
      let agent = undefined;
      if (proxyUrl) {
          agent = new HttpsProxyAgent(proxyUrl);
          logger.info(`Using HTTP/HTTPS proxy: ${proxyUrl}`);
      } else {
        logger.info('No proxy configured, using direct connection');
      }
      
      // 使用配置的 GGD Token（无默认值，需用户在设置中填写）
      const ggdToken = globalConfig.ggdToken || '';
      
      const options = {
        method: 'POST',
        agent: agent,
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'accept-language':'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
          'cache-control': 'no-cache',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ggdToken}`,
          'Origin': 'https://gaggle.fun',
          'Referer': 'https://gaggle.fun/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 Edg/147.0.0.0',
          'sec-ch-ua':'"Microsoft Edge";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'cross-site'
        }
      };
      logger.info(`Fetch match history - User ID: ${userId}`);
      logger.info(`Fetch match history - Request URL: ${url}`);
      logger.info(`Fetch match history - Request Method: POST`);
      logger.info(`Fetch match history - Request Body: ${postData}`);
      
      // 打印请求头（逐个字段）
      console.log('\n========== Fetch Match History Request ==========');
      console.log('URL:', url);
      console.log('Method: POST');
      console.log('Body:', postData);
      console.log('Proxy:', proxyUrl || 'None');
      console.log('Headers:');
      Object.keys(options.headers).forEach(key => {
        const value = key === 'Authorization' ? 'Bearer [HIDDEN]' : options.headers[key];
        console.log(`  ${key}: ${value}`);
      });
      console.log('===============================================\n');
      
      const request = https.request(url, options, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            if (response.statusCode === 200) {
              const jsonData = JSON.parse(data);
              logger.info(`Fetch match history - Success! Received ${data.length} bytes`);
              resolve({ success: true, data: jsonData });
            } else {
              // 打印详细的错误响应信息
              console.log('\n========== HTTP Error Response ==========');
              console.log('Status Code:', response.statusCode);
              console.log('Status Message:', response.statusMessage);
              console.log('Response Headers:');
              Object.keys(response.headers).forEach(key => {
                console.log(`  ${key}: ${response.headers[key]}`);
              });
              console.log('Response Body:', data);
              console.log('=========================================\n');
              
              logger.error(`Fetch match history - HTTP Error ${response.statusCode}: ${response.statusMessage}`);
              logger.error(`Fetch match history - Response Body: ${data}`);
              
              resolve({ 
                success: false, 
                error: `HTTP Error: ${response.statusCode} ${response.statusMessage}`,
                statusCode: response.statusCode,
                statusMessage: response.statusMessage,
                responseBody: data,
                responseHeaders: response.headers
              });
            }
          } catch (parseError) {
            // JSON 解析失败时也打印详细信息
            console.log('\n========== JSON Parse Error ==========');
            console.log('Status Code:', response.statusCode);
            console.log('Raw Response Data:', data);
            console.log('Parse Error:', parseError.message);
            console.log('======================================\n');
            
            logger.error(`Fetch match history - JSON Parse Error: ${parseError.message}`);
            logger.error(`Fetch match history - Raw data: ${data.substring(0, 500)}...`);
            
            resolve({ 
              success: false, 
              error: `JSON Parse Error: ${parseError.message}`,
              rawResponse: data
            });
          }
        });
      });
      
      request.on('error', (error) => {
        // 打印详细的网络错误信息
        console.log('\n========== Network Error ==========');
        console.log('Error Type:', error.name || 'Unknown');
        console.log('Error Message:', error.message);
        console.log('Error Code:', error.code || 'N/A');
        console.log('Error Stack:', error.stack || 'No stack trace');
        console.log('Request URL:', url);
        console.log('Proxy Used:', proxyUrl || 'None');
        console.log('===================================\n');
        
        logger.error(`Fetch match history - Network Error: ${error.message}`);
        logger.error(`Fetch match history - Error Code: ${error.code}`);
        logger.error(`Fetch match history - Error Name: ${error.name}`);
        if (error.stack) {
          logger.error(`Fetch match history - Stack Trace:\n${error.stack}`);
        }
        
        resolve({ 
          success: false, 
          error: `Network Error: ${error.message}`,
          errorCode: error.code,
          errorName: error.name,
          errorStack: error.stack
        });
      });
      
      request.setTimeout(10000, () => {
        request.destroy();
        
        console.log('\n========== Request Timeout ==========');
        console.log('Timeout: 10 seconds');
        console.log('Request URL:', url);
        console.log('Proxy Used:', proxyUrl || 'None');
        console.log('=====================================\n');
        
        logger.error('Fetch match history - Request timeout after 10 seconds');
        
        resolve({ 
          success: false, 
          error: 'Request timeout (10s)',
          timeout: true
        });
      });
      
      request.write(postData);
      request.end();
    });
  } catch (error) {
    return { 
      success: false, 
      error: `Unexpected Error: ${error.message}` 
    };
  }
});