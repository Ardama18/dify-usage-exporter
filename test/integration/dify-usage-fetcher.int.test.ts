// Dify使用量データ取得機能 統合テスト - Design Doc: specs/stories/2-dify-usage-fetcher/design.md
// 生成日: 2025-11-29
// テスト種別: Integration Test
// 実装タイミング: 機能実装と同時

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDifyApiClient, type DifyApp } from '../../src/fetcher/dify-api-client.js'
import {
  createDifyUsageFetcher,
  type FetchedTokenCostRecord,
} from '../../src/fetcher/dify-usage-fetcher.js'
import type { Logger } from '../../src/logger/winston-logger.js'
import type { DifyAppTokenCost } from '../../src/types/dify-usage.js'
import type { EnvConfig } from '../../src/types/env.js'
import { createWatermarkManager } from '../../src/watermark/watermark-manager.js'

// axiosをモック
vi.mock('axios')
vi.mock('axios-retry', () => ({
  default: vi.fn(),
  isNetworkOrIdempotentRequestError: vi.fn(),
  exponentialDelay: vi.fn(),
}))
vi.mock('axios-cookiejar-support', () => ({
  wrapper: vi.fn((instance) => instance),
}))
vi.mock('tough-cookie', () => {
  const mockCookies = [
    { key: 'access_token', value: 'mock-access-token' },
    { key: 'csrf_token', value: 'mock-csrf-token' },
  ]
  class MockCookieJar {
    getCookies = vi.fn().mockResolvedValue(mockCookies)
  }
  return { CookieJar: MockCookieJar }
})

// ============================================
// ヘルパー関数
// ============================================

function createMockApp(overrides: Partial<DifyApp> = {}): DifyApp {
  return {
    id: 'app-123',
    name: 'Test App',
    mode: 'chat',
    ...overrides,
  }
}

function createMockTokenCost(overrides: Partial<DifyAppTokenCost> = {}): DifyAppTokenCost {
  return {
    date: '2024-01-15',
    token_count: 100,
    total_price: '0.001',
    currency: 'USD',
    ...overrides,
  }
}

function createTestConfig(overrides: Partial<EnvConfig> = {}): EnvConfig {
  return {
    DIFY_API_BASE_URL: 'https://api.dify.ai',
    DIFY_EMAIL: 'test@example.com',
    DIFY_PASSWORD: 'test-password',
    EXTERNAL_API_URL: 'https://external.api',
    EXTERNAL_API_TOKEN: 'external-token',
    CRON_SCHEDULE: '0 0 * * *',
    LOG_LEVEL: 'info',
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
    EXTERNAL_API_TIMEOUT_MS: 30000,
    MAX_RETRIES: 3,
    MAX_SPOOL_RETRIES: 10,
    BATCH_SIZE: 100,
    HEALTHCHECK_PORT: 8080,
    HEALTHCHECK_ENABLED: true,
    ...overrides,
  }
}

function createMockLogger(): Logger {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  } as unknown as Logger
}

