import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import type { INotifier } from '../../interfaces/notifier.js'
import type { Logger } from '../../logger/winston-logger.js'
import type { EnvConfig } from '../../types/env.js'
import type { ExternalApiRecord } from '../../types/external-api.js'
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
    const testRecords: ExternalApiRecord[] = [
      {
        date: '2025-01-01',
        app_id: 'app-1',
        app_name: 'Test App',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
        idempotency_key: 'key-1',
        transformed_at: '2025-01-01T00:00:00Z',
      },
    ]

    it('should send records successfully (200 response)', async () => {
      // Arrange
      const mockResponse = { status: 200, data: { success: true } }
      ;(mockHttpClient.post as Mock).mockResolvedValue(mockResponse)

      // Act
      await sender.send(testRecords)

      // Assert
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        '/usage',
        expect.objectContaining({
          records: testRecords,
          batchIdempotencyKey: expect.any(String),
        }),
      )
      expect(mockLogger.info).toHaveBeenCalledWith('Send success', {
        recordCount: 1,
      })
    })

    it('should handle 409 Conflict as success', async () => {
      // Arrange
      const mockResponse = { status: 409, data: { message: 'duplicate' } }
      ;(mockHttpClient.post as Mock).mockResolvedValue(mockResponse)

      // Act
      await sender.send(testRecords)

      // Assert
      expect(mockHttpClient.post).toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith('Duplicate data detected', {
        batchKey: expect.any(String),
      })
      expect(mockSpoolManager.saveToSpool).not.toHaveBeenCalled()
    })

    it('should save to spool on max retries error', async () => {
      // Arrange
      const axiosError = new AxiosError('Max retries reached')
      axiosError.config = { 'axios-retry': { retryCount: 3 } } as never
      ;(mockHttpClient.post as Mock).mockRejectedValue(axiosError)

      // Act
      await sender.send(testRecords)

      // Assert
      expect(mockSpoolManager.saveToSpool).toHaveBeenCalledWith(
        expect.objectContaining({
          batchIdempotencyKey: expect.any(String),
          records: testRecords,
          firstAttempt: expect.any(String),
          retryCount: 0,
          lastError: 'Max retries reached',
        }),
      )
      expect(mockLogger.warn).toHaveBeenCalledWith('Spooled due to max retries', {
        recordCount: 1,
      })
    })

    it('should rethrow non-retryable errors', async () => {
      // Arrange
      const axiosError = new AxiosError('Unauthorized')
      axiosError.response = { status: 401 } as never
      axiosError.config = { 'axios-retry': { retryCount: 0 } } as never
      ;(mockHttpClient.post as Mock).mockRejectedValue(axiosError)

      // Act & Assert
      await expect(sender.send(testRecords)).rejects.toThrow('Unauthorized')
      expect(mockSpoolManager.saveToSpool).not.toHaveBeenCalled()
    })
  })

  describe('resendSpooled()', () => {
    it('should resend spooled files successfully', async () => {
      // Arrange
      const spoolFiles = [
        {
          batchIdempotencyKey: 'batch-1',
          records: [
            {
              date: '2025-01-01',
              app_id: 'app-1',
              app_name: 'Test App',
              token_count: 100,
              total_price: '0.001',
              currency: 'USD',
              idempotency_key: 'key-1',
              transformed_at: '2025-01-01T00:00:00Z',
            },
          ],
          firstAttempt: '2025-01-01T00:00:00Z',
          retryCount: 1,
          lastError: 'Network error',
        },
      ]
      ;(mockSpoolManager.listSpoolFiles as Mock).mockResolvedValue(spoolFiles)
      ;(mockHttpClient.post as Mock).mockResolvedValue({ status: 200 })

      // Act
      await sender.resendSpooled()

      // Assert
      expect(mockSpoolManager.listSpoolFiles).toHaveBeenCalled()
      expect(mockHttpClient.post).toHaveBeenCalled()
      expect(mockSpoolManager.deleteSpoolFile).toHaveBeenCalledWith('batch-1')
      expect(mockLogger.info).toHaveBeenCalledWith('Spool resend success', {
        batchKey: 'batch-1',
      })
    })

    it('should increment retryCount on resend failure', async () => {
      // Arrange
      const spoolFiles = [
        {
          batchIdempotencyKey: 'batch-1',
          records: [
            {
              date: '2025-01-01',
              app_id: 'app-1',
              app_name: 'Test App',
              token_count: 100,
              total_price: '0.001',
              currency: 'USD',
              idempotency_key: 'key-1',
              transformed_at: '2025-01-01T00:00:00Z',
            },
          ],
          firstAttempt: '2025-01-01T00:00:00Z',
          retryCount: 5,
          lastError: 'Network error',
        },
      ]
      ;(mockSpoolManager.listSpoolFiles as Mock).mockResolvedValue(spoolFiles)
      const axiosError = new AxiosError('Still failing')
      axiosError.config = { 'axios-retry': { retryCount: 3 } } as never
      ;(mockHttpClient.post as Mock).mockRejectedValue(axiosError)

      // Act
      await sender.resendSpooled()

      // Assert
      expect(mockSpoolManager.updateSpoolFile).toHaveBeenCalledWith(
        expect.objectContaining({
          batchIdempotencyKey: 'batch-1',
          retryCount: 6,
          lastError: 'Still failing',
        }),
      )
      expect(mockLogger.warn).toHaveBeenCalledWith('Spool resend failed', {
        batchKey: 'batch-1',
        retryCount: 6,
      })
    })

    it('should move to failed on max spool retries', async () => {
      // Arrange
      const spoolFiles = [
        {
          batchIdempotencyKey: 'batch-1',
          records: [
            {
              date: '2025-01-01',
              app_id: 'app-1',
              app_name: 'Test App',
              token_count: 100,
              total_price: '0.001',
              currency: 'USD',
              idempotency_key: 'key-1',
              transformed_at: '2025-01-01T00:00:00Z',
            },
          ],
          firstAttempt: '2025-01-01T00:00:00Z',
          retryCount: 9,
          lastError: 'Network error',
        },
      ]
      ;(mockSpoolManager.listSpoolFiles as Mock).mockResolvedValue(spoolFiles)
      const axiosError = new AxiosError('Still failing')
      axiosError.config = { 'axios-retry': { retryCount: 3 } } as never
      ;(mockHttpClient.post as Mock).mockRejectedValue(axiosError)

      // Act
      await sender.resendSpooled()

      // Assert
      expect(mockSpoolManager.moveToFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          batchIdempotencyKey: 'batch-1',
          retryCount: 10,
          lastError: 'Still failing',
        }),
      )
      expect(mockLogger.error).toHaveBeenCalledWith('Moved to failed', {
        batchKey: 'batch-1',
      })
      expect(mockNotifier.sendErrorNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Spool retry limit exceeded',
          filePath: expect.stringContaining('data/failed/failed_'),
          lastError: 'Still failing',
          firstAttempt: '2025-01-01T00:00:00Z',
          retryCount: 10,
        }),
      )
    })

    it('should log error if notification fails', async () => {
      // Arrange
      const spoolFiles = [
        {
          batchIdempotencyKey: 'batch-1',
          records: [
            {
              date: '2025-01-01',
              app_id: 'app-1',
              app_name: 'Test App',
              token_count: 100,
              total_price: '0.001',
              currency: 'USD',
              idempotency_key: 'key-1',
              transformed_at: '2025-01-01T00:00:00Z',
            },
          ],
          firstAttempt: '2025-01-01T00:00:00Z',
          retryCount: 9,
          lastError: 'Network error',
        },
      ]
      ;(mockSpoolManager.listSpoolFiles as Mock).mockResolvedValue(spoolFiles)
      const axiosError = new AxiosError('Still failing')
      axiosError.config = { 'axios-retry': { retryCount: 3 } } as never
      ;(mockHttpClient.post as Mock).mockRejectedValue(axiosError)
      ;(mockNotifier.sendErrorNotification as Mock).mockRejectedValue(
        new Error('Notification service unavailable'),
      )

      // Act
      await sender.resendSpooled()

      // Assert
      expect(mockNotifier.sendErrorNotification).toHaveBeenCalled()
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to send error notification',
        expect.objectContaining({
          error: 'Notification service unavailable',
          batchKey: 'batch-1',
        }),
      )
      // data/failed/への移動は継続されている
      expect(mockSpoolManager.moveToFailed).toHaveBeenCalled()
    })
  })

  describe('calculateBatchKey()', () => {
    it('should generate consistent batch key for same records', async () => {
      // Arrange
      const records: ExternalApiRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-1',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
          idempotency_key: 'key-1',
          transformed_at: '2025-01-01T00:00:00Z',
        },
        {
          date: '2025-01-02',
          app_id: 'app-2',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
          idempotency_key: 'key-2',
          transformed_at: '2025-01-02T00:00:00Z',
        },
      ]
      ;(mockHttpClient.post as Mock).mockResolvedValue({ status: 200 })

      // Act
      await sender.send(records)
      const firstCallArgs = (mockHttpClient.post as Mock).mock.calls[0][1]
      const firstKey = firstCallArgs.batchIdempotencyKey

      await sender.send(records)
      const secondCallArgs = (mockHttpClient.post as Mock).mock.calls[1][1]
      const secondKey = secondCallArgs.batchIdempotencyKey

      // Assert
      expect(firstKey).toBe(secondKey)
    })

    it('should generate different batch key for different records', async () => {
      // Arrange
      const records1: ExternalApiRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-1',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
          idempotency_key: 'key-1',
          transformed_at: '2025-01-01T00:00:00Z',
        },
      ]
      const records2: ExternalApiRecord[] = [
        {
          date: '2025-01-02',
          app_id: 'app-2',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
          idempotency_key: 'key-2',
          transformed_at: '2025-01-02T00:00:00Z',
        },
      ]
      ;(mockHttpClient.post as Mock).mockResolvedValue({ status: 200 })

      // Act
      await sender.send(records1)
      const firstCallArgs = (mockHttpClient.post as Mock).mock.calls[0][1]
      const firstKey = firstCallArgs.batchIdempotencyKey

      await sender.send(records2)
      const secondCallArgs = (mockHttpClient.post as Mock).mock.calls[1][1]
      const secondKey = secondCallArgs.batchIdempotencyKey

      // Assert
      expect(firstKey).not.toBe(secondKey)
    })
  })

  describe('resendFailedFile()', () => {
    const testRecords: ExternalApiRecord[] = [
      {
        date: '2025-01-01',
        app_id: 'app-1',
        app_name: 'Test App',
        token_count: 100,
        total_price: '0.001',
        currency: 'USD',
        idempotency_key: 'key-1',
        transformed_at: '2025-01-01T00:00:00Z',
      },
    ]

    it('should resend records successfully (200 response)', async () => {
      // Arrange
      const mockResponse = { status: 200, data: { success: true } }
      ;(mockHttpClient.post as Mock).mockResolvedValue(mockResponse)

      // Act
      await sender.resendFailedFile(testRecords)

      // Assert
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        '/usage',
        expect.objectContaining({
          records: testRecords,
          batchIdempotencyKey: expect.any(String),
        }),
      )
      expect(mockLogger.info).toHaveBeenCalledWith('CLI resend success', {
        recordCount: 1,
      })
      // send()との違い: スプール保存が呼ばれない
      expect(mockSpoolManager.saveToSpool).not.toHaveBeenCalled()
    })

    it('should resend records successfully (201 response)', async () => {
      // Arrange
      const mockResponse = { status: 201, data: { success: true } }
      ;(mockHttpClient.post as Mock).mockResolvedValue(mockResponse)

      // Act
      await sender.resendFailedFile(testRecords)

      // Assert
      expect(mockHttpClient.post).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith('CLI resend success', {
        recordCount: 1,
      })
    })

    it('should handle 409 Conflict as success (duplicate detected)', async () => {
      // Arrange
      const mockResponse = { status: 409, data: { message: 'duplicate' } }
      ;(mockHttpClient.post as Mock).mockResolvedValue(mockResponse)

      // Act
      await sender.resendFailedFile(testRecords)

      // Assert
      expect(mockHttpClient.post).toHaveBeenCalled()
      expect(mockLogger.warn).toHaveBeenCalledWith('CLI resend: duplicate detected', {
        batchKey: expect.any(String),
      })
      // 成功扱いなので例外をスローしない
      // スプール保存も呼ばれない
      expect(mockSpoolManager.saveToSpool).not.toHaveBeenCalled()
    })

    it('should handle 409 error response as success', async () => {
      // Arrange
      const axiosError = new AxiosError('Conflict')
      axiosError.response = { status: 409 } as never
      ;(mockHttpClient.post as Mock).mockRejectedValue(axiosError)

      // Act
      await sender.resendFailedFile(testRecords)

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith('CLI resend: duplicate detected', {
        batchKey: expect.any(String),
      })
    })

    it('should throw error on 500 response', async () => {
      // Arrange
      const axiosError = new AxiosError('Internal Server Error')
      axiosError.response = { status: 500 } as never
      ;(mockHttpClient.post as Mock).mockRejectedValue(axiosError)

      // Act & Assert
      await expect(sender.resendFailedFile(testRecords)).rejects.toThrow('Internal Server Error')
      // send()との違い: スプール保存が呼ばれない
      expect(mockSpoolManager.saveToSpool).not.toHaveBeenCalled()
    })

    it('should throw error on network error', async () => {
      // Arrange
      const networkError = new AxiosError('Network Error')
      ;(mockHttpClient.post as Mock).mockRejectedValue(networkError)

      // Act & Assert
      await expect(sender.resendFailedFile(testRecords)).rejects.toThrow('Network Error')
      // send()との違い: スプール保存が呼ばれない
      expect(mockSpoolManager.saveToSpool).not.toHaveBeenCalled()
    })

    it('should not update metrics on success (unlike send())', async () => {
      // Arrange
      const mockResponse = { status: 200, data: { success: true } }
      ;(mockHttpClient.post as Mock).mockResolvedValue(mockResponse)

      // Act
      await sender.resendFailedFile(testRecords)

      // Assert
      // resendFailedFile()はメトリクスを更新しない
      expect(mockMetrics.sendSuccess).toBe(0)
    })

    it('should calculate batch key from records', async () => {
      // Arrange
      const multiRecords: ExternalApiRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-1',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
          idempotency_key: 'key-1',
          transformed_at: '2025-01-01T00:00:00Z',
        },
        {
          date: '2025-01-02',
          app_id: 'app-2',
          app_name: 'Test App',
          token_count: 100,
          total_price: '0.001',
          currency: 'USD',
          idempotency_key: 'key-2',
          transformed_at: '2025-01-02T00:00:00Z',
        },
      ]
      const mockResponse = { status: 200, data: { success: true } }
      ;(mockHttpClient.post as Mock).mockResolvedValue(mockResponse)

      // Act
      await sender.resendFailedFile(multiRecords)

      // Assert
      expect(mockHttpClient.post).toHaveBeenCalledWith(
        '/usage',
        expect.objectContaining({
          batchIdempotencyKey: expect.any(String),
          records: multiRecords,
        }),
      )
      expect(mockLogger.info).toHaveBeenCalledWith('CLI resend success', {
        recordCount: 2,
      })
    })
  })
})
