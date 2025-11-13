const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf, errors } = format;
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// 创建日志目录
const logsDir = path.join(__dirname, 'logs');

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