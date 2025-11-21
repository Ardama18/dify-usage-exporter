---
story_id: 4
title: external-api-sender
epic_id: 1
type: task
feature: external-api-sender
phase: 1
task_number: 002
version: 1.0.0
created: 2025-01-21
based_on: specs/stories/4-external-api-sender/plan.md
---

# タスク: HttpClientクラス実装と単体テスト作成

## メタ情報
- 依存:
  - phase1-001（env-config拡張） → 成果物: src/config/env-config.ts
  - phase0-001（型定義） → 成果物: src/types/external-api.ts
- 提供:
  - src/sender/http-client.ts
  - src/sender/__tests__/http-client.test.ts
- サイズ: 小規模（1ファイル）
- 確認レベル: L1（単体テスト実行）

## 実装内容
axiosインスタンス作成、axios-retry設定（指数バックオフ、リトライ条件）、リクエスト/レスポンスインターセプター（ログ出力、トークンマスク）を実装する。

## 対象ファイル
- [ ] src/sender/http-client.ts（新規作成）
- [ ] src/sender/__tests__/http-client.test.ts（新規作成）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [ ] 依存成果物の確認
  - src/config/env-config.ts（EXTERNAL_API_*環境変数）
  - src/types/external-api.ts（ExternalApiRecord型）
- [ ] 失敗するテストを作成
  - axios POST送信のテスト（モックAPI使用）
  - リトライ動作のテスト（1回目500エラー、2回目200レスポンス）
  - タイムアウトのテスト
  - トークンマスクのテスト（ログ出力確認）
  - リトライ条件判定のテスト（5xx, 429, ネットワークエラー）
- [ ] テスト実行して失敗を確認
  ```bash
  cd backend && npm run test:unit -- src/sender/__tests__/http-client.test.ts
  ```

### 2. Green Phase
- [ ] HttpClientクラス実装
  - axiosインスタンス作成（baseURL、timeout、認証ヘッダー）
  - axios-retry設定（指数バックオフ、リトライ条件）
  - リクエストインターセプター（ログ出力、トークンマスク）
  - レスポンスインターセプター（ログ出力、エラーハンドリング）
  - post()メソッド実装
- [ ] 追加したテストのみ実行して通ることを確認

### 3. Refactor Phase
- [ ] コード整理（インターセプター関数の分離）
- [ ] エラーメッセージの明確化
- [ ] 追加したテストが引き続き通ることを確認

## 完了条件
- [ ] 追加したテストが全てパス
- [ ] TypeScript strict mode: エラー0件
  ```bash
  cd backend && npm run build
  ```
- [ ] Biome lint: エラー0件
  ```bash
  cd backend && npm run check
  ```
- [ ] 動作確認完了（L1: 単体テスト実行）
  ```bash
  cd backend && npm run test:unit -- src/sender/__tests__/http-client.test.ts
  ```
- [ ] 成果物作成完了
  - src/sender/http-client.ts

## 実装サンプル

### HttpClientクラス（src/sender/http-client.ts）
```typescript
import axios, { type AxiosInstance, type AxiosResponse, AxiosError } from 'axios'
import axiosRetry from 'axios-retry'
import type { Logger } from 'winston'
import type { EnvConfig } from '../config/env-config.js'

export class HttpClient {
  private readonly client: AxiosInstance

  constructor(
    private readonly logger: Logger,
    private readonly config: EnvConfig
  ) {
    // 1. axiosインスタンス作成
    this.client = axios.create({
      baseURL: this.config.EXTERNAL_API_ENDPOINT,
      timeout: this.config.EXTERNAL_API_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.EXTERNAL_API_TOKEN}`,
        'User-Agent': 'dify-usage-exporter/1.0.0'
      }
    })

    // 2. axios-retry設定
    axiosRetry(this.client, {
      retries: this.config.MAX_RETRIES,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          (error.response?.status !== undefined && error.response.status >= 500) ||
          (error.response?.status === 429)
      },
      onRetry: (retryCount, error, requestConfig) => {
        this.logger.warn('Retrying request', {
          retryCount,
          url: requestConfig.url,
          status: error.response?.status,
          message: error.message
        })
      }
    })

    // 3. リクエストインターセプター
    this.client.interceptors.request.use((config) => {
      this.logger.debug('HTTP Request', {
        method: config.method,
        url: config.url,
        headers: this.maskToken(config.headers)
      })
      return config
    })

    // 4. レスポンスインターセプター
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug('HTTP Response', {
          status: response.status,
          statusText: response.statusText
        })
        return response
      },
      (error: AxiosError) => {
        this.logger.error('HTTP Error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          retryCount: error.config?.['axios-retry']?.retryCount
        })
        throw error
      }
    )
  }

  async post(path: string, data: unknown): Promise<AxiosResponse> {
    return this.client.post(path, data)
  }

  private maskToken(headers: Record<string, unknown>): Record<string, unknown> {
    const masked = { ...headers }
    if (masked.Authorization && typeof masked.Authorization === 'string') {
      masked.Authorization = 'Bearer ***MASKED***'
    }
    return masked
  }
}
```

### テストサンプル（src/sender/__tests__/http-client.test.ts）
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import nock from 'nock'
import type { Logger } from 'winston'
import { HttpClient } from '../http-client.js'
import type { EnvConfig } from '../../config/env-config.js'

describe('HttpClient', () => {
  let httpClient: HttpClient
  let mockLogger: Logger
  let mockConfig: EnvConfig

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    } as unknown as Logger

    mockConfig = {
      EXTERNAL_API_ENDPOINT: 'https://api.example.com',
      EXTERNAL_API_TOKEN: 'test-token',
      EXTERNAL_API_TIMEOUT_MS: 30000,
      MAX_RETRIES: 3
    } as EnvConfig

    httpClient = new HttpClient(mockLogger, mockConfig)
  })

  it('should send POST request successfully', async () => {
    nock('https://api.example.com')
      .post('/usage')
      .reply(200, { success: true })

    const response = await httpClient.post('/usage', { data: 'test' })

    expect(response.status).toBe(200)
    expect(response.data).toEqual({ success: true })
  })

  it('should retry on 500 error and succeed on second attempt', async () => {
    nock('https://api.example.com')
      .post('/usage')
      .reply(500, { error: 'Internal Server Error' })
      .post('/usage')
      .reply(200, { success: true })

    const response = await httpClient.post('/usage', { data: 'test' })

    expect(response.status).toBe(200)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Retrying request',
      expect.objectContaining({
        retryCount: 1,
        status: 500
      })
    )
  })

  it('should retry on 429 error', async () => {
    nock('https://api.example.com')
      .post('/usage')
      .reply(429, { error: 'Too Many Requests' })
      .post('/usage')
      .reply(200, { success: true })

    const response = await httpClient.post('/usage', { data: 'test' })

    expect(response.status).toBe(200)
  })

  it('should mask token in request logs', async () => {
    nock('https://api.example.com')
      .post('/usage')
      .reply(200, { success: true })

    await httpClient.post('/usage', { data: 'test' })

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'HTTP Request',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer ***MASKED***'
        })
      })
    )
  })

  it('should not retry on 400 error', async () => {
    nock('https://api.example.com')
      .post('/usage')
      .reply(400, { error: 'Bad Request' })

    await expect(httpClient.post('/usage', { data: 'test' })).rejects.toThrow()
    expect(mockLogger.warn).not.toHaveBeenCalled()
  })
})
```

## 注意事項
- **nockの使用**: HTTPモックにはnockを使用（axios-retryと互換性あり）
- **トークンマスキング**: ログ出力時に必ずトークンをマスク
- **リトライ条件**: 5xx、429、ネットワークエラーのみリトライ
- **影響範囲**: 新規ファイル作成のみ、既存コードへの影響なし
