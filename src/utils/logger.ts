class Logger {
  static info(message: string) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[INFO] ${message}`);
    }
    if (window.electronAPI && window.electronAPI.logInfo) {
      window.electronAPI.logInfo(message);
    }
  }

  static error(message: string, error?: unknown) {
    console.error(`[ERROR] ${message}`, error);
    if (window.electronAPI && window.electronAPI.logError) {
      const errorMessage = error instanceof Error ? `${message}: ${error.message}` : error ? `${message}: ${String(error)}` : message;
      window.electronAPI.logError(errorMessage);
    }
  }
}

export default Logger;
