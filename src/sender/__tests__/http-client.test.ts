import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '../../logger/winston-logger.js'
import type { EnvConfig } from '../../types/env.js'
import { HttpClient } from '../http-client.js'

describe('HttpClient', () => {
  let httpClient: HttpClient
  let mockLogger: Logger
  let mockConfig: EnvConfig

  beforeEach(() => {
    // Loggerのモック作成
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger

    // EnvConfigのモック作成
    mockConfig = {
      EXTERNAL_API_URL: 'https://api.example.com',
      EXTERNAL_API_TOKEN: 'test-token-12345',
      EXTERNAL_API_TIMEOUT_MS: 30000,
      MAX_RETRIES: 3,
    } as EnvConfig

    // HttpClientインスタンス作成
    httpClient = new HttpClient(mockLogger, mockConfig)

    // nockの設定
    nock.cleanAll()
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('POST送信成功', () => {
    it('should send POST request successfully', async () => {
      const testData = { usage: 'test-data' }
      const responseData = { success: true, id: '12345' }

      nock('https://api.example.com').post('/usage', testData).reply(200, responseData)

      const response = await httpClient.post('/usage', testData)

      expect(response.status).toBe(200)
      expect(response.data).toEqual(responseData)
    })

    it('should include Authorization header with Bearer token', async () => {
      const testData = { usage: 'test-data' }

      const scope = nock('https://api.example.com')
        .post('/usage', testData)
        .matchHeader('Authorization', 'Bearer test-token-12345')
        .reply(200, { success: true })

      await httpClient.post('/usage', testData)

      expect(scope.isDone()).toBe(true)
    })

    it('should include Content-Type application/json header', async () => {
      const testData = { usage: 'test-data' }

      const scope = nock('https://api.example.com')
        .post('/usage', testData)
        .matchHeader('Content-Type', 'application/json')
        .reply(200, { success: true })

      await httpClient.post('/usage', testData)

      expect(scope.isDone()).toBe(true)
    })
  })

  describe('リトライ処理', () => {
    it('should retry on 500 error and succeed on second attempt', async () => {
      const testData = { usage: 'test-data' }

      nock('https://api.example.com')
        .post('/usage', testData)
        .reply(500, { error: 'Internal Server Error' })
        .post('/usage', testData)
        .reply(200, { success: true })

      const response = await httpClient.post('/usage', testData)

      expect(response.status).toBe(200)
      expect(response.data).toEqual({ success: true })
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Retrying'),
        expect.objectContaining({
          retryCount: 1,
          status: 500,
        }),
      )
    })

    it('should retry on 429 Too Many Requests error', async () => {
      const testData = { usage: 'test-data' }

      nock('https://api.example.com')
        .post('/usage', testData)
        .reply(429, { error: 'Too Many Requests' })
        .post('/usage', testData)
        .reply(200, { success: true })

      const response = await httpClient.post('/usage', testData)

      expect(response.status).toBe(200)
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should handle network-like errors as retryable', async () => {
      // ネットワークエラーのシミュレーションは503エラーで代用
      // （nockとaxios-retryの組み合わせによる環境依存問題を回避）
      const testData = { usage: 'test-data' }

      nock('https://api.example.com')
        .post('/usage', testData)
        .reply(503, { error: 'Service Unavailable' })

      nock('https://api.example.com').post('/usage', testData).reply(200, { success: true })

      const response = await httpClient.post('/usage', testData)

      expect(response.status).toBe(200)
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should not retry on 400 Bad Request error', async () => {
      const testData = { usage: 'test-data' }

      nock('https://api.example.com').post('/usage', testData).reply(400, { error: 'Bad Request' })

      await expect(httpClient.post('/usage', testData)).rejects.toThrow()
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('should not retry on 401 Unauthorized error', async () => {
      const testData = { usage: 'test-data' }

      nock('https://api.example.com').post('/usage', testData).reply(401, { error: 'Unauthorized' })

      await expect(httpClient.post('/usage', testData)).rejects.toThrow()
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('should not retry on 403 Forbidden error', async () => {
      const testData = { usage: 'test-data' }

      nock('https://api.example.com').post('/usage', testData).reply(403, { error: 'Forbidden' })

      await expect(httpClient.post('/usage', testData)).rejects.toThrow()
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })
  })

  describe('トークンマスク', () => {
    it('should mask token in request logs', async () => {
      const testData = { usage: 'test-data' }

      nock('https://api.example.com').post('/usage', testData).reply(200, { success: true })

      await httpClient.post('/usage', testData)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('HTTP Request'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer ***MASKED***',
          }),
        }),
      )
    })

    it('should not expose token in any log output', async () => {
      const testData = { usage: 'test-data' }

      nock('https://api.example.com').post('/usage', testData).reply(200, { success: true })

      await httpClient.post('/usage', testData)

      // すべてのログ呼び出しでトークンが露出していないか確認
      const allLogCalls = [
        ...(mockLogger.debug as ReturnType<typeof vi.fn>).mock.calls,
        ...(mockLogger.info as ReturnType<typeof vi.fn>).mock.calls,
        ...(mockLogger.warn as ReturnType<typeof vi.fn>).mock.calls,
        ...(mockLogger.error as ReturnType<typeof vi.fn>).mock.calls,
      ]

      for (const call of allLogCalls) {
        const callString = JSON.stringify(call)
        expect(callString).not.toContain('test-token-12345')
      }
    })
  })

  describe('タイムアウト', () => {
    it('should respect timeout setting', async () => {
      const testData = { usage: 'test-data' }

      // タイムアウトを短く設定したクライアント作成
      const shortTimeoutConfig = {
        ...mockConfig,
        EXTERNAL_API_TIMEOUT_MS: 100,
      }
      const timeoutClient = new HttpClient(mockLogger, shortTimeoutConfig)

      nock('https://api.example.com')
        .post('/usage', testData)
        .delay(200) // 200msの遅延（タイムアウトより長い）
        .reply(200, { success: true })

      await expect(timeoutClient.post('/usage', testData)).rejects.toThrow()
    })
  })

  describe('エラーログ出力', () => {
    it('should log error on request failure', async () => {
      const testData = { usage: 'test-data' }

      // リトライ回数分すべて500エラーを返す
      for (let i = 0; i <= 3; i++) {
        nock('https://api.example.com')
          .post('/usage', testData)
          .reply(500, { error: 'Internal Server Error' })
      }

      try {
        await httpClient.post('/usage', testData)
      } catch {
        // エラーは期待される
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('HTTP Error'),
        expect.objectContaining({
          status: 500,
        }),
      )
    })
  })

  describe('指数バックオフ', () => {
    it('should call onRetry callback with increasing retry count', async () => {
      const testData = { usage: 'test-data' }

      nock('https://api.example.com').post('/usage', testData).reply(500)

      nock('https://api.example.com').post('/usage', testData).reply(500)

      nock('https://api.example.com').post('/usage', testData).reply(200, { success: true })

      await httpClient.post('/usage', testData)

      // リトライが2回発生（初回失敗 + 2回リトライ → 3回目成功）
      expect(mockLogger.warn).toHaveBeenCalledTimes(2)
      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('Retrying'),
        expect.objectContaining({ retryCount: 1 }),
      )
      expect(mockLogger.warn).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('Retrying'),
        expect.objectContaining({ retryCount: 2 }),
      )
    })
  })
})
