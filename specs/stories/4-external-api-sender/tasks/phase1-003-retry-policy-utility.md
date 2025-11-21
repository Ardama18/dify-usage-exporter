---
story_id: 4
title: external-api-sender
epic_id: 1
type: task
feature: external-api-sender
phase: 1
task_number: 003
version: 1.0.0
created: 2025-01-21
based_on: specs/stories/4-external-api-sender/plan.md
---

# タスク: RetryPolicyユーティリティ実装

## メタ情報
- 依存:
  - phase1-002（HttpClient実装） → 成果物: src/sender/http-client.ts
- 提供:
  - src/sender/retry-policy.ts
  - src/sender/__tests__/retry-policy.test.ts
- サイズ: 小規模（1ファイル）
- 確認レベル: L1（単体テスト実行）

## 実装内容
リトライ条件判定関数（isRetryableError, isNonRetryableError, is409Conflict）を実装し、HttpClientと統合する。

## 対象ファイル
- [ ] src/sender/retry-policy.ts（新規作成）
- [ ] src/sender/__tests__/retry-policy.test.ts（新規作成）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [ ] 依存成果物の確認
  - src/sender/http-client.ts
- [ ] 失敗するテストを作成
  - isRetryableError()のテスト（5xx、429、ネットワークエラー）
  - isNonRetryableError()のテスト（400、401、403、404）
  - is409Conflict()のテスト（409レスポンス）
  - エッジケース（レスポンスなし、不明なエラー）
- [ ] テスト実行して失敗を確認
  ```bash
  cd backend && npm run test:unit -- src/sender/__tests__/retry-policy.test.ts
  ```

### 2. Green Phase
- [ ] RetryPolicyユーティリティ実装
  - isRetryableError(): ネットワークエラー、5xx、429を判定
  - isNonRetryableError(): 400、401、403、404を判定
  - is409Conflict(): 409レスポンスを判定
- [ ] 追加したテストのみ実行して通ることを確認

### 3. Refactor Phase
- [ ] コード整理（関数の分離、可読性向上）
- [ ] エラーコードの定数化
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
  cd backend && npm run test:unit -- src/sender/__tests__/retry-policy.test.ts
  ```
- [ ] 成果物作成完了
  - src/sender/retry-policy.ts

## 実装サンプル

### RetryPolicyユーティリティ（src/sender/retry-policy.ts）
```typescript
import { AxiosError } from 'axios'

/**
 * リトライ対象エラーの判定
 * @param error - エラーオブジェクト
 * @returns リトライすべき場合true
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return false

  // ネットワークエラー
  const networkErrorCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET']
  if (error.code && networkErrorCodes.includes(error.code)) {
    return true
  }

  // HTTPエラー
  const status = error.response?.status
  if (!status) return true // レスポンスなし（ネットワーク障害）
  if (status >= 500 && status < 600) return true // 5xx
  if (status === 429) return true // Too Many Requests

  return false
}

/**
 * リトライ非対象エラーの判定
 * @param error - エラーオブジェクト
 * @returns リトライすべきでない場合true
 */
export function isNonRetryableError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return false

  const status = error.response?.status
  if (status === 400) return true // Bad Request - データ不正
  if (status === 401) return true // Unauthorized - 認証失敗
  if (status === 403) return true // Forbidden - 権限不足
  if (status === 404) return true // Not Found - エンドポイント設定ミス

  return false
}

/**
 * 409 Conflictレスポンスの判定
 * @param error - エラーオブジェクト
 * @returns 409レスポンスの場合true
 */
export function is409Conflict(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return false
  return error.response?.status === 409
}
```

### テストサンプル（src/sender/__tests__/retry-policy.test.ts）
```typescript
import { describe, it, expect } from 'vitest'
import { AxiosError } from 'axios'
import { isRetryableError, isNonRetryableError, is409Conflict } from '../retry-policy.js'

describe('RetryPolicy', () => {
  describe('isRetryableError', () => {
    it('should return true for 5xx errors', () => {
      const error = new AxiosError('Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
        status: 500,
        statusText: 'Internal Server Error',
        data: {},
        headers: {},
        config: {} as any
      })
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return true for 429 error', () => {
      const error = new AxiosError('Too Many Requests', 'ERR_BAD_RESPONSE', undefined, undefined, {
        status: 429,
        statusText: 'Too Many Requests',
        data: {},
        headers: {},
        config: {} as any
      })
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return true for network errors', () => {
      const error = new AxiosError('Network Error', 'ECONNREFUSED')
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return false for 400 error', () => {
      const error = new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        data: {},
        headers: {},
        config: {} as any
      })
      expect(isRetryableError(error)).toBe(false)
    })
  })

  describe('isNonRetryableError', () => {
    it('should return true for 400 error', () => {
      const error = new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        data: {},
        headers: {},
        config: {} as any
      })
      expect(isNonRetryableError(error)).toBe(true)
    })

    it('should return true for 401 error', () => {
      const error = new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 401,
        statusText: 'Unauthorized',
        data: {},
        headers: {},
        config: {} as any
      })
      expect(isNonRetryableError(error)).toBe(true)
    })

    it('should return false for 500 error', () => {
      const error = new AxiosError('Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
        status: 500,
        statusText: 'Internal Server Error',
        data: {},
        headers: {},
        config: {} as any
      })
      expect(isNonRetryableError(error)).toBe(false)
    })
  })

  describe('is409Conflict', () => {
    it('should return true for 409 error', () => {
      const error = new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 409,
        statusText: 'Conflict',
        data: {},
        headers: {},
        config: {} as any
      })
      expect(is409Conflict(error)).toBe(true)
    })

    it('should return false for other errors', () => {
      const error = new AxiosError('Not Found', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 404,
        statusText: 'Not Found',
        data: {},
        headers: {},
        config: {} as any
      })
      expect(is409Conflict(error)).toBe(false)
    })
  })
})
```

## 注意事項
- **型安全性**: AxiosErrorの型ガードを必ず使用
- **テストカバレッジ**: 全エラーコードパターンをカバー
- **HttpClientとの統合**: Phase 3でExternalApiSenderから利用
- **影響範囲**: 新規ファイル作成のみ、既存コードへの影響なし