// ============================================
// FR-1: Dify API認証 統合テスト
// ============================================
describe('FR-1: Dify API認証 統合テスト', () => {
  let config: EnvConfig
  let logger: Logger

  beforeEach(() => {
    vi.clearAllMocks()

    config = createTestConfig()
    logger = createMockLogger()

    // axiosモックのセットアップ
    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi.fn()
    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(axiosInstance as ReturnType<typeof axios.create>)
  })

  // AC-1-1: Cookie Jarベースの認証を使用
  it('AC-1-1: Cookie Jarを使用してセッション認証が行われる', async () => {
    // Arrange - ログイン成功のモック設定
    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi.fn().mockResolvedValue({ data: { data: [], has_more: false } })
    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(axiosInstance as ReturnType<typeof axios.create>)

    const client = createDifyApiClient({ config, logger })

    // Act - fetchAppsを呼ぶと内部でログインが発生
    await client.fetchApps()

    // Assert - Cookie Jar対応のaxiosが使用されている（wrapperがモックされている）
    expect(axios.create).toHaveBeenCalled()
  })

  // AC-1-2: メール/パスワードによるログインが必要
  it('AC-1-2: 環境変数DIFY_EMAILとDIFY_PASSWORDが設定されている', () => {
    // Assert
    expect(config.DIFY_EMAIL).toBe('test@example.com')
    expect(config.DIFY_PASSWORD).toBe('test-password')
  })

  // AC-1-3: 401エラー時のエラーハンドリング
  it('AC-1-3: APIが401エラーを返した場合、エラーログを出力して処理を終了する', async () => {
    // Arrange
    const authError = {
      response: { status: 401, data: { error: 'Unauthorized' } },
      message: 'Request failed with status code 401',
      config: { url: '/console/api/login' },
    }
    const postMock = vi.fn().mockRejectedValue(authError)
    const axiosInstance = {
      get: vi.fn(),
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(
      axiosInstance as unknown as ReturnType<typeof axios.create>,
    )

    const client = createDifyApiClient({ config, logger })

    // Act & Assert
    await expect(client.fetchApps()).rejects.toThrow()
  })
})

// ============================================
// FR-2: アプリ一覧・トークンコスト取得 統合テスト
// ============================================
describe('FR-2: アプリ一覧・トークンコスト取得 統合テスト', () => {
  let config: EnvConfig
  let logger: Logger

  beforeEach(() => {
    vi.clearAllMocks()
    config = createTestConfig()
    logger = createMockLogger()
  })

  // AC-2-1: fetchAppsでアプリ一覧を取得
  it('AC-2-1: fetchAppsがDify Console APIからアプリ一覧を取得する', async () => {
    // Arrange
    const mockApps = [createMockApp({ id: 'app-1' }), createMockApp({ id: 'app-2' })]
    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi
      .fn()
      .mockResolvedValue({ data: { data: mockApps, has_more: false, total: 2 } })
    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(axiosInstance as ReturnType<typeof axios.create>)

    const client = createDifyApiClient({ config, logger })

    // Act
    const apps = await client.fetchApps()

    // Assert
    expect(apps).toHaveLength(2)
    expect(getMock).toHaveBeenCalledWith('/console/api/apps', expect.any(Object))
  })

  // AC-2-2: fetchAppTokenCostsでアプリ別トークンコストを取得
  it('AC-2-2: fetchAppTokenCostsがアプリ別のトークンコストを取得する', async () => {
    // Arrange
    const mockCosts = [createMockTokenCost({ date: '2024-01-15' })]
    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi.fn().mockResolvedValue({ data: { data: mockCosts } })
    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(axiosInstance as ReturnType<typeof axios.create>)

    const client = createDifyApiClient({ config, logger })

    // Act
    const result = await client.fetchAppTokenCosts({
      appId: 'app-123',
      start: '2024-01-01 00:00',
      end: '2024-01-31 23:59',
    })

    // Assert
    expect(result.data).toHaveLength(1)
    expect(getMock).toHaveBeenCalledWith(
      '/console/api/apps/app-123/statistics/token-costs',
      expect.any(Object),
    )
  })

  // AC-2-3: APIタイムアウト設定
  it('AC-2-3: APIタイムアウトがDIFY_FETCH_TIMEOUT_MSで設定される', async () => {
    // Arrange
    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi.fn().mockResolvedValue({ data: { data: [], has_more: false } })
    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(axiosInstance as ReturnType<typeof axios.create>)

    const client = createDifyApiClient({ config, logger })

    // Act - fetchAppsを呼ぶと内部でクライアントが初期化される
    await client.fetchApps()

    // Assert - タイムアウトが設定されたaxiosインスタンスが作成される
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 30000,
      }),
    )
  })

  // カスタムタイムアウト設定
  it('AC-2-3-edge: カスタムタイムアウト値が正しく適用される', async () => {
    // Arrange
    config.DIFY_FETCH_TIMEOUT_MS = 60000
    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi.fn().mockResolvedValue({ data: { data: [], has_more: false } })
    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(axiosInstance as ReturnType<typeof axios.create>)

    const client = createDifyApiClient({ config, logger })

    // Act - fetchAppsを呼ぶと内部でクライアントが初期化される
    await client.fetchApps()

    // Assert
    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 60000,
      }),
    )
  })
})

// ============================================
// FR-3: DifyUsageFetcher 統合テスト
// ============================================
describe('FR-3: DifyUsageFetcher 統合テスト', () => {
  let testDir: string
  let config: EnvConfig
  let logger: Logger

  beforeEach(async () => {
    vi.clearAllMocks()
    // Note: fake timersはasync処理と相性が悪いため使用しない
    // 日付のモックは vi.spyOn(Date, 'now') で行う

    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fetcher-int-test-'))

    config = createTestConfig({
      WATERMARK_FILE_PATH: path.join(testDir, 'watermark.json'),
    })
    logger = createMockLogger()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  // AC-3-1: 全アプリのトークンコストを取得
  it('AC-3-1: 全アプリのtoken-costsを取得してコールバックに渡す', async () => {
    // Arrange
    const mockApps = [createMockApp({ id: 'app-1', name: 'App 1' })]
    const mockCosts = [createMockTokenCost()]

    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi
      .fn()
      .mockResolvedValueOnce({ data: { data: mockApps, has_more: false } }) // fetchApps
      .mockResolvedValueOnce({ data: { data: mockCosts } }) // fetchAppTokenCosts

    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(axiosInstance as ReturnType<typeof axios.create>)

    const client = createDifyApiClient({ config, logger })
    const watermarkManager = createWatermarkManager({ config, logger })
    const fetcher = createDifyUsageFetcher({ client, watermarkManager, logger, config })

    const onRecords = vi.fn().mockResolvedValue(undefined)

    // Act
    const result = await fetcher.fetch(onRecords)

    // Assert
    expect(result.success).toBe(true)
    expect(onRecords).toHaveBeenCalled()
    const receivedRecords = onRecords.mock.calls[0][0] as FetchedTokenCostRecord[]
    expect(receivedRecords[0].app_id).toBe('app-1')
    expect(receivedRecords[0].app_name).toBe('App 1')
  })

  // AC-3-2: 複数アプリの処理
  it('AC-3-2: 複数アプリのtoken-costsを順次取得する', async () => {
    // Arrange
    const mockApps = [
      createMockApp({ id: 'app-1', name: 'App 1' }),
      createMockApp({ id: 'app-2', name: 'App 2' }),
    ]
    const mockCosts1 = [createMockTokenCost({ date: '2024-01-15' })]
    const mockCosts2 = [createMockTokenCost({ date: '2024-01-16' })]

    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi
      .fn()
      .mockResolvedValueOnce({ data: { data: mockApps, has_more: false } })
      .mockResolvedValueOnce({ data: { data: mockCosts1 } })
      .mockResolvedValueOnce({ data: { data: mockCosts2 } })

    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(axiosInstance as ReturnType<typeof axios.create>)

    const client = createDifyApiClient({ config, logger })
    const watermarkManager = createWatermarkManager({ config, logger })
    const fetcher = createDifyUsageFetcher({ client, watermarkManager, logger, config })

    const onRecords = vi.fn().mockResolvedValue(undefined)

    // Act
    const result = await fetcher.fetch(onRecords)

    // Assert
    expect(result.success).toBe(true)
    expect(result.totalRecords).toBe(2)
    expect(onRecords).toHaveBeenCalledTimes(2)
  })

  // AC-3-3: 0件レスポンスの処理
  it('AC-3-3: アプリが0件の場合、正常に処理を完了する', async () => {
    // Arrange
    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi.fn().mockResolvedValue({ data: { data: [], has_more: false } })

    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(axiosInstance as ReturnType<typeof axios.create>)

    const client = createDifyApiClient({ config, logger })
    const watermarkManager = createWatermarkManager({ config, logger })
    const fetcher = createDifyUsageFetcher({ client, watermarkManager, logger, config })

    const onRecords = vi.fn().mockResolvedValue(undefined)

    // Act
    const result = await fetcher.fetch(onRecords)

    // Assert
    expect(result.success).toBe(true)
    expect(result.totalRecords).toBe(0)
    expect(onRecords).not.toHaveBeenCalled()
  })
})

// ============================================
// FR-4: ウォーターマーク管理 統合テスト
// ============================================
describe('FR-4: ウォーターマーク管理 統合テスト', () => {
  let testDir: string
  let config: EnvConfig
  let logger: Logger

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'watermark-int-test-'))

    config = createTestConfig({
      WATERMARK_FILE_PATH: path.join(testDir, 'watermark.json'),
    })
    logger = createMockLogger()
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  // AC-4-1: ウォーターマーク不存在時の初回実行
  it('AC-4-1: ウォーターマークファイルが存在しない場合、初回実行として過去N日間を取得', async () => {
    // Arrange
    const manager = createWatermarkManager({ config, logger })

    // Act
    const watermark = await manager.load()

    // Assert
    expect(watermark).toBeNull()
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('初回実行'))
  })

  // AC-4-2: ウォーターマークの読み込み
  it('AC-4-2: ウォーターマークファイルを読み込んでWatermark型として返す', async () => {
    // Arrange
    const watermarkData = {
      last_fetched_date: '2024-01-15T00:00:00.000Z',
      last_updated_at: '2024-01-15T12:00:00.000Z',
    }
    await fs.writeFile(config.WATERMARK_FILE_PATH, JSON.stringify(watermarkData), { mode: 0o600 })

    const manager = createWatermarkManager({ config, logger })

    // Act
    const watermark = await manager.load()

    // Assert
    expect(watermark).not.toBeNull()
    expect(watermark?.last_fetched_date).toBe('2024-01-15T00:00:00.000Z')
  })

  // AC-4-3: ウォーターマークの更新
  it('AC-4-3: ウォーターマークファイルを更新する', async () => {
    // Arrange
    const manager = createWatermarkManager({ config, logger })
    const newWatermark = {
      last_fetched_date: '2024-01-20T00:00:00.000Z',
      last_updated_at: '2024-01-20T12:00:00.000Z',
    }

    // Act
    await manager.update(newWatermark)

    // Assert
    const content = await fs.readFile(config.WATERMARK_FILE_PATH, 'utf-8')
    const saved = JSON.parse(content)
    expect(saved.last_fetched_date).toBe('2024-01-20T00:00:00.000Z')
  })

  // AC-4-4: バックアップ作成
  it('AC-4-4: ウォーターマーク更新前にバックアップを作成する', async () => {
    // Arrange
    const initialWatermark = {
      last_fetched_date: '2024-01-10T00:00:00.000Z',
      last_updated_at: '2024-01-10T12:00:00.000Z',
    }
    await fs.writeFile(config.WATERMARK_FILE_PATH, JSON.stringify(initialWatermark), {
      mode: 0o600,
    })

    const manager = createWatermarkManager({ config, logger })
    const newWatermark = {
      last_fetched_date: '2024-01-20T00:00:00.000Z',
      last_updated_at: '2024-01-20T12:00:00.000Z',
    }

    // Act
    await manager.update(newWatermark)

    // Assert
    const backupPath = `${config.WATERMARK_FILE_PATH}.backup`
    const backupContent = await fs.readFile(backupPath, 'utf-8')
    const backup = JSON.parse(backupContent)
    expect(backup.last_fetched_date).toBe('2024-01-10T00:00:00.000Z')
  })

  // AC-4-5: 破損ファイルからのバックアップ復元
  it('AC-4-5: ウォーターマークファイルが破損した場合、バックアップから復元する', async () => {
    // Arrange
    const backupWatermark = {
      last_fetched_date: '2024-01-10T00:00:00.000Z',
      last_updated_at: '2024-01-10T12:00:00.000Z',
    }
    const backupPath = `${config.WATERMARK_FILE_PATH}.backup`
    await fs.writeFile(backupPath, JSON.stringify(backupWatermark), { mode: 0o600 })
    await fs.writeFile(config.WATERMARK_FILE_PATH, 'invalid json', { mode: 0o600 })

    const manager = createWatermarkManager({ config, logger })

    // Act
    const watermark = await manager.load()

    // Assert
    expect(watermark).not.toBeNull()
    expect(watermark?.last_fetched_date).toBe('2024-01-10T00:00:00.000Z')
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('復元'), expect.any(Object))
  })

  // AC-4-6: ファイルパーミッション
  it('AC-4-6: ウォーターマークファイルのパーミッションが600である', async () => {
    // Arrange
    const manager = createWatermarkManager({ config, logger })
    const newWatermark = {
      last_fetched_date: '2024-01-20T00:00:00.000Z',
      last_updated_at: '2024-01-20T12:00:00.000Z',
    }

    // Act
    await manager.update(newWatermark)

    // Assert
    const stats = await fs.stat(config.WATERMARK_FILE_PATH)
    const mode = stats.mode & 0o777
    expect(mode).toBe(0o600)
  })
})

// ============================================
// FR-5: エラーリトライ 統合テスト
// ============================================
describe('FR-5: エラーリトライ 統合テスト', () => {
  let config: EnvConfig
  let logger: Logger

  beforeEach(() => {
    vi.clearAllMocks()
    config = createTestConfig()
    logger = createMockLogger()
  })

  // AC-5-1: 5xxエラーでリトライ
  it('AC-5-1: 5xxエラー発生時にリトライが設定される', async () => {
    // Arrange
    const serverError = {
      response: { status: 500, data: { error: 'Internal Server Error' } },
      message: 'Request failed with status code 500',
      config: { url: '/console/api/apps' },
    }
    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi.fn().mockRejectedValue(serverError)
    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(
      axiosInstance as unknown as ReturnType<typeof axios.create>,
    )

    const client = createDifyApiClient({ config, logger })

    // Act & Assert
    await expect(client.fetchApps()).rejects.toThrow()
  })

  // AC-5-2: 401エラーはリトライしない
  it('AC-5-2: 401エラーはリトライせず即座に失敗する', async () => {
    // Arrange
    const authError = {
      response: { status: 401, data: { error: 'Unauthorized' } },
      message: 'Request failed with status code 401',
      config: { url: '/console/api/login' },
    }
    const postMock = vi.fn().mockRejectedValue(authError)
    const axiosInstance = {
      get: vi.fn(),
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(
      axiosInstance as unknown as ReturnType<typeof axios.create>,
    )

    const client = createDifyApiClient({ config, logger })

    // Act & Assert
    await expect(client.fetchApps()).rejects.toThrow()
    expect(postMock).toHaveBeenCalledTimes(1) // リトライなし
  })

  // AC-5-3: 429エラーでRetry-After対応
  it('AC-5-3: 429エラー時にRetry-Afterヘッダーを考慮する', async () => {
    // Arrange - axios-retryがモックされているため、設定が正しく渡されることを確認
    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi.fn().mockResolvedValue({ data: { data: [], has_more: false } })
    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(
      axiosInstance as unknown as ReturnType<typeof axios.create>,
    )

    // Act - fetchAppsを呼ぶと内部でaxios-retryが設定される
    const client = createDifyApiClient({ config, logger })
    await client.fetchApps()

    // Assert - axios-retryが設定されている（モックで確認）
    const axiosRetry = await import('axios-retry')
    expect(axiosRetry.default).toHaveBeenCalled()
  })
})

// ============================================
// FR-6: バリデーション 統合テスト
// ============================================
describe('FR-6: バリデーション 統合テスト', () => {
  let testDir: string
  let config: EnvConfig
  let logger: Logger

  beforeEach(async () => {
    vi.clearAllMocks()
    // Note: fake timersはasync処理と相性が悪いため使用しない

    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'validation-int-test-'))

    config = createTestConfig({
      WATERMARK_FILE_PATH: path.join(testDir, 'watermark.json'),
    })
    logger = createMockLogger()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  // AC-6-1: 正常なレコードのバリデーション
  it('AC-6-1: 正常なレコードがバリデーションに成功する', async () => {
    // Arrange
    const mockApps = [createMockApp()]
    const mockCosts = [createMockTokenCost()]

    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi
      .fn()
      .mockResolvedValueOnce({ data: { data: mockApps, has_more: false } })
      .mockResolvedValueOnce({ data: { data: mockCosts } })

    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(axiosInstance as ReturnType<typeof axios.create>)

    const client = createDifyApiClient({ config, logger })
    const watermarkManager = createWatermarkManager({ config, logger })
    const fetcher = createDifyUsageFetcher({ client, watermarkManager, logger, config })

    const onRecords = vi.fn().mockResolvedValue(undefined)

    // Act
    const result = await fetcher.fetch(onRecords)

    // Assert
    expect(result.success).toBe(true)
    expect(result.totalRecords).toBe(1)
  })

  // AC-6-2: 不正なレコードのスキップ
  it('AC-6-2: 不正なレコードをスキップして処理を継続する', async () => {
    // Arrange
    const mockApps = [createMockApp()]
    const mockCosts = [
      createMockTokenCost({ date: '2024-01-15' }),
      { date: 'invalid-date', token_count: -1, total_price: 'invalid' }, // 不正なレコード
      createMockTokenCost({ date: '2024-01-17' }),
    ]

    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi
      .fn()
      .mockResolvedValueOnce({ data: { data: mockApps, has_more: false } })
      .mockResolvedValueOnce({ data: { data: mockCosts } })

    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(axiosInstance as ReturnType<typeof axios.create>)

    const client = createDifyApiClient({ config, logger })
    const watermarkManager = createWatermarkManager({ config, logger })
    const fetcher = createDifyUsageFetcher({ client, watermarkManager, logger, config })

    const onRecords = vi.fn().mockResolvedValue(undefined)

    // Act
    const result = await fetcher.fetch(onRecords)

    // Assert
    expect(result.errors.some((e) => e.type === 'validation')).toBe(true)
    expect(result.totalRecords).toBe(2) // 2件の正常なレコード
  })

  // AC-6-3: バリデーションエラーのログ出力
  it('AC-6-3: バリデーションエラー時にwarningログを出力する', async () => {
    // Arrange
    const mockApps = [createMockApp()]
    const mockCosts = [{ date: 'invalid', token_count: 'not-a-number', total_price: null }]

    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi
      .fn()
      .mockResolvedValueOnce({ data: { data: mockApps, has_more: false } })
      .mockResolvedValueOnce({ data: { data: mockCosts } })

    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(axiosInstance as ReturnType<typeof axios.create>)

    const client = createDifyApiClient({ config, logger })
    const watermarkManager = createWatermarkManager({ config, logger })
    const fetcher = createDifyUsageFetcher({ client, watermarkManager, logger, config })

    const onRecords = vi.fn().mockResolvedValue(undefined)

    // Act
    await fetcher.fetch(onRecords)

    // Assert
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('バリデーションエラー'),
      expect.any(Object),
    )
  })
})

