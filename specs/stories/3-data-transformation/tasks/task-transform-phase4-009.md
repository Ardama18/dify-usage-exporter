---
story_id: "3"
title: data-transformation
epic_id: "1"
type: task
feature: transform
task_number: 009
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/3-data-transformation/plan.md
---

# タスク: パフォーマンステスト

メタ情報:
- 依存: task-transform-phase3-008 -> 成果物: test/integration/data-transformation.int.test.ts
- 提供: パフォーマンステスト（統合テストに追加）
- サイズ: 小規模（1ファイル更新）

## 実装内容

10,000レコードを5秒以内に変換できることを検証するパフォーマンステストを作成。

### AC対応
- AC6（パフォーマンス）

## 対象ファイル

- [ ] test/integration/data-transformation.int.test.ts（追加）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase

- [ ] task-008の成果物（統合テスト）が存在することを確認
- [ ] 統合テストファイルにパフォーマンステストセクションを追加:
  - 10,000レコード生成
  - 変換実行・時間計測
  - 5秒以内の完了確認
- [ ] テスト実行して確認

### 2. Green Phase

- [ ] パフォーマンステストを実装
- [ ] テスト実行して通ることを確認
  ```bash
  npm run test:integration -- test/integration/data-transformation.int.test.ts
  ```

### 3. Refactor Phase

- [ ] 必要に応じてテスト改善
- [ ] テストが引き続き通ることを確認

## テストケース詳細

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createDataTransformer, type TransformerDeps } from '../../src/transformer/data-transformer.js'
import type { DifyUsageRecord } from '../../src/types/dify-usage.js'

describe('AC6: パフォーマンス', () => {
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

  it('AC6-1: should transform 10,000 records within 5 seconds', () => {
    // テストデータ生成
    const records: DifyUsageRecord[] = Array.from({ length: 10000 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
      app_id: `app-${i}`,
      app_name: `Test App ${i}`,
      provider: i % 2 === 0 ? 'openai' : 'anthropic',
      model: i % 2 === 0 ? 'gpt-4' : 'claude-3',
      input_tokens: Math.floor(Math.random() * 1000),
      output_tokens: Math.floor(Math.random() * 2000),
      total_tokens: Math.floor(Math.random() * 3000),
      user_id: `user-${i % 100}`,
    }))

    // 変換実行・時間計測
    const start = Date.now()
    const result = transformer.transform(records)
    const duration = Date.now() - start

    // 検証
    expect(duration).toBeLessThan(5000)
    expect(result.successCount).toBe(10000)
    expect(result.errorCount).toBe(0)
    expect(result.records).toHaveLength(10000)
    expect(result.batchIdempotencyKey).toMatch(/^[a-f0-9]{64}$/)

    console.log(`Performance: 10,000 records transformed in ${duration}ms`)
  })

  it('should handle 1,000 records efficiently', () => {
    const records: DifyUsageRecord[] = Array.from({ length: 1000 }, (_, i) => ({
      date: '2025-01-01',
      app_id: `app-${i}`,
      provider: 'openai',
      model: 'gpt-4',
      input_tokens: 100,
      output_tokens: 200,
      total_tokens: 300,
    }))

    const start = Date.now()
    const result = transformer.transform(records)
    const duration = Date.now() - start

    expect(duration).toBeLessThan(500)  // 1,000件は500ms以内
    expect(result.successCount).toBe(1000)

    console.log(`Performance: 1,000 records transformed in ${duration}ms`)
  })

  it('should maintain consistent performance across multiple runs', () => {
    const records: DifyUsageRecord[] = Array.from({ length: 5000 }, (_, i) => ({
      date: '2025-01-01',
      app_id: `app-${i}`,
      provider: 'openai',
      model: 'gpt-4',
      input_tokens: 100,
      output_tokens: 200,
      total_tokens: 300,
    }))

    const durations: number[] = []

    for (let run = 0; run < 3; run++) {
      const start = Date.now()
      transformer.transform(records)
      durations.push(Date.now() - start)
    }

    // 各実行が2.5秒以内（半分の件数なので）
    for (const duration of durations) {
      expect(duration).toBeLessThan(2500)
    }

    // 実行間の差が大きくないことを確認（メモリリーク等の検出）
    const maxDuration = Math.max(...durations)
    const minDuration = Math.min(...durations)
    expect(maxDuration - minDuration).toBeLessThan(1000)

    console.log(`Performance consistency: ${durations.join('ms, ')}ms`)
  })
})
```

## 完了条件

- [ ] パフォーマンステストが全てパス
- [ ] 10,000レコードを5秒以内に変換
- [ ] TypeScript strict mode: エラー0件
  ```bash
  npx tsc --noEmit
  ```
- [ ] Biome lint: エラー0件
  ```bash
  npm run check
  ```
- [ ] 動作確認完了（L2: 統合テスト実行）
  ```bash
  npm run test:integration -- test/integration/data-transformation.int.test.ts
  ```

## 注意事項

- 影響範囲: 既存の統合テストファイルに追加
- 制約: 5秒の制限時間は環境によって調整が必要な場合がある
- CI環境では余裕を持った制限時間に設定することを検討
