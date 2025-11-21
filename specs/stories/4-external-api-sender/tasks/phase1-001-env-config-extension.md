---
story_id: 4
title: external-api-sender
epic_id: 1
type: task
feature: external-api-sender
phase: 1
task_number: 001
version: 1.0.0
created: 2025-01-21
based_on: specs/stories/4-external-api-sender/plan.md
---

# タスク: 環境変数定義と拡張

## メタ情報
- 依存: phase0-001（型定義）
- 提供:
  - src/config/env-config.ts（拡張）
  - src/config/__tests__/env-config.test.ts
- サイズ: 小規模（1ファイル拡張）
- 確認レベル: L1（単体テスト実行）

## 実装内容
env-config.tsを拡張し、EXTERNAL_API_*環境変数を追加。HTTPS必須チェック、必須環境変数バリデーション、単体テストを実装する。

## 対象ファイル
- [ ] src/config/env-config.ts（拡張）
- [ ] src/config/__tests__/env-config.test.ts（拡張）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [ ] 既存env-config.tsの確認
  ```bash
  cat backend/src/config/env-config.ts
  ```
- [ ] 失敗するテストを作成
  - EXTERNAL_API_ENDPOINT必須チェック
  - EXTERNAL_API_TOKEN必須チェック
  - HTTPS必須チェック（http://で開始するURLを拒否）
  - デフォルト値のテスト（EXTERNAL_API_TIMEOUT_MS, MAX_RETRIES等）
- [ ] テスト実行して失敗を確認
  ```bash
  cd backend && npm run test:unit -- src/config/__tests__/env-config.test.ts
  ```

### 2. Green Phase
- [ ] EnvConfig型拡張
  - EXTERNAL_API_ENDPOINT: string
  - EXTERNAL_API_TOKEN: string
  - EXTERNAL_API_TIMEOUT_MS: number
  - MAX_RETRIES: number
  - MAX_SPOOL_RETRIES: number
  - BATCH_SIZE: number
- [ ] loadEnvConfig()拡張
  - 必須環境変数チェック（EXTERNAL_API_ENDPOINT, EXTERNAL_API_TOKEN）
  - HTTPS必須チェック（startsWith('https://')）
  - デフォルト値設定（TIMEOUT: 30000, MAX_RETRIES: 3, MAX_SPOOL_RETRIES: 10, BATCH_SIZE: 100）
- [ ] 追加したテストのみ実行して通ることを確認

### 3. Refactor Phase
- [ ] コード整理（変数名の一貫性、可読性向上）
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
  cd backend && npm run test:unit -- src/config/__tests__/env-config.test.ts
  ```
- [ ] 成果物作成完了
  - src/config/env-config.ts（拡張）

## 実装サンプル

### EnvConfig型拡張（src/config/env-config.ts）
```typescript
export interface EnvConfig {
  // 既存（Story 1, 2, 3）
  DIFY_API_ENDPOINT: string
  DIFY_API_TOKEN: string
  LOG_LEVEL: string
  LOG_FILE_PATH: string

  // Story 4で追加
  EXTERNAL_API_ENDPOINT: string
  EXTERNAL_API_TOKEN: string
  EXTERNAL_API_TIMEOUT_MS: number
  MAX_RETRIES: number
  MAX_SPOOL_RETRIES: number
  BATCH_SIZE: number
}

