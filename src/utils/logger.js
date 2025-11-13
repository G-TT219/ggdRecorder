class Logger {
  static info(message) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[INFO] ${message}`);
    }
    // 发送到主进程记录
    if (window.electronAPI && window.electronAPI.logInfo) {
      window.electronAPI.logInfo(message);
    }
  }
  
  static error(message, error) {
    console.error(`[ERROR] ${message}`, error);
    // 发送到主进程记录
    if (window.electronAPI && window.electronAPI.logError) {
      const errorMessage = error ? `${message}: ${error.message || error}` : message;
      window.electronAPI.logError(errorMessage);
    }
  }
}

export default Logger;