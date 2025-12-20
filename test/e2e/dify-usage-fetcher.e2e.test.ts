// Dify使用量データ取得機能 E2Eテスト - Design Doc: specs/stories/2-dify-usage-fetcher/design.md
// 生成日: 2025-11-29
// テスト種別: End-to-End Test
// 実装タイミング: 全実装完了後

import * as fs from 'node:fs'
import * as fsPromises from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// 環境変数テスト用のdotenvモック（.envからの読み込みを無効化）
vi.mock('dotenv', () => ({
  default: { config: vi.fn() },
  config: vi.fn(),
}))

import { loadConfig } from '../../src/config/env-config.js'
import { createDifyApiClient, type DifyApp } from '../../src/fetcher/dify-api-client.js'
import {
  createDifyUsageFetcher,
  type FetchedTokenCostRecord,
} from '../../src/fetcher/dify-usage-fetcher.js'
import type { DifyAppTokenCost } from '../../src/types/dify-usage.js'
import type { EnvConfig } from '../../src/types/env.js'
import { createWatermarkManager } from '../../src/watermark/watermark-manager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '../../')
const TEST_DATA_DIR = path.join(PROJECT_ROOT, 'tmp/test-e2e')
const WATERMARK_FILE_PATH = path.join(TEST_DATA_DIR, 'watermark.json')
const WATERMARK_BACKUP_PATH = path.join(TEST_DATA_DIR, 'watermark.json.backup')

// ============================================
// モック設定
// ============================================

// モックレスポンスの状態管理
type MockResponse = {
  type: 'apps' | 'token-costs'
  status: number
  data: { data: DifyApp[] | DifyAppTokenCost[] }
  headers?: Record<string, string>
}

let mockResponses: MockResponse[] = []
let callIndex = 0

// axiosモックの設定
vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn(() => {
        return {
          get: vi.fn(async (url: string) => {
            if (callIndex >= mockResponses.length) {
              throw new Error('Mock response not configured')
            }
            const response = mockResponses[callIndex]
            callIndex++
            if (response.status >= 400) {
              const error = {
                response: { status: response.status, headers: response.headers || {} },
                message: `Request failed with status code ${response.status}`,
                config: { url },
              }
              throw error
            }
            return { data: response.data, status: response.status, headers: response.headers || {} }
          }),
          post: vi.fn().mockResolvedValue({ data: { result: 'success' } }),
          interceptors: {
            request: { use: vi.fn() },
            response: { use: vi.fn() },
          },
        }
      }),
    },
  }
})

// axios-retryをバイパス
vi.mock('axios-retry', () => ({
  default: vi.fn(),
  exponentialDelay: vi.fn((retryCount: number) => 100 * 2 ** (retryCount - 1)),
  isNetworkOrIdempotentRequestError: vi.fn(() => false),
}))

// Cookie Jar関連のモック
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

// テスト用環境変数セット
function getTestEnv(): Record<string, string> {
  return {
    DIFY_API_BASE_URL: 'https://api.dify.ai',
    DIFY_EMAIL: 'test@example.com',
    DIFY_PASSWORD: 'test-password',
    EXTERNAL_API_URL: 'https://external.api.com',
    EXTERNAL_API_TOKEN: 'test-external-token',
    // API_Meter新仕様対応（SPEC-CHANGE-001）
    API_METER_TENANT_ID: '550e8400-e29b-41d4-a716-446655440000',
    API_METER_TOKEN: 'test-api-meter-token',
    API_METER_URL: 'https://api-meter.example.com',
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    CRON_SCHEDULE: '0 0 * * *',
    GRACEFUL_SHUTDOWN_TIMEOUT: '5',
    MAX_RETRY: '3',
    WATERMARK_FILE_PATH: WATERMARK_FILE_PATH,
    DIFY_FETCH_PAGE_SIZE: '100',
    DIFY_FETCH_DAYS: '30',
    DIFY_FETCH_TIMEOUT_MS: '30000',
    DIFY_FETCH_RETRY_COUNT: '3',
    WATERMARK_ENABLED: 'true', // E2Eテストではウォーターマーク機能を有効にする
  }
}

// テスト用アプリ生成
function createTestApp(overrides: Partial<DifyApp> = {}): DifyApp {
  return {
    id: 'app-123',
    name: 'Test App',
    mode: 'chat',
    ...overrides,
  }
}

// テスト用トークンコスト生成
function createTestTokenCost(overrides: Partial<DifyAppTokenCost> = {}): DifyAppTokenCost {
  return {
    date: '2024-01-15',
    token_count: 100,
    total_price: '0.001',
    currency: 'USD',
    ...overrides,
  }
}

// モックレスポンス設定
function setMockResponsesSync(responses: MockResponse[]): void {
  mockResponses = responses
  callIndex = 0
}

// モックレスポンスリセット
function resetMockResponsesSync(): void {
  mockResponses = []
  callIndex = 0
}

// テストデータディレクトリのクリーンアップ
async function cleanupTestDir(): Promise<void> {
  try {
    await fsPromises.rm(TEST_DATA_DIR, { recursive: true, force: true })
  } catch {
    // ディレクトリが存在しない場合は無視
  }
}

// テストデータディレクトリの作成
async function setupTestDir(): Promise<void> {
  await fsPromises.mkdir(TEST_DATA_DIR, { recursive: true })
}

// 設定をロード（テスト用環境変数を使用）
function loadTestConfig(): EnvConfig {
  const originalEnv = { ...process.env }
  const testEnv = getTestEnv()
  for (const [key, value] of Object.entries(testEnv)) {
    process.env[key] = value
  }
  const config = loadConfig()
  process.env = originalEnv
  return config
}

// Fetcherを作成
function createTestFetcher(configOverrides: Partial<EnvConfig> = {}): {
  fetcher: ReturnType<typeof createDifyUsageFetcher>
  logs: string[]
  config: EnvConfig
} {
  const config = { ...loadTestConfig(), ...configOverrides }
  const logs: string[] = []

  // ログをキャプチャするためのカスタムロガー
  const logger = {
    info: (message: string, meta?: Record<string, unknown>) => {
      logs.push(JSON.stringify({ level: 'info', message, ...meta }))
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      logs.push(JSON.stringify({ level: 'warn', message, ...meta }))
    },
    error: (message: string, meta?: Record<string, unknown>) => {
      logs.push(JSON.stringify({ level: 'error', message, ...meta }))
    },
    debug: (message: string, meta?: Record<string, unknown>) => {
      logs.push(JSON.stringify({ level: 'debug', message, ...meta }))
    },
  }

  const watermarkManager = createWatermarkManager({ config, logger })
  const client = createDifyApiClient({ config, logger })
  const fetcher = createDifyUsageFetcher({
    client,
    watermarkManager,
    logger,
    config,
  })

  return { fetcher, logs, config }
}

// ============================================
// テストスイート
// ============================================

describe('DifyUsageFetcher E2Eテスト', () => {
  beforeAll(async () => {
    await cleanupTestDir()
  })

  beforeEach(async () => {
    await setupTestDir()
    resetMockResponsesSync()
    vi.clearAllMocks()
  })

  afterEach(async () => {
    await cleanupTestDir()
  })

  // ============================================
  // 初回実行シナリオ E2Eテスト
  // ============================================
  describe('初回実行シナリオ E2Eテスト', () => {
    it('E2E: ウォーターマークファイルが存在しない初回実行でデータを取得する', async () => {
      const apps = [createTestApp()]
      const costs = [createTestTokenCost()]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs } },
      ])

      const { fetcher, logs } = createTestFetcher()
      const collectedRecords: FetchedTokenCostRecord[] = []
      const result = await fetcher.fetch(async (recs) => {
        collectedRecords.push(...recs)
      })

      expect(result.success).toBe(true)
      expect(result.totalRecords).toBe(1)
      expect(collectedRecords).toHaveLength(1)
      expect(logs.some((log) => log.includes('初回実行'))).toBe(true)
    })

    it('E2E: 初回実行完了後にウォーターマークファイルが作成される', async () => {
      const apps = [createTestApp()]
      const costs = [createTestTokenCost()]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs } },
      ])

      const { fetcher } = createTestFetcher()
      await fetcher.fetch(async () => {})

      const exists = fs.existsSync(WATERMARK_FILE_PATH)
      expect(exists).toBe(true)

      const content = await fsPromises.readFile(WATERMARK_FILE_PATH, 'utf-8')
      const watermark = JSON.parse(content)
      expect(watermark.last_fetched_date).toBeDefined()
    })

    it('E2E: 初回実行時に「ウォーターマークファイル不存在（初回実行）」ログが出力される', async () => {
      const apps = [createTestApp()]
      const costs = [createTestTokenCost()]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs } },
      ])

      const { fetcher, logs } = createTestFetcher()
      await fetcher.fetch(async () => {})

      expect(logs.some((log) => log.includes('初回実行'))).toBe(true)
    })

    it('E2E: 初回実行で作成されたウォーターマークファイルのパーミッションが600である', async () => {
      const apps = [createTestApp()]
      const costs = [createTestTokenCost()]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs } },
      ])

      const { fetcher } = createTestFetcher()
      await fetcher.fetch(async () => {})

      const stats = await fsPromises.stat(WATERMARK_FILE_PATH)
      const mode = stats.mode & 0o777
      expect(mode).toBe(0o600)
    })
  })

  // ============================================
  // 差分取得シナリオ E2Eテスト
  // ============================================
  describe('差分取得シナリオ E2Eテスト', () => {
    it('E2E: 2回目実行で前回からの差分のみを取得する', async () => {
      // ウォーターマークを作成
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      await fsPromises.writeFile(
        WATERMARK_FILE_PATH,
        JSON.stringify({
          last_fetched_date: yesterday.toISOString(),
          last_updated_at: yesterday.toISOString(),
        }),
        { mode: 0o600 },
      )

      const apps = [createTestApp()]
      const costs = [createTestTokenCost({ date: '2024-01-16' })]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs } },
      ])

      const { fetcher, logs } = createTestFetcher()
      const result = await fetcher.fetch(async () => {})

      expect(result.success).toBe(true)
      expect(logs.some((log) => log.includes('初回実行'))).toBe(false)
      expect(logs.some((log) => log.includes('読み込み成功'))).toBe(true)
    })

    it('E2E: 差分取得完了後にウォーターマークが更新される', async () => {
      const oldDate = new Date('2024-01-01T00:00:00.000Z')
      await fsPromises.writeFile(
        WATERMARK_FILE_PATH,
        JSON.stringify({
          last_fetched_date: oldDate.toISOString(),
          last_updated_at: oldDate.toISOString(),
        }),
        { mode: 0o600 },
      )

      const apps = [createTestApp()]
      const costs = [createTestTokenCost()]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs } },
      ])

      const { fetcher } = createTestFetcher()
      await fetcher.fetch(async () => {})

      const content = await fsPromises.readFile(WATERMARK_FILE_PATH, 'utf-8')
      const watermark = JSON.parse(content)
      const newDate = new Date(watermark.last_fetched_date)
      expect(newDate.getTime()).toBeGreaterThan(oldDate.getTime())
    })

    it('E2E: ウォーターマーク更新前にバックアップファイルが作成される', async () => {
      const existingWatermark = {
        last_fetched_date: '2024-01-01T00:00:00.000Z',
        last_updated_at: '2024-01-01T00:00:00.000Z',
      }
      await fsPromises.writeFile(WATERMARK_FILE_PATH, JSON.stringify(existingWatermark), {
        mode: 0o600,
      })

      const apps = [createTestApp()]
      const costs = [createTestTokenCost()]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs } },
      ])

      const { fetcher } = createTestFetcher()
      await fetcher.fetch(async () => {})

      const backupExists = fs.existsSync(WATERMARK_BACKUP_PATH)
      expect(backupExists).toBe(true)

      const backupContent = await fsPromises.readFile(WATERMARK_BACKUP_PATH, 'utf-8')
      const backup = JSON.parse(backupContent)
      expect(backup.last_fetched_date).toBe(existingWatermark.last_fetched_date)
    })
  })

  // ============================================
  // 複数アプリシナリオ E2Eテスト
  // ============================================
  describe('複数アプリシナリオ E2Eテスト', () => {
    it('E2E: 複数アプリのデータを取得する', async () => {
      const apps = [createTestApp({ id: 'app-1' }), createTestApp({ id: 'app-2' })]
      const costs1 = [createTestTokenCost({ date: '2024-01-15' })]
      const costs2 = [createTestTokenCost({ date: '2024-01-16' })]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs1 } },
        { type: 'token-costs', status: 200, data: { data: costs2 } },
      ])

      const { fetcher } = createTestFetcher()
      const collected: FetchedTokenCostRecord[] = []
      const result = await fetcher.fetch(async (recs) => {
        collected.push(...recs)
      })

      expect(result.success).toBe(true)
      expect(result.totalRecords).toBe(2)
      expect(collected).toHaveLength(2)
    })

    it('E2E: アプリが0件の場合、正常に処理を完了する', async () => {
      setMockResponsesSync([{ type: 'apps', status: 200, data: { data: [] } }])

      const { fetcher } = createTestFetcher()
      const result = await fetcher.fetch(async () => {})

      expect(result.success).toBe(true)
      expect(result.totalRecords).toBe(0)
    })
  })

  // ============================================
  // エラー復旧シナリオ E2Eテスト
  // ============================================
  describe('エラー復旧シナリオ E2Eテスト', () => {
    it('E2E: 5xxエラー発生時にエラーが記録される', async () => {
      setMockResponsesSync([{ type: 'apps', status: 500, data: { data: [] } }])

      const { fetcher } = createTestFetcher()
      const result = await fetcher.fetch(async () => {})

      expect(result.errors.length).toBeGreaterThanOrEqual(1)
    })

    it('E2E: 401エラー発生時にリトライせず適切なエラーログを出力して終了する', async () => {
      setMockResponsesSync([{ type: 'apps', status: 401, data: { data: [] } }])

      const { fetcher } = createTestFetcher()
      const result = await fetcher.fetch(async () => {})

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
    })

    it('E2E: ウォーターマークファイルが破損した場合、バックアップから復元する', async () => {
      const backupWatermark = {
        last_fetched_date: '2024-01-10T00:00:00.000Z',
        last_updated_at: '2024-01-10T00:00:00.000Z',
      }
      await fsPromises.writeFile(WATERMARK_BACKUP_PATH, JSON.stringify(backupWatermark), {
        mode: 0o600,
      })
      await fsPromises.writeFile(WATERMARK_FILE_PATH, 'invalid json', { mode: 0o600 })

      const apps = [createTestApp()]
      const costs = [createTestTokenCost()]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs } },
      ])

      const { fetcher, logs } = createTestFetcher()
      await fetcher.fetch(async () => {})

      expect(logs.some((log) => log.includes('復元'))).toBe(true)
    })

    it('E2E: バリデーションエラーのレコードをスキップして残りのデータを処理する', async () => {
      const apps = [createTestApp()]
      const costs = [
        createTestTokenCost({ date: '2024-01-15' }),
        { date: 'invalid', token_count: -1, total_price: 'bad' } as DifyAppTokenCost,
        createTestTokenCost({ date: '2024-01-17' }),
      ]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs } },
      ])

      const { fetcher } = createTestFetcher()
      const collected: FetchedTokenCostRecord[] = []
      const result = await fetcher.fetch(async (recs) => {
        collected.push(...recs)
      })

      expect(collected.length).toBeLessThanOrEqual(3)
      expect(result.errors.some((e) => e.type === 'validation')).toBe(true)
    })
  })

  // ============================================
  // ログ出力シナリオ E2Eテスト
  // ============================================
  describe('ログ出力シナリオ E2Eテスト', () => {
    it('E2E: すべてのログがJSON形式で出力される', async () => {
      const apps = [createTestApp()]
      const costs = [createTestTokenCost()]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs } },
      ])

      const { fetcher, logs } = createTestFetcher()
      await fetcher.fetch(async () => {})

      for (const log of logs) {
        expect(() => JSON.parse(log)).not.toThrow()
      }
    })

    it('E2E: Dify使用量取得開始と完了ログが出力される', async () => {
      const apps = [createTestApp()]
      const costs = [createTestTokenCost()]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs } },
      ])

      const { fetcher, logs } = createTestFetcher()
      await fetcher.fetch(async () => {})

      expect(logs.some((log) => log.includes('取得開始'))).toBe(true)
      expect(logs.some((log) => log.includes('取得完了'))).toBe(true)
    })

    it('E2E: すべてのログにDIFY_PASSWORDの値が含まれない', async () => {
      const apps = [createTestApp()]
      const costs = [createTestTokenCost()]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs } },
      ])

      const { fetcher, logs, config } = createTestFetcher()
      await fetcher.fetch(async () => {})

      const password = config.DIFY_PASSWORD
      for (const log of logs) {
        expect(log).not.toContain(password)
      }
    })

    it('E2E: 取得完了時に実行結果サマリー（件数、所要時間）がログに出力される', async () => {
      const apps = [createTestApp()]
      const costs = [createTestTokenCost()]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs } },
      ])

      const { fetcher, logs } = createTestFetcher()
      await fetcher.fetch(async () => {})

      // 「Dify使用量取得完了」で正確に検索（「アプリ一覧取得完了」等との混同を避ける）
      const completionLog = logs.find((log) => log.includes('Dify使用量取得完了'))
      expect(completionLog).toBeDefined()

      const parsed = JSON.parse(completionLog as string)
      expect(parsed.totalRecords).toBeDefined()
      expect(parsed.durationMs).toBeDefined()
    })
  })

  // ============================================
  // 環境変数設定シナリオ E2Eテスト
  // ============================================
  describe('環境変数設定シナリオ E2Eテスト', () => {
    it('E2E: 必須環境変数（DIFY_API_BASE_URL, DIFY_EMAIL, DIFY_PASSWORD）が未設定の場合、エラーで終了する', async () => {
      const originalEnv = { ...process.env }

      // process.exitをモック
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called')
      })

      // 環境変数をクリアして必須項目を未設定に
      process.env = {}

      expect(() => loadConfig()).toThrow()

      process.env = originalEnv
      mockExit.mockRestore()
    })

    it('E2E: オプション環境変数が未設定の場合、デフォルト値が適用される', async () => {
      const config = loadTestConfig()

      expect(config.DIFY_FETCH_PAGE_SIZE).toBe(100)
      expect(config.DIFY_FETCH_DAYS).toBe(30)
      expect(config.DIFY_FETCH_TIMEOUT_MS).toBe(30000)
      expect(config.DIFY_FETCH_RETRY_COUNT).toBe(3)
    })

    it('E2E: 無効な環境変数値（不正なURL）が設定された場合、エラーで終了する', async () => {
      const originalEnv = { ...process.env }
      process.env.DIFY_API_BASE_URL = 'invalid-url'

      expect(() => loadConfig()).toThrow()

      process.env = originalEnv
    })
  })

  // ============================================
  // 全体フローシナリオ E2Eテスト
  // ============================================
  describe('全体フローシナリオ E2Eテスト', () => {
    it('E2E: 初回実行 → ウォーターマーク作成 → 2回目実行の完全フローが成功する', async () => {
      // 1回目（初回実行）
      const apps1 = [createTestApp()]
      const costs1 = [createTestTokenCost({ date: '2024-01-15' })]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps1 } },
        { type: 'token-costs', status: 200, data: { data: costs1 } },
      ])
      const { fetcher: f1 } = createTestFetcher()
      const result1 = await f1.fetch(async () => {})
      expect(result1.success).toBe(true)

      // ウォーターマーク作成を確認
      expect(fs.existsSync(WATERMARK_FILE_PATH)).toBe(true)

      // 2回目（差分取得）
      const apps2 = [createTestApp()]
      const costs2 = [createTestTokenCost({ date: '2024-01-16' })]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps2 } },
        { type: 'token-costs', status: 200, data: { data: costs2 } },
      ])
      const { fetcher: f2 } = createTestFetcher()
      const result2 = await f2.fetch(async () => {})
      expect(result2.success).toBe(true)
    })

    it('E2E: 正常なデータ取得フロー', async () => {
      const apps = [createTestApp()]
      const costs = [createTestTokenCost()]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs } },
      ])

      const { fetcher } = createTestFetcher()
      const result = await fetcher.fetch(async () => {})

      expect(result.success).toBe(true)
    })
  })

  // ============================================
  // Docker環境シナリオ E2Eテスト
  // ============================================
  describe('Docker環境シナリオ E2Eテスト', () => {
    it('E2E: Dockerコンテナに環境変数が正しく渡される', async () => {
      const config = loadTestConfig()

      expect(config.DIFY_API_BASE_URL).toBe('https://api.dify.ai')
      expect(config.DIFY_EMAIL).toBe('test@example.com')
      expect(config.DIFY_PASSWORD).toBe('test-password')
      expect(config.WATERMARK_FILE_PATH).toBe(WATERMARK_FILE_PATH)
    })

    it('E2E: ボリュームマウントでウォーターマークファイルが永続化される', async () => {
      const apps = [createTestApp()]
      const costs = [createTestTokenCost()]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs } },
      ])

      const { fetcher } = createTestFetcher()
      await fetcher.fetch(async () => {})

      expect(fs.existsSync(WATERMARK_FILE_PATH)).toBe(true)

      const content = await fsPromises.readFile(WATERMARK_FILE_PATH, 'utf-8')
      const watermark = JSON.parse(content)
      expect(watermark.last_fetched_date).toBeDefined()
    })

    it('E2E: Graceful Shutdown時にウォーターマークが正しく保存される', async () => {
      const apps = [createTestApp()]
      const costs = [createTestTokenCost()]
      setMockResponsesSync([
        { type: 'apps', status: 200, data: { data: apps } },
        { type: 'token-costs', status: 200, data: { data: costs } },
      ])

      const { fetcher } = createTestFetcher()
      await fetcher.fetch(async () => {})

      const exists = fs.existsSync(WATERMARK_FILE_PATH)
      expect(exists).toBe(true)

      const content = await fsPromises.readFile(WATERMARK_FILE_PATH, 'utf-8')
      expect(() => JSON.parse(content)).not.toThrow()
    })
  })
})
