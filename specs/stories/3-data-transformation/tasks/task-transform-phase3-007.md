---
story_id: "3"
title: data-transformation
epic_id: "1"
type: task
feature: transform
task_number: 007
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/3-data-transformation/plan.md
---

# タスク: DataTransformer実装と単体テスト作成

メタ情報:
- 依存: task-transform-phase3-006 -> 成果物: src/transformer/data-transformer.ts（正規化部分）
- 提供: src/transformer/data-transformer.ts（変換部分追加）
- サイズ: 中規模（2ファイル更新）

## 実装内容

ITransformerインターフェースを実装するDataTransformerを関数ファクトリパターンで作成。変換処理、エラー収集、バッチ冪等キー生成を統合。

### AC対応
- AC1（形式変換）
- AC2（レコード冪等キー）
- AC3（バッチ冪等キー）
- AC4（zodバリデーション）
- AC5（エラーハンドリング）

## 対象ファイル

- [x] src/transformer/data-transformer.ts（追加）
- [x] test/unit/transformer/data-transformer.test.ts（追加）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase

- [x] task-006の成果物（正規化関数）が存在することを確認
- [x] 既存のテストファイルに変換部分のテストケースを追加:
  - 単一レコードの正常変換
  - transformed_at付与確認
  - 冪等キー生成確認
  - バリデーションエラーのエラー配列記録
  - successCount + errorCount = 入力数の保証
  - 例外スローなしの確認
- [x] テスト実行して失敗を確認
  ```bash
  npm run test:unit -- test/unit/transformer/data-transformer.test.ts
  ```

### 2. Green Phase

- [x] `src/transformer/data-transformer.ts` にTransformerDeps、createDataTransformerを追加:
  ```typescript
  import type { Logger } from '../logger/winston-logger.js'
  import type { DifyUsageRecord } from '../types/dify-usage.js'
  import type { ExternalApiRecord } from '../types/external-api.js'
  import { externalApiRecordSchema } from '../types/external-api.js'
  import type { ITransformer, TransformResult, TransformError } from '../interfaces/transformer.js'
  import { generateRecordIdempotencyKey, generateBatchIdempotencyKey } from './idempotency-key.js'
  import { getCurrentISOTimestamp } from '../utils/date-utils.js'

  export interface TransformerDeps {
    logger: Logger
  }

  export function createDataTransformer(deps: TransformerDeps): ITransformer {
    return {
      transform(records: DifyUsageRecord[]): TransformResult {
        const transformedAt = getCurrentISOTimestamp()
        const errors: TransformError[] = []
        const successRecords: ExternalApiRecord[] = []
        const recordKeys: string[] = []

        for (const record of records) {
          try {
            const normalizedProvider = normalizeProvider(record.provider)
            const normalizedModel = normalizeModel(record.model)

            const idempotencyKey = generateRecordIdempotencyKey({
              date: record.date,
              app_id: record.app_id,
              provider: normalizedProvider,
              model: normalizedModel,
            })

            const transformed = {
              date: record.date,
              app_id: record.app_id,
              provider: normalizedProvider,
              model: normalizedModel,
              input_tokens: record.input_tokens,
              output_tokens: record.output_tokens,
              total_tokens: record.total_tokens,
              idempotency_key: idempotencyKey,
              app_name: record.app_name,
              user_id: record.user_id,
              transformed_at: transformedAt,
            }

            const validation = externalApiRecordSchema.safeParse(transformed)

            if (validation.success) {
              successRecords.push(validation.data)
              recordKeys.push(idempotencyKey)
            } else {
              errors.push({
                recordIdentifier: { date: record.date, app_id: record.app_id },
                message: '出力バリデーションエラー',
                details: { errors: validation.error.errors },
              })
            }
          } catch (error) {
            errors.push({
              recordIdentifier: { date: record.date, app_id: record.app_id },
              message: '変換処理エラー',
              details: { error: String(error) },
            })
          }
        }

        const batchIdempotencyKey = generateBatchIdempotencyKey(recordKeys)

        deps.logger.info('Transform completed', {
          successCount: successRecords.length,
          errorCount: errors.length,
          batchIdempotencyKey,
        })

        return {
          records: successRecords,
          batchIdempotencyKey,
          successCount: successRecords.length,
          errorCount: errors.length,
          errors,
        }
      },
    }
  }
  ```
- [x] テスト実行して通ることを確認
  ```bash
  npm run test:unit -- test/unit/transformer/data-transformer.test.ts
  ```

