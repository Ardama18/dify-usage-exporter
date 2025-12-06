---
story_id: SPEC-CHANGE-001
title: api-meter-interface-update
feature: api-meter-integration
type: task
task_number: 006
phase: 3
version: 1.0.0
created: 2025-12-05
based_on: specs/stories/SPEC-CHANGE-001-api-meter-interface-update/plan.md
---

# タスク: HTTPクライアントの更新

メタ情報:
- 依存: task-api-meter-interface-update-phase2-002 → 成果物: src/transformer/idempotency-key.ts
- 提供: src/sender/http-client.ts（更新）
- サイズ: 小規模（2ファイル: 実装 + テスト更新）

## 実装内容

HTTPクライアントをBearer Token認証とAPI_Meter新仕様のリトライ条件に対応させます。

### 実装するもの
1. Bearer Token認証への対応（Authorization: Bearer {token}）
2. エンドポイントURLの変更（config.API_METER_URLを使用）
3. User-Agentヘッダーの設定（dify-usage-exporter/1.1.0）
4. リトライ条件の更新
   - 200, 201, 204: 成功（リトライしない）
   - 429: リトライ（指数バックオフ）
   - 5xx: リトライ（指数バックオフ）
   - 400, 401, 403, 404, 422: リトライしない
   - ネットワークエラー: リトライ
5. Retry-Afterヘッダーの尊重

## 対象ファイル

- [x] src/sender/http-client.ts（更新）
- [x] src/sender/__tests__/http-client.test.ts（更新）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [x] 依存成果物の確認: `src/transformer/idempotency-key.ts` が存在
- [x] `src/sender/__tests__/http-client.test.ts` を更新
- [x] 失敗するテストを追加:
  - Bearer Token認証のテスト（Authorizationヘッダー）
  - リトライ条件のテスト（429, 5xx系でリトライ）
  - リトライしない条件のテスト（400, 401, 403, 404, 422）
  - Retry-Afterヘッダーの尊重テスト
  - 成功ステータス（200, 201, 204）のテスト
  - User-Agentヘッダーのテスト
- [x] テスト実行して失敗を確認: `npm test src/sender/http-client.test.ts`

### 2. Green Phase

#### 2-1. HTTPクライアントの更新
```typescript
// src/sender/http-client.ts
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { loadEnv } from '../types/env'

export interface HttpClientConfig {
  maxRetries: number
  retryDelay: number
}

export class HttpClient {
  private client: AxiosInstance
  private config: HttpClientConfig

  constructor(config?: Partial<HttpClientConfig>) {
    const env = loadEnv()

    this.config = {
      maxRetries: config?.maxRetries ?? 3,
      retryDelay: config?.retryDelay ?? 1000,
    }

    this.client = axios.create({
      baseURL: env.API_METER_URL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.API_METER_TOKEN}`,
        'User-Agent': 'dify-usage-exporter/1.1.0',
      },
      timeout: 30000,
    })
  }

  async post<T>(url: string, data: unknown): Promise<T> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.client.post<T>(url, data)

        // 成功ステータス: 200, 201, 204
        if ([200, 201, 204].includes(response.status)) {
          return response.data
        }
      } catch (error) {
        if (!axios.isAxiosError(error)) {
          throw error
        }

        const status = error.response?.status

        // リトライしないステータス: 400, 401, 403, 404, 422
        if (status && [400, 401, 403, 404, 422].includes(status)) {
          throw new Error(
            `HTTP ${status}: ${error.response?.data?.message || error.message}`
          )
        }

        // リトライ対象: 429, 5xx, ネットワークエラー
        const shouldRetry =
          status === 429 || (status && status >= 500) || !error.response

        if (!shouldRetry || attempt === this.config.maxRetries) {
          throw error
        }

        // Retry-Afterヘッダーの確認
        const retryAfter = error.response?.headers['retry-after']
        const delay = retryAfter
          ? Number.parseInt(retryAfter, 10) * 1000
          : this.config.retryDelay * 2 ** attempt // 指数バックオフ

        console.log(
          `Retrying after ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries})`
        )
        await this.sleep(delay)

        lastError = error
      }
    }

    throw lastError || new Error('Max retries reached')
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
```

- [x] 追加したテストのみ実行して通ることを確認: `npm test src/sender/http-client.test.ts`

### 3. Refactor Phase
- [x] エラーハンドリングの改善
- [x] ログ出力の充実化
- [x] 追加したテストが引き続き通ることを確認

## 完了条件

- [x] 追加したテストが全てパス
- [x] TypeScript strict mode: エラー0件
  ```bash
  npm run build
  ```
- [x] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [x] 動作確認完了（L1: ユニットテスト実行）
  ```bash
  npm test src/sender/http-client.test.ts
  ```
- [x] 成果物作成完了: `src/sender/http-client.ts`（更新）

## テストケース

### 正常系
- [x] Bearer Token認証でリクエストが送信される
- [x] 200 OKで成功
- [x] 201 Createdで成功
- [x] 204 No Contentで成功
- [x] User-Agentヘッダーが設定される

### リトライ動作
- [x] 429 Too Many Requests → リトライ成功
- [x] 500 Internal Server Error → リトライ成功
- [x] 503 Service Unavailable → リトライ成功
- [x] ネットワークエラー → リトライ成功
- [x] Retry-Afterヘッダーがある場合に尊重される

### リトライしないケース
- [x] 400 Bad Request → 即座にエラー
- [x] 401 Unauthorized → 即座にエラー
- [x] 403 Forbidden → 即座にエラー
- [x] 404 Not Found → 即座にエラー
- [x] 422 Unprocessable Entity → 即座にエラー

### リトライ上限
- [x] 最大リトライ回数に達したら例外を投げる

## 注意事項

- **影響範囲**:
  - `src/sender/http-client.ts` の改修
  - Bearer Token認証への完全移行
- **制約**:
  - axiosライブラリを使用
  - 指数バックオフでリトライ（1s → 2s → 4s）
- **重要な変更点**:
  - X-API-Key認証 → Bearer Token認証
  - リトライ条件の明確化（ADR 017準拠）
- **セキュリティ考慮**:
  - Bearer Tokenは環境変数から取得
  - ログにトークンを出力しない
- **次タスクへの引き継ぎ**:
  - Task 3-2 で `HttpClient` を使用して `ApiMeterRequest` を送信

## 参考資料

- [Design Document](../design.md) - 第7章「送信層の改修」
- [ADR 017: エラーハンドリング戦略](../../adr/017-error-handling-strategy.md)
- [API_Meter Authentication Guide](https://api-meter.example.com/docs/auth)
