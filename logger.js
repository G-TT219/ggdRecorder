const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf, errors } = format;
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// 创建日志目录 - 默认使用用户数据目录下的 logs 文件夹
const getLogsDir = () => {
  // 如果环境变量中指定了用户数据路径，则使用该路径
  if (process.env.USER_DATA_PATH) {
    return path.join(process.env.USER_DATA_PATH, 'logs');
  }

  // 在 Electron 环境中，使用用户数据目录
  try {
    const electron = require('electron');
    if (electron.app) {
      return path.join(electron.app.getPath('userData'), 'logs');
    }
    // 在渲染进程中可能需要通过 remote 获取
    if (electron.remote && electron.remote.app) {
      return path.join(electron.remote.app.getPath('userData'), 'logs');
    }
  } catch (e) {
    // 忽略错误，回退到默认行为
  }

  // 回退到应用程序目录下的 logs 文件夹
  return path.join(__dirname, 'logs');
};

const logsDir = getLogsDir();

// 自定义日志格式
const logFormat = printf(({ level, message, label, timestamp, stack }) => {
  return `${timestamp} [${label}] ${level}: ${message} ${stack ? '\n' + stack : ''}`;
});

// 创建日志记录器
const logger = createLogger({
  format: combine(
    label({ label: 'GGDRecorder' }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }), // 记录错误堆栈
    logFormat
  ),
  transports: [
    // 错误级别日志单独记录到error.log文件
    new transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // 所有日志记录到combined.log文件
    new transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // 每日轮转文件记录器
    new DailyRotateFile({
      filename: path.join(logsDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d'
    })
  ]
});

// 在开发环境中，也输出到控制台
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: combine(
      label({ label: 'GGDRecorder' }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      format.colorize({ all: true }), // 彩色输出
      logFormat
    )
  }));
}

module.exports = logger;