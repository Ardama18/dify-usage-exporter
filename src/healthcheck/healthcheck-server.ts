import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { Logger } from '../logger/winston-logger.js'

export interface HealthCheckServerOptions {
  port: number
  logger: Logger
}

export interface HealthCheckResponse {
  status: 'ok'
  uptime: number
  timestamp: string
}

export interface HealthCheckServer {
  start(): Promise<void>
  stop(): Promise<void>
}

export function createHealthCheckServer(options: HealthCheckServerOptions): HealthCheckServer {
  const { port, logger } = options
  const startTime = Date.now()
  let httpServer: Server | null = null
  let isPortInUse = false

  const handleRequest = (req: IncomingMessage, res: ServerResponse): void => {
    if (req.url === '/health' && req.method === 'GET') {
      const response: HealthCheckResponse = {
        status: 'ok',
        uptime: (Date.now() - startTime) / 1000,
        timestamp: new Date().toISOString(),
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(response))
    } else {
      res.writeHead(404)
      res.end()
    }
  }

  const start = (): Promise<void> => {
    return new Promise((resolve) => {
      httpServer = createServer(handleRequest)

      httpServer.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          isPortInUse = true
          logger.warn(`Port ${port} is already in use. Healthcheck server will not start.`, {
            port,
          })
          resolve()
        } else {
          throw error
        }
      })

      httpServer.listen(port, () => {
        logger.info('Healthcheck server started', { port })
        resolve()
      })
    })
  }

  const stop = (): Promise<void> => {
    return new Promise((resolve) => {
      if (!httpServer || isPortInUse) {
        resolve()
        return
      }

      httpServer.close(() => {
        logger.info('Healthcheck server stopped')
        resolve()
      })
    })
  }

  return {
    start,
    stop,
  }
}
