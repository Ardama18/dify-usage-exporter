import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import type { INotifier } from '../../interfaces/notifier.js'
import type { Logger } from '../../logger/winston-logger.js'
import type { ApiMeterRequest } from '../../types/api-meter-schema.js'
import type { EnvConfig } from '../../types/env.js'
import type { ExecutionMetrics } from '../../types/metrics.js'
import { ExternalApiSender } from '../external-api-sender.js'
import type { HttpClient } from '../http-client.js'
import type { SpoolManager } from '../spool-manager.js'

describe('ExternalApiSender', () => {
  let sender: ExternalApiSender
  let mockHttpClient: HttpClient
  let mockSpoolManager: SpoolManager
  let mockNotifier: INotifier
  let mockLogger: Logger
  let mockConfig: EnvConfig
  let mockMetrics: ExecutionMetrics

  beforeEach(() => {
    // モックHttpClient
    mockHttpClient = {
      post: vi.fn(),
    } as unknown as HttpClient

    // モックSpoolManager
    mockSpoolManager = {
      saveToSpool: vi.fn(),
      listSpoolFiles: vi.fn(),
      deleteSpoolFile: vi.fn(),
      updateSpoolFile: vi.fn(),
      moveToFailed: vi.fn(),
    } as unknown as SpoolManager

    // モックNotifier
    mockNotifier = {
      sendErrorNotification: vi.fn(),
    } as unknown as INotifier

    // モックLogger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger

    // モック設定
    mockConfig = {
      EXTERNAL_API_URL: 'https://api.example.com',
      MAX_RETRIES: 3,
      MAX_SPOOL_RETRIES: 10,
      EXTERNAL_API_TIMEOUT_MS: 30000,
    } as EnvConfig

    // モックメトリクス
    mockMetrics = {
      fetchedRecords: 0,
      transformedRecords: 0,
      sendSuccess: 0,
      sendFailed: 0,
      spoolSaved: 0,
      spoolResendSuccess: 0,
      failedMoved: 0,
    }

    sender = new ExternalApiSender(
      mockHttpClient,
      mockSpoolManager,
      mockNotifier,
      mockLogger,
      mockConfig,
      mockMetrics,
    )
  })

  describe('send()', () => {
    const testRequest: ApiMeterRequest = {
      tenant_id: '12345678-1234-1234-1234-123456789abc',
      export_metadata: {
        exporter_version: '1.1.0',
        export_timestamp: '2025-01-01T00:00:00Z',
        aggregation_period: 'daily',
        source_system: 'dify',
        date_range: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-01T23:59:59Z',
        },
      },
      records: [
        {
          usage_date: '2025-01-01',
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500,
          request_count: 10,
          cost_actual: 0.001,
          currency: 'USD',
          metadata: {
            source_system: 'dify',
            source_event_id: 'dify-2025-01-01-anthropic-claude-3-5-sonnet-20241022-abc123',
            source_app_id: 'app-1',
            source_app_name: 'Test App',
            aggregation_method: 'daily_sum',
          },
        },
      ],
    }

    it('should send ApiMeterRequest successfully (200 response with inserted/updated)', async () => {
      // Arrange
      const mockResponse = {
        status: 200,
        data: { inserted: 10, updated: 5, total: 15 },
      }
      ;(mockHttpClient.post as Mock).mockResolvedValue(mockResponse)

      // Act
      await sender.send(testRequest)

      // Assert
      expect(mockHttpClient.post).toHaveBeenCalledWith('', testRequest)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Successfully sent'),
        expect.objectContaining({
          recordCount: 1,
          inserted: 10,
          updated: 5,
          total: 15,
        }),
      )
      expect(mockMetrics.sendSuccess).toBe(1)
    })

    it('should handle 200 response without inserted/updated gracefully', async () => {
      // Arrange
      const mockResponse = { status: 200, data: {} }
      ;(mockHttpClient.post as Mock).mockResolvedValue(mockResponse)

      // Act
      await sender.send(testRequest)

      // Assert
      expect(mockHttpClient.post).toHaveBeenCalledWith('', testRequest)
      expect(mockMetrics.sendSuccess).toBe(1)
    })

    it('should handle 400 Bad Request with detailed error', async () => {
      // Arrange
      const axiosError = new AxiosError('Bad Request')
      axiosError.response = {
        status: 400,
        data: { error: 'Invalid tenant_id format' },
      } as never
      ;(mockHttpClient.post as Mock).mockRejectedValue(axiosError)

      // Act & Assert
      await expect(sender.send(testRequest)).rejects.toThrow('Bad Request')
      expect(mockMetrics.sendFailed).toBe(1)
    })

    it('should handle 401 Unauthorized with detailed error', async () => {
      // Arrange
      const axiosError = new AxiosError('Unauthorized')
      axiosError.response = { status: 401 } as never
      ;(mockHttpClient.post as Mock).mockRejectedValue(axiosError)

      // Act & Assert
      await expect(sender.send(testRequest)).rejects.toThrow('Unauthorized')
      expect(mockMetrics.sendFailed).toBe(1)
    })

    it('should handle 403 Forbidden with detailed error', async () => {
      // Arrange
      const axiosError = new AxiosError('Forbidden')
      axiosError.response = { status: 403 } as never
      ;(mockHttpClient.post as Mock).mockRejectedValue(axiosError)

      // Act & Assert
      await expect(sender.send(testRequest)).rejects.toThrow('Forbidden')
      expect(mockMetrics.sendFailed).toBe(1)
    })

    it('should handle 404 Not Found with detailed error', async () => {
      // Arrange
      const axiosError = new AxiosError('Not Found')
      axiosError.response = { status: 404 } as never
      ;(mockHttpClient.post as Mock).mockRejectedValue(axiosError)

      // Act & Assert
      await expect(sender.send(testRequest)).rejects.toThrow('Not Found')
      expect(mockMetrics.sendFailed).toBe(1)
    })

    it('should handle 422 Unprocessable Entity with detailed error', async () => {
      // Arrange
      const axiosError = new AxiosError('Unprocessable Entity')
      axiosError.response = {
        status: 422,
        data: { error: 'Validation failed: total_tokens mismatch' },
      } as never
      ;(mockHttpClient.post as Mock).mockRejectedValue(axiosError)

      // Act & Assert
      await expect(sender.send(testRequest)).rejects.toThrow('Unprocessable Entity')
      expect(mockMetrics.sendFailed).toBe(1)
    })

    it('should handle 429 Too Many Requests (will retry by http-client)', async () => {
      // Arrange
      const axiosError = new AxiosError('Too Many Requests')
      axiosError.response = { status: 429 } as never
      axiosError.config = { 'axios-retry': { retryCount: 3 } } as never
      ;(mockHttpClient.post as Mock).mockRejectedValue(axiosError)

      // Act & Assert
      await expect(sender.send(testRequest)).rejects.toThrow('Too Many Requests')
      expect(mockMetrics.sendFailed).toBe(1)
    })

    it('should handle 5xx Server Error (will retry by http-client)', async () => {
      // Arrange
      const axiosError = new AxiosError('Internal Server Error')
      axiosError.response = { status: 500 } as never
      axiosError.config = { 'axios-retry': { retryCount: 3 } } as never
      ;(mockHttpClient.post as Mock).mockRejectedValue(axiosError)

      // Act & Assert
      await expect(sender.send(testRequest)).rejects.toThrow('Internal Server Error')
      expect(mockMetrics.sendFailed).toBe(1)
    })

    it('should update sendSuccess metric on successful send', async () => {
      // Arrange
      const mockResponse = {
        status: 200,
        data: { inserted: 1, updated: 0, total: 1 },
      }
      ;(mockHttpClient.post as Mock).mockResolvedValue(mockResponse)

      // Act
      await sender.send(testRequest)

      // Assert
      expect(mockMetrics.sendSuccess).toBe(1)
    })

    it('should update sendFailure metric on error', async () => {
      // Arrange
      const axiosError = new AxiosError('Network Error')
      ;(mockHttpClient.post as Mock).mockRejectedValue(axiosError)

      // Act & Assert
      await expect(sender.send(testRequest)).rejects.toThrow()
      expect(mockMetrics.sendFailed).toBe(1)
    })
  })

  // Note: resendSpooled(), resendFailedFile(), calculateBatchKey() tests
  // will be updated in Task 3-3 (spool integration)
})