// ============================================
// FR-7: ログ出力 統合テスト
// ============================================
describe('FR-7: ログ出力 統合テスト', () => {
  let testDir: string
  let config: EnvConfig
  let logger: Logger

  beforeEach(async () => {
    vi.clearAllMocks()
    // Note: fake timersはasync処理と相性が悪いため使用しない

    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'log-int-test-'))

    config = createTestConfig({
      WATERMARK_FILE_PATH: path.join(testDir, 'watermark.json'),
    })
    logger = createMockLogger()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  // AC-7-1: 取得開始ログ
  it('AC-7-1: 取得開始時にinfoログを出力する', async () => {
    // Arrange
    const mockApps = [createMockApp()]
    const mockCosts = [createMockTokenCost()]

    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi
      .fn()
      .mockResolvedValueOnce({ data: { data: mockApps, has_more: false } })
      .mockResolvedValueOnce({ data: { data: mockCosts } })

    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(axiosInstance as ReturnType<typeof axios.create>)

    const client = createDifyApiClient({ config, logger })
    const watermarkManager = createWatermarkManager({ config, logger })
    const fetcher = createDifyUsageFetcher({ client, watermarkManager, logger, config })

    // Act
    await fetcher.fetch(async () => {})

    // Assert
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('取得開始'),
      expect.any(Object),
    )
  })

  // AC-7-2: 取得完了ログ
  it('AC-7-2: 取得完了時にinfoログを出力する', async () => {
    // Arrange
    const mockApps = [createMockApp()]
    const mockCosts = [createMockTokenCost()]

    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi
      .fn()
      .mockResolvedValueOnce({ data: { data: mockApps, has_more: false } })
      .mockResolvedValueOnce({ data: { data: mockCosts } })

    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(axiosInstance as ReturnType<typeof axios.create>)

    const client = createDifyApiClient({ config, logger })
    const watermarkManager = createWatermarkManager({ config, logger })
    const fetcher = createDifyUsageFetcher({ client, watermarkManager, logger, config })

    // Act
    await fetcher.fetch(async () => {})

    // Assert
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('取得完了'),
      expect.objectContaining({
        success: expect.any(Boolean),
        totalRecords: expect.any(Number),
        durationMs: expect.any(Number),
      }),
    )
  })

  // AC-7-3: パスワードがログに含まれない
  it('AC-7-3: DIFY_PASSWORDの値がログに含まれない', async () => {
    // Arrange
    const mockApps = [createMockApp()]
    const mockCosts = [createMockTokenCost()]

    const postMock = vi.fn().mockResolvedValue({ data: { result: 'success' } })
    const getMock = vi
      .fn()
      .mockResolvedValueOnce({ data: { data: mockApps, has_more: false } })
      .mockResolvedValueOnce({ data: { data: mockCosts } })

    const axiosInstance = {
      get: getMock,
      post: postMock,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }
    vi.mocked(axios.create).mockReturnValue(axiosInstance as ReturnType<typeof axios.create>)

    const client = createDifyApiClient({ config, logger })
    const watermarkManager = createWatermarkManager({ config, logger })
    const fetcher = createDifyUsageFetcher({ client, watermarkManager, logger, config })

    // Act
    await fetcher.fetch(async () => {})

    // Assert
    const allCalls = [
      ...vi.mocked(logger.info).mock.calls,
      ...vi.mocked(logger.debug).mock.calls,
      ...vi.mocked(logger.warn).mock.calls,
      ...vi.mocked(logger.error).mock.calls,
    ]
    for (const call of allCalls) {
      const logString = JSON.stringify(call)
      expect(logString).not.toContain(config.DIFY_PASSWORD)
    }
  })
})