### 3. Refactor Phase

- [x] 必要に応じてコード改善
- [x] テストが引き続き通ることを確認

## テストケース詳細

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createDataTransformer,
  type TransformerDeps,
} from '../../../src/transformer/data-transformer.js'
import type { DifyUsageRecord } from '../../../src/types/dify-usage.js'

describe('createDataTransformer', () => {
  let mockLogger: TransformerDeps['logger']
  let transformer: ReturnType<typeof createDataTransformer>

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as unknown as TransformerDeps['logger']

    transformer = createDataTransformer({ logger: mockLogger })
  })

  describe('正常系', () => {
    it('should transform a single record correctly', () => {
      const record: DifyUsageRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        app_name: 'Test App',
        provider: 'OpenAI',
        model: 'GPT-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
        user_id: 'user-456',
      }

      const result = transformer.transform([record])

      expect(result.successCount).toBe(1)
      expect(result.errorCount).toBe(0)
      expect(result.records).toHaveLength(1)
      expect(result.records[0].provider).toBe('openai')
      expect(result.records[0].model).toBe('gpt-4')
    })

    it('should add transformed_at to each record', () => {
      const record: DifyUsageRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
      }

      const result = transformer.transform([record])

      expect(result.records[0].transformed_at).toBeDefined()
      expect(result.records[0].transformed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should generate idempotency_key for each record', () => {
      const record: DifyUsageRecord = {
        date: '2025-01-01',
        app_id: 'app-123',
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
      }

      const result = transformer.transform([record])

      expect(result.records[0].idempotency_key).toBe('2025-01-01_app-123_openai_gpt-4')
    })

    it('should generate batchIdempotencyKey', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
        {
          date: '2025-01-01',
          app_id: 'app-456',
          provider: 'anthropic',
          model: 'claude-3',
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
        },
      ]

      const result = transformer.transform(records)

      expect(result.batchIdempotencyKey).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should return empty string for batchIdempotencyKey when no records', () => {
      const result = transformer.transform([])

      expect(result.batchIdempotencyKey).toBe('')
      expect(result.successCount).toBe(0)
      expect(result.errorCount).toBe(0)
    })
  })

  describe('エラーハンドリング', () => {
    it('should record validation errors in errors array', () => {
      const record: DifyUsageRecord = {
        date: '2025-01-01',
        app_id: '',  // 空文字列でバリデーションエラー
        provider: 'openai',
        model: 'gpt-4',
        input_tokens: 100,
        output_tokens: 200,
        total_tokens: 300,
      }

      const result = transformer.transform([record])

      expect(result.errorCount).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toBe('出力バリデーションエラー')
    })

    it('should guarantee successCount + errorCount = input count', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
        {
          date: '2025-01-01',
          app_id: '',  // エラー
          provider: 'anthropic',
          model: 'claude-3',
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
        },
      ]

      const result = transformer.transform(records)

      expect(result.successCount + result.errorCount).toBe(records.length)
    })

    it('should not throw exceptions', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: '',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: -1,  // 複数エラー
          output_tokens: 200,
          total_tokens: 300,
        },
      ]

      expect(() => transformer.transform(records)).not.toThrow()
    })

    it('should only return successful records', () => {
      const records: DifyUsageRecord[] = [
        {
          date: '2025-01-01',
          app_id: 'app-123',
          provider: 'openai',
          model: 'gpt-4',
          input_tokens: 100,
          output_tokens: 200,
          total_tokens: 300,
        },
        {
          date: '2025-01-01',
          app_id: '',  // エラー
          provider: 'anthropic',
          model: 'claude-3',
          input_tokens: 50,
          output_tokens: 100,
          total_tokens: 150,
        },
      ]

      const result = transformer.transform(records)

      expect(result.records).toHaveLength(1)
      expect(result.records[0].app_id).toBe('app-123')
    })
  })
})
```

## 完了条件

- [x] 追加したテストが全てパス
- [x] TypeScript strict mode: エラー0件
  ```bash
  npx tsc --noEmit
  ```
- [x] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [x] 動作確認完了（L2: 単体テスト実行）
  ```bash
  npm run test:unit -- test/unit/transformer/data-transformer.test.ts
  ```

## 注意事項

- 影響範囲: 既存のdata-transformer.tsに追加するが、正規化関数への影響なし
- 制約: 例外をスローせず、全てのエラーをTransformResult.errorsに格納
- IFetcherと同様の関数ファクトリパターンを使用
- Loggerは依存性注入で受け取る
