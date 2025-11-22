import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '../../logger/winston-logger.js'
import type { HealthCheckResponse } from '../healthcheck-server.js'
import { createHealthCheckServer } from '../healthcheck-server.js'

describe('healthcheck-server', () => {
  let mockLogger: Logger

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    }
  })

  describe('createHealthCheckServer', () => {
    it('should return a server instance with start and stop methods', () => {
      // Arrange & Act
      const server = createHealthCheckServer({
        port: 8080,
        logger: mockLogger,
      })

      // Assert
      expect(server).toBeDefined()
      expect(typeof server.start).toBe('function')
      expect(typeof server.stop).toBe('function')
    })
  })

  describe('start and stop', () => {
    it('should start the server and resolve', async () => {
      // Arrange
      const server = createHealthCheckServer({
        port: 18081,
        logger: mockLogger,
      })

      // Act & Assert
      await expect(server.start()).resolves.toBeUndefined()
      await server.stop()
    })

    it('should stop the server and resolve', async () => {
      // Arrange
      const server = createHealthCheckServer({
        port: 18082,
        logger: mockLogger,
      })
      await server.start()

      // Act & Assert
      await expect(server.stop()).resolves.toBeUndefined()
    })

    it('should log info message when server starts', async () => {
      // Arrange
      const server = createHealthCheckServer({
        port: 18083,
        logger: mockLogger,
      })

      // Act
      await server.start()
      await server.stop()

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Healthcheck server started'),
        expect.objectContaining({ port: 18083 }),
      )
    })

    it('should log info message when server stops', async () => {
      // Arrange
      const server = createHealthCheckServer({
        port: 18084,
        logger: mockLogger,
      })
      await server.start()

      // Act
      await server.stop()

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Healthcheck server stopped'),
      )
    })
  })

  describe('GET /health endpoint', () => {
    let server: ReturnType<typeof createHealthCheckServer>
    const testPort = 18085

    beforeEach(async () => {
      server = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })
      await server.start()
    })

    afterEach(async () => {
      await server.stop()
    })

    it('should return 200 status code', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`)

      // Assert
      expect(response.status).toBe(200)
    })

    it('should return JSON content type', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`)

      // Assert
      expect(response.headers.get('content-type')).toContain('application/json')
    })

    it('should return response with status, uptime, and timestamp', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`)
      const body = (await response.json()) as HealthCheckResponse

      // Assert
      expect(body).toHaveProperty('status', 'ok')
      expect(body).toHaveProperty('uptime')
      expect(typeof body.uptime).toBe('number')
      expect(body).toHaveProperty('timestamp')
      expect(typeof body.timestamp).toBe('string')
    })

    it('should return valid ISO 8601 timestamp', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`)
      const body = (await response.json()) as HealthCheckResponse

      // Assert
      const timestamp = new Date(body.timestamp)
      expect(timestamp.toISOString()).toBe(body.timestamp)
    })

    it('should return uptime in seconds', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`)
      const body = (await response.json()) as HealthCheckResponse

      // Assert
      expect(body.uptime).toBeGreaterThanOrEqual(0)
      expect(body.uptime).toBeLessThan(60) // Reasonable upper bound for test
    })
  })

  describe('error handling', () => {
    let server: ReturnType<typeof createHealthCheckServer>
    const testPort = 18086

    beforeEach(async () => {
      server = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })
      await server.start()
    })

    afterEach(async () => {
      await server.stop()
    })

    it('should return 404 for GET /invalid path', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/invalid`)

      // Assert
      expect(response.status).toBe(404)
    })

    it('should return 404 for POST /health', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`, {
        method: 'POST',
      })

      // Assert
      expect(response.status).toBe(404)
    })

    it('should return 404 for PUT /health', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`, {
        method: 'PUT',
      })

      // Assert
      expect(response.status).toBe(404)
    })

    it('should return 404 for DELETE /health', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`, {
        method: 'DELETE',
      })

      // Assert
      expect(response.status).toBe(404)
    })
  })

  describe('EADDRINUSE error handling', () => {
    it('should log warning when port is already in use', async () => {
      // Arrange
      const testPort = 18087
      const server1 = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })
      await server1.start()

      const server2 = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })

      // Act
      await server2.start()

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Port'),
        expect.objectContaining({ port: testPort }),
      )

      // Cleanup
      await server1.stop()
    })

    it('should not throw when port is already in use', async () => {
      // Arrange
      const testPort = 18088
      const server1 = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })
      await server1.start()

      const server2 = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })

      // Act & Assert
      await expect(server2.start()).resolves.toBeUndefined()

      // Cleanup
      await server1.stop()
    })
  })
})
