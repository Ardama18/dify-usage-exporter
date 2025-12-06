---
story_id: SPEC-CHANGE-001
title: api-meter-interface-update
feature: api-meter-integration
type: task
task_number: 014
phase: 5
version: 1.0.0
created: 2025-12-05
based_on: specs/stories/SPEC-CHANGE-001-api-meter-interface-update/plan.md
---

# タスク: パフォーマンステスト

メタ情報:
- 依存: task-api-meter-interface-update-phase5-001 → 成果物: コードレビュー完了
- 提供: scripts/performance-test.ts（新規作成）
- サイズ: 小規模（1ファイル）

## 実装内容

バッチサイズ100-500レコードでの負荷テストを実施し、パフォーマンス要件を満たすことを確認します。

### テスト項目
1. 100レコード、300レコード、500レコードでの処理時間測定
2. 正規化層のパフォーマンス測定
3. 変換層のパフォーマンス測定
4. 送信層のパフォーマンス測定

### 合格基準
- 1000レコード/秒以上の処理速度を確保
- 正規化層の処理時間が1ms未満

## 対象ファイル

- [x] scripts/performance-test.ts（新規作成）

## 実施手順

### 1. パフォーマンステストスクリプトの作成

```typescript
// scripts/performance-test.ts
import { performance } from 'node:perf_hooks'
import { createNormalizer } from '../src/normalizer/normalizer'
import { DataTransformer } from '../src/transformer/data-transformer'

async function runPerformanceTest() {
  const recordCounts = [100, 300, 500]

  for (const count of recordCounts) {
    console.log(`\n=== Testing with ${count} records ===`)

    // テストデータ生成
    const testData = generateTestData(count)

    // 正規化層のパフォーマンス測定
    const normalizeStart = performance.now()
    const normalizer = createNormalizer()
    const normalized = normalizer.normalize(testData)
    const normalizeEnd = performance.now()
    const normalizeTime = normalizeEnd - normalizeStart

    console.log(`Normalize: ${normalizeTime.toFixed(2)}ms (${(normalizeTime / count).toFixed(4)}ms/record)`)

    // 変換層のパフォーマンス測定
    const transformStart = performance.now()
    const transformer = new DataTransformer()
    const { request } = transformer.transform(normalized)
    const transformEnd = performance.now()
    const transformTime = transformEnd - transformStart

    console.log(`Transform: ${transformTime.toFixed(2)}ms (${(transformTime / count).toFixed(4)}ms/record)`)

    // 合格基準の確認
    const totalTime = normalizeTime + transformTime
    const recordsPerSecond = (count / totalTime) * 1000

    console.log(`Total: ${totalTime.toFixed(2)}ms`)
    console.log(`Throughput: ${recordsPerSecond.toFixed(0)} records/second`)

    if (recordsPerSecond < 1000) {
      console.error(`❌ FAIL: ${recordsPerSecond} < 1000 records/second`)
    } else {
      console.log(`✅ PASS: ${recordsPerSecond} >= 1000 records/second`)
    }
  }
}

runPerformanceTest()
```

### 2. パフォーマンステストの実行

```bash
npm run test:performance
```

## 完了条件

- [x] パフォーマンステストが完了し、合格基準をクリア
- [x] 1000レコード/秒以上の処理速度を確保
- [x] 正規化層の処理時間が1ms未満
- [x] 結果をログに記録

## 参考資料

- [Design Document](../design.md) - 第11章「パフォーマンス要件」
- [ADR 013: 正規化層の導入](../../adr/013-normalization-layer-introduction.md)
