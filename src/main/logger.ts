import winston from 'winston';
import path from 'path';
import { app } from 'electron';

const { createLogger, format, transports } = winston;
const { combine, timestamp, label, printf, errors } = format;

const getLogsDir = () => {
  if (process.env.USER_DATA_PATH) {
    return path.join(process.env.USER_DATA_PATH, 'logs');
  }
  try {
    return path.join(app.getPath('userData'), 'logs');
  } catch {
    return path.join(__dirname, 'logs');
  }
};

const logsDir = getLogsDir();

const logFormat = printf(({ level, message, label: _label, timestamp: _ts, stack }) => {
  return `${_ts} [${_label}] ${level}: ${message}${stack ? '\n' + stack : ''}`;
});

const logger = createLogger({
  format: combine(
    label({ label: 'GGDRecorder' }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    new transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error', maxsize: 5242880, maxFiles: 5 }),
    new transports.File({ filename: path.join(logsDir, 'combined.log'), maxsize: 5242880, maxFiles: 5 }),
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: combine(
      label({ label: 'GGDRecorder' }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      format.colorize({ all: true }),
      logFormat
    )
  }));
}

export default logger;
