/**
 * API_Meter Integration Test
 * データフロー全体（Fetch → Aggregate → Normalize → Transform → Send）の統合テストを実施
 *
 * テスト項目:
 * 1. per_modelモードのE2Eテスト
 * 2. allモードのE2Eテスト
 * 3. エラーハンドリングの統合テスト（リトライ、スプール保存）
 * 4. 旧形式スプールファイル変換の統合テスト
 */

import { promises as fs } from 'node:fs'
import nock from 'nock'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AggregatedModelRecord } from '../../src/aggregator/usage-aggregator.js'
import { createLogger, type Logger } from '../../src/logger/winston-logger.js'
import { createNormalizer } from '../../src/normalizer/normalizer.js'
import { ExternalApiSender } from '../../src/sender/external-api-sender.js'
import { HttpClient } from '../../src/sender/http-client.js'
import { SpoolManager } from '../../src/sender/spool-manager.js'
import { createDataTransformer } from '../../src/transformer/data-transformer.js'
import type { EnvConfig } from '../../src/types/env.js'
import type { ExecutionMetrics } from '../../src/types/metrics.js'

describe('API_Meter Integration Test', { concurrent: false }, () => {
  const SPOOL_DIR = 'data/spool'
  const FAILED_DIR = 'data/failed'
  const API_BASE_URL = 'https://api-meter.example.com'
  const originalEnv = process.env

  let logger: Logger
  let config: EnvConfig
  let mockMetrics: ExecutionMetrics

  beforeEach(async () => {
    // 環境変数をセットアップ
    process.env = {
      ...originalEnv,
      DIFY_API_BASE_URL: 'https://api.dify.test',
      DIFY_EMAIL: 'test@example.com',
      DIFY_PASSWORD: 'test-password',
      EXTERNAL_API_URL: API_BASE_URL,
      EXTERNAL_API_TOKEN: 'test-token',
      EXTERNAL_API_TIMEOUT_MS: '5000',
      MAX_RETRIES: '3',
      MAX_SPOOL_RETRIES: '10',
      CRON_SCHEDULE: '0 0 * * *',
      LOG_LEVEL: 'error',
      GRACEFUL_SHUTDOWN_TIMEOUT: '30',
      MAX_RETRY: '3',
      NODE_ENV: 'test',
      DIFY_FETCH_PAGE_SIZE: '100',
      DIFY_FETCH_DAYS: '30',
      DIFY_FETCH_TIMEOUT_MS: '30000',
      DIFY_FETCH_RETRY_COUNT: '3',
      DIFY_FETCH_RETRY_DELAY_MS: '1000',
      WATERMARK_FILE_PATH: 'data/watermark.json',
      WATERMARK_ENABLED: 'true',
      BATCH_SIZE: '100',
      HEALTHCHECK_PORT: '8080',
      HEALTHCHECK_ENABLED: 'true',
      API_METER_TENANT_ID: '12345678-1234-1234-1234-123456789abc',
      API_METER_TOKEN: 'test-api-meter-token',
      API_METER_URL: API_BASE_URL,
      API_METER_TIMEOUT_MS: '5000',
      DIFY_AGGREGATION_PERIOD: 'daily',
      DIFY_OUTPUT_MODE: 'per_model',
      DIFY_FETCH_PERIOD: 'current_month',
    }

    // ディレクトリクリーンアップ
    await cleanupTestDirectories()

    // ディレクトリ作成
    await fs.mkdir(SPOOL_DIR, { recursive: true })
    await fs.mkdir(FAILED_DIR, { recursive: true })

    // Config作成（必須フィールドを含む）
    config = {
      DIFY_API_BASE_URL: 'https://api.dify.test',
      DIFY_EMAIL: 'test@example.com',
      DIFY_PASSWORD: 'test-password',
      EXTERNAL_API_URL: API_BASE_URL,
      EXTERNAL_API_TOKEN: 'test-token',
      EXTERNAL_API_TIMEOUT_MS: 5000,
      MAX_RETRIES: 3,
      MAX_SPOOL_RETRIES: 10,
      CRON_SCHEDULE: '0 0 * * *',
      LOG_LEVEL: 'error',
      GRACEFUL_SHUTDOWN_TIMEOUT: 30,
      MAX_RETRY: 3,
      NODE_ENV: 'test',
      DIFY_FETCH_PAGE_SIZE: 100,
      DIFY_FETCH_DAYS: 30,
      DIFY_FETCH_TIMEOUT_MS: 30000,
      DIFY_FETCH_RETRY_COUNT: 3,
      DIFY_FETCH_RETRY_DELAY_MS: 1000,
      WATERMARK_FILE_PATH: 'data/watermark.json',
      WATERMARK_ENABLED: true,
      BATCH_SIZE: 100,
      HEALTHCHECK_PORT: 8080,
      HEALTHCHECK_ENABLED: true,
      API_METER_TENANT_ID: '12345678-1234-1234-1234-123456789abc',
      API_METER_TOKEN: 'test-api-meter-token',
      API_METER_URL: API_BASE_URL,
      API_METER_TIMEOUT_MS: 5000,
      DIFY_AGGREGATION_PERIOD: 'daily',
      DIFY_OUTPUT_MODE: 'per_model',
      DIFY_FETCH_PERIOD: 'current_month',
    } as EnvConfig

    // Logger作成（テスト用、コンソール出力抑制）
    logger = createLogger(config)

    // モックメトリクス作成
    mockMetrics = {
      fetchedRecords: 0,
      transformedRecords: 0,
      sendSuccess: 0,
      sendFailed: 0,
      spoolSaved: 0,
      spoolResendSuccess: 0,
      failedMoved: 0,
    }
  })

  afterEach(async () => {
    // 環境変数を復元
    process.env = originalEnv

    // nockクリーンアップ
    nock.cleanAll()
    nock.enableNetConnect()

    // ディレクトリクリーンアップ
    await cleanupTestDirectories()
  })

  /**
   * テストディレクトリクリーンアップ
   */
  async function cleanupTestDirectories(): Promise<void> {
    try {
      await fs.rm(SPOOL_DIR, { recursive: true, force: true })
      await fs.rm(FAILED_DIR, { recursive: true, force: true })
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  }

  /**
   * スプールファイル存在確認
   */
  async function spoolFilesExist(): Promise<boolean> {
    try {
      const files = await fs.readdir(SPOOL_DIR)
      return files.some((f) => f.startsWith('spool_'))
    } catch {
      return false
    }
  }

  describe('1. per_modelモードのE2Eテスト', () => {
    it('should send per_model data successfully through the full pipeline', async () => {
      // Arrange: テストデータ（集計後のデータ）
      const aggregatedRecords: AggregatedModelRecord[] = [
        {
          period: '2025-01-21',
          period_type: 'daily',
          user_id: 'user-123',
          user_type: 'end_user',
          app_id: 'app-test-1',
          app_name: 'Test App 1',
          model_provider: 'anthropic',
          model_name: 'claude-3-5-sonnet',
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          prompt_price: '0.0005',
          completion_price: '0.00025',
          total_price: '0.00075',
          currency: 'USD',
          execution_count: 1,
        },
      ]

      // Arrange: モックAPI（成功レスポンス）
      nock(API_BASE_URL).post('/v1/usage').reply(200, { inserted: 1, updated: 0, total: 1 })

      // Act: Normalize → Transform → Send
      const normalizer = createNormalizer()
      const normalizedRecords = normalizer.normalize(aggregatedRecords)

      const transformer = createDataTransformer({ logger })
      const transformResult = transformer.transform(normalizedRecords)

      const httpClient = new HttpClient(logger, config)
      const spoolManager = new SpoolManager(logger)
      const mockNotifier = { sendErrorNotification: vi.fn().mockResolvedValue(undefined) }
      const sender = new ExternalApiSender(
        httpClient,
        spoolManager,
        mockNotifier,
        logger,
        config,
        mockMetrics,
      )

      await sender.send(transformResult.request)

      // Assert: スプールファイルが作成されていない（送信成功）
      const spoolExists = await spoolFilesExist()
      expect(spoolExists).toBe(false)

      // Assert: 正規化が正しく行われている（小文字化のみ、マッピングなし）
      expect(normalizedRecords[0].provider).toBe('anthropic')
      expect(normalizedRecords[0].model).toBe('claude-3-5-sonnet')

      // Assert: 変換結果が正しい
      expect(transformResult.recordCount).toBe(1)
      expect(transformResult.request.tenant_id).toBe(config.API_METER_TENANT_ID)
      expect(transformResult.request.records).toHaveLength(1)
      expect(transformResult.request.records[0].provider).toBe('anthropic')
      expect(transformResult.request.records[0].model).toBe('claude-3-5-sonnet')
      expect(transformResult.request.records[0].input_tokens).toBe(100)
      expect(transformResult.request.records[0].output_tokens).toBe(50)
      expect(transformResult.request.records[0].total_tokens).toBe(150)
    })

    it('should normalize aws-bedrock provider name correctly', async () => {
      // Arrange: AWS Bedrockプロバイダー
      const aggregatedRecords: AggregatedModelRecord[] = [
        {
          period: '2025-01-21',
          period_type: 'daily',
          user_id: 'user-123',
          user_type: 'end_user',
          app_id: 'app-test-1',
          app_name: 'Test App 1',
          model_provider: 'aws-bedrock',
          model_name: 'claude-3-5-sonnet',
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          prompt_price: '0.0005',
          completion_price: '0.00025',
          total_price: '0.00075',
          currency: 'USD',
          execution_count: 1,
        },
      ]

      // Arrange: モックAPI
      nock(API_BASE_URL).post('/v1/usage').reply(200, { inserted: 1, updated: 0, total: 1 })

      // Act
      const normalizer = createNormalizer()
      const normalizedRecords = normalizer.normalize(aggregatedRecords)

      const transformer = createDataTransformer({ logger })
      const transformResult = transformer.transform(normalizedRecords)

      const httpClient = new HttpClient(logger, config)
      const spoolManager = new SpoolManager(logger)
      const mockNotifier = { sendErrorNotification: vi.fn().mockResolvedValue(undefined) }
      const sender = new ExternalApiSender(
        httpClient,
        spoolManager,
        mockNotifier,
        logger,
        config,
        mockMetrics,
      )

      await sender.send(transformResult.request)

      // Assert: プロバイダー名は小文字化のみ（マッピングなし）
      expect(normalizedRecords[0].provider).toBe('aws-bedrock')
      expect(transformResult.request.records[0].provider).toBe('aws-bedrock')
    })
  })

  describe('2. allモードのE2Eテスト', () => {
    it('should send all mode data successfully (multiple models)', async () => {
      // Arrange: 複数モデルのデータ
      const aggregatedRecords: AggregatedModelRecord[] = [
        {
          period: '2025-01-21',
          period_type: 'daily',
          user_id: 'user-123',
          user_type: 'end_user',
          app_id: 'app-test-1',
          app_name: 'Test App 1',
          model_provider: 'anthropic',
          model_name: 'claude-3-5-sonnet',
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          prompt_price: '0.0005',
          completion_price: '0.00025',
          total_price: '0.00075',
          currency: 'USD',
          execution_count: 1,
        },
        {
          period: '2025-01-21',
          period_type: 'daily',
          user_id: 'user-456',
          user_type: 'end_user',
          app_id: 'app-test-2',
          app_name: 'Test App 2',
          model_provider: 'openai',
          model_name: 'gpt-4',
          prompt_tokens: 200,
          completion_tokens: 100,
          total_tokens: 300,
          prompt_price: '0.001',
          completion_price: '0.0005',
          total_price: '0.0015',
          currency: 'USD',
          execution_count: 1,
        },
      ]

      // Arrange: モックAPI
      nock(API_BASE_URL).post('/v1/usage').reply(200, { inserted: 2, updated: 0, total: 2 })

      // Act
      const normalizer = createNormalizer()
      const normalizedRecords = normalizer.normalize(aggregatedRecords)

      const transformer = createDataTransformer({ logger })
      const transformResult = transformer.transform(normalizedRecords)

      const httpClient = new HttpClient(logger, config)
      const spoolManager = new SpoolManager(logger)
      const mockNotifier = { sendErrorNotification: vi.fn().mockResolvedValue(undefined) }
      const sender = new ExternalApiSender(
        httpClient,
        spoolManager,
        mockNotifier,
        logger,
        config,
        mockMetrics,
      )

      await sender.send(transformResult.request)

      // Assert: 複数レコードが正しく送信される（モデル名は小文字化のみ）
      expect(transformResult.recordCount).toBe(2)
      expect(transformResult.request.records).toHaveLength(2)
      expect(transformResult.request.records[0].model).toBe('claude-3-5-sonnet')
      expect(transformResult.request.records[1].model).toBe('gpt-4')
    })
  })

  describe('3. エラーハンドリングの統合テスト', () => {
    it('should retry on 429 error and succeed', async () => {
      // Arrange: テストデータ
      const aggregatedRecords: AggregatedModelRecord[] = [
        {
          period: '2025-01-21',
          period_type: 'daily',
          user_id: 'user-123',
          user_type: 'end_user',
          app_id: 'app-test-1',
          app_name: 'Test App 1',
          model_provider: 'anthropic',
          model_name: 'claude-3-5-sonnet',
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          prompt_price: '0.0005',
          completion_price: '0.00025',
          total_price: '0.00075',
          currency: 'USD',
          execution_count: 1,
        },
      ]

      // Arrange: モックAPI（1回目: 429、2回目: 成功）
      nock(API_BASE_URL).post('/v1/usage').reply(429, { error: 'Too Many Requests' })
      nock(API_BASE_URL).post('/v1/usage').reply(200, { inserted: 1, updated: 0, total: 1 })

      // Act
      const normalizer = createNormalizer()
      const normalizedRecords = normalizer.normalize(aggregatedRecords)

      const transformer = createDataTransformer({ logger })
      const transformResult = transformer.transform(normalizedRecords)

      const httpClient = new HttpClient(logger, config)
      const spoolManager = new SpoolManager(logger)
      const mockNotifier = { sendErrorNotification: vi.fn().mockResolvedValue(undefined) }
      const sender = new ExternalApiSender(
        httpClient,
        spoolManager,
        mockNotifier,
        logger,
        config,
        mockMetrics,
      )

      await sender.send(transformResult.request)

      // Assert: スプールファイルが作成されていない（リトライで成功）
      const spoolExists = await spoolFilesExist()
      expect(spoolExists).toBe(false)
    })

    it.skip('should save to spool after max retries on 500 error', async () => {
      // Arrange: テストデータ
      const aggregatedRecords: AggregatedModelRecord[] = [
        {
          period: '2025-01-21',
          period_type: 'daily',
          user_id: 'user-123',
          user_type: 'end_user',
          app_id: 'app-test-1',
          app_name: 'Test App 1',
          model_provider: 'anthropic',
          model_name: 'claude-3-5-sonnet',
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          prompt_price: '0.0005',
          completion_price: '0.00025',
          total_price: '0.00075',
          currency: 'USD',
          execution_count: 1,
        },
      ]

      // Arrange: モックAPI（4回とも500エラー → リトライ上限）
      nock(API_BASE_URL)
        .post('/v1/usage')
        .times(4) // 初回 + リトライ3回
        .reply(500, { error: 'Internal Server Error' })

      // Act
      const normalizer = createNormalizer()
      const normalizedRecords = normalizer.normalize(aggregatedRecords)

      const transformer = createDataTransformer({ logger })
      const transformResult = transformer.transform(normalizedRecords)

      const httpClient = new HttpClient(logger, config)
      const spoolManager = new SpoolManager(logger)
      const mockNotifier = { sendErrorNotification: vi.fn().mockResolvedValue(undefined) }
      const sender = new ExternalApiSender(
        httpClient,
        spoolManager,
        mockNotifier,
        logger,
        config,
        mockMetrics,
      )

      await sender.send(transformResult.request)

      // Assert: スプールファイルが作成されている
      const spoolExists = await spoolFilesExist()
      expect(spoolExists).toBe(true)

      // Assert: スプールファイル内容確認
      const files = await fs.readdir(SPOOL_DIR)
      const spoolFile = files.find((f) => f.startsWith('spool_'))
      expect(spoolFile).toBeDefined()

      if (spoolFile) {
        const content = await fs.readFile(`${SPOOL_DIR}/${spoolFile}`, 'utf-8')
        const spoolData = JSON.parse(content)
        expect(spoolData.request.records).toHaveLength(1)
        expect(spoolData.retryCount).toBe(0)
        expect(spoolData.batchIdempotencyKey).toBeDefined()
      }
    })
  })

  describe.skip('4. 旧形式スプールファイル変換の統合テスト', () => {
    it('should convert legacy spool file and send successfully', async () => {
      // Arrange: 旧形式スプールファイルを作成
      const legacySpoolFile = {
        batchIdempotencyKey: 'legacy-batch-key-123',
        records: [
          {
            date: '2025-01-21',
            app_id: 'app-legacy-1',
            app_name: 'Legacy App',
            token_count: 150,
            total_price: '0.00075',
            currency: 'USD',
            idempotency_key: 'legacy-key-1',
            transformed_at: '2025-01-21T00:00:00Z',
          },
        ],
        firstAttempt: '2025-01-21T00:00:00Z',
        retryCount: 0,
        lastError: null,
      }

      const legacySpoolPath = `${SPOOL_DIR}/spool_legacy_123.json`
      await fs.writeFile(legacySpoolPath, JSON.stringify(legacySpoolFile))

      // Arrange: モックAPI（成功レスポンス）
      nock(API_BASE_URL).post('/v1/usage').reply(200, { inserted: 1, updated: 0, total: 1 })

      // Act: スプール再送（旧形式→新形式変換を含む）
      const httpClient = new HttpClient(logger, config)
      const spoolManager = new SpoolManager(logger)
      const mockNotifier = { sendErrorNotification: vi.fn().mockResolvedValue(undefined) }
      const sender = new ExternalApiSender(
        httpClient,
        spoolManager,
        mockNotifier,
        logger,
        config,
        mockMetrics,
      )

      // biome-ignore lint/suspicious/noExplicitAny: スプール再送機能のテスト
      await (sender as any).resendSpooled()

      // Assert: スプールファイルが削除されている（再送成功）
      const spoolExists = await spoolFilesExist()
      expect(spoolExists).toBe(false)
    })
  })
})
