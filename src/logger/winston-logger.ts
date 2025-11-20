import type { Writable } from 'node:stream'
import winston from 'winston'
import type { EnvConfig } from '../types/env.js'

export interface Logger {
  error(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  debug(message: string, meta?: Record<string, unknown>): void
  child(meta: Record<string, unknown>): Logger
}

export interface LoggerOptions {
  stream?: Writable
}

export function createLogger(config: EnvConfig, options?: LoggerOptions): Logger {
  const transport = options?.stream
    ? new winston.transports.Stream({ stream: options.stream })
    : new winston.transports.Console()

  const winstonLogger = winston.createLogger({
    level: config.LOG_LEVEL,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    defaultMeta: {
      service: 'dify-usage-exporter',
      env: config.NODE_ENV,
    },
    transports: [transport],
  })

  return wrapWinstonLogger(winstonLogger)
}

function wrapWinstonLogger(winstonLogger: winston.Logger): Logger {
  return {
    error: (message, meta) => winstonLogger.error(message, meta),
    warn: (message, meta) => winstonLogger.warn(message, meta),
    info: (message, meta) => winstonLogger.info(message, meta),
    debug: (message, meta) => winstonLogger.debug(message, meta),
    child: (meta) => wrapWinstonLogger(winstonLogger.child(meta)),
  }
}