export function loadEnvConfig(): EnvConfig {
  // 必須環境変数チェック
  const required = [
    'DIFY_API_ENDPOINT',
    'DIFY_API_TOKEN',
    'EXTERNAL_API_ENDPOINT',
    'EXTERNAL_API_TOKEN'
  ]

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  }

  // HTTPS必須チェック
  if (!process.env.EXTERNAL_API_ENDPOINT?.startsWith('https://')) {
    throw new Error('EXTERNAL_API_ENDPOINT must use HTTPS protocol')
  }

  return {
    // 既存設定
    DIFY_API_ENDPOINT: process.env.DIFY_API_ENDPOINT,
    DIFY_API_TOKEN: process.env.DIFY_API_TOKEN,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_FILE_PATH: process.env.LOG_FILE_PATH || 'logs/app.log',

    // Story 4設定
    EXTERNAL_API_ENDPOINT: process.env.EXTERNAL_API_ENDPOINT,
    EXTERNAL_API_TOKEN: process.env.EXTERNAL_API_TOKEN,
    EXTERNAL_API_TIMEOUT_MS: Number(process.env.EXTERNAL_API_TIMEOUT_MS) || 30000,
    MAX_RETRIES: Number(process.env.MAX_RETRIES) || 3,
    MAX_SPOOL_RETRIES: Number(process.env.MAX_SPOOL_RETRIES) || 10,
    BATCH_SIZE: Number(process.env.BATCH_SIZE) || 100
  }
}
```

### テストサンプル（src/config/__tests__/env-config.test.ts）
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadEnvConfig } from '../env-config.js'

describe('loadEnvConfig - Story 4 Extensions', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    // 既存必須環境変数を設定
    process.env.DIFY_API_ENDPOINT = 'https://api.dify.ai'
    process.env.DIFY_API_TOKEN = 'test-token'
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should throw if EXTERNAL_API_ENDPOINT is missing', () => {
    process.env.EXTERNAL_API_TOKEN = 'test-token'
    expect(() => loadEnvConfig()).toThrow('Missing required environment variable: EXTERNAL_API_ENDPOINT')
  })

  it('should throw if EXTERNAL_API_TOKEN is missing', () => {
    process.env.EXTERNAL_API_ENDPOINT = 'https://api.example.com'
    expect(() => loadEnvConfig()).toThrow('Missing required environment variable: EXTERNAL_API_TOKEN')
  })

  it('should throw if EXTERNAL_API_ENDPOINT does not start with https://', () => {
    process.env.EXTERNAL_API_ENDPOINT = 'http://api.example.com'
    process.env.EXTERNAL_API_TOKEN = 'test-token'
    expect(() => loadEnvConfig()).toThrow('EXTERNAL_API_ENDPOINT must use HTTPS protocol')
  })

  it('should load config with default values', () => {
    process.env.EXTERNAL_API_ENDPOINT = 'https://api.example.com'
    process.env.EXTERNAL_API_TOKEN = 'test-token'

    const config = loadEnvConfig()

    expect(config.EXTERNAL_API_ENDPOINT).toBe('https://api.example.com')
    expect(config.EXTERNAL_API_TOKEN).toBe('test-token')
    expect(config.EXTERNAL_API_TIMEOUT_MS).toBe(30000)
    expect(config.MAX_RETRIES).toBe(3)
    expect(config.MAX_SPOOL_RETRIES).toBe(10)
    expect(config.BATCH_SIZE).toBe(100)
  })

  it('should load config with custom values', () => {
    process.env.EXTERNAL_API_ENDPOINT = 'https://api.example.com'
    process.env.EXTERNAL_API_TOKEN = 'test-token'
    process.env.EXTERNAL_API_TIMEOUT_MS = '60000'
    process.env.MAX_RETRIES = '5'
    process.env.MAX_SPOOL_RETRIES = '20'
    process.env.BATCH_SIZE = '200'

    const config = loadEnvConfig()

    expect(config.EXTERNAL_API_TIMEOUT_MS).toBe(60000)
    expect(config.MAX_RETRIES).toBe(5)
    expect(config.MAX_SPOOL_RETRIES).toBe(20)
    expect(config.BATCH_SIZE).toBe(200)
  })
})
```

## 注意事項
- **後方互換性**: 既存のenv-config機能を破壊しない
- **セキュリティ**: HTTPS必須チェックは必ず実装
- **バリデーション**: 環境変数の型変換（Number()）が正しく動作することを確認
- **影響範囲**: env-config.tsの拡張のみ、既存コードへの影響最小限
