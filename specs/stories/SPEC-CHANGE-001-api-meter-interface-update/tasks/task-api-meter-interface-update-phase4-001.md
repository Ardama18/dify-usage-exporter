---
story_id: SPEC-CHANGE-001
title: api-meter-interface-update
feature: api-meter-integration
type: task
task_number: 009
phase: 4
version: 1.0.0
created: 2025-12-05
based_on: specs/stories/SPEC-CHANGE-001-api-meter-interface-update/plan.md
---

# タスク: データフロー全体の統合

メタ情報:
- 依存: task-api-meter-interface-update-phase3-003 → 成果物: src/sender/spool-manager.ts
- 提供: src/index.ts（更新）
- サイズ: 小規模（1ファイル）

## 実装内容

データフロー全体にNormalizer層を統合し、per_model/allモードでAPI_Meterへデータ送信できるようにします。

### 実装するもの
1. Normalizer層の追加（Aggregate → Normalize → Transform）
2. 日別データのフィルタリング（`period_type === 'daily'`）
3. per_model/allモードの優先実装
4. per_user/per_app/workspaceモード時のスキップログ出力

## 対象ファイル

- [ ] src/index.ts（更新）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [ ] 依存成果物の確認: 全Phase 1-3のファイルが存在
- [ ] データフロー全体の動作確認テストを追加

### 2. Green Phase

```typescript
// src/index.ts の更新
import { createNormalizer } from './normalizer/normalizer'
import { DataTransformer } from './transformer/data-transformer'
import { ExternalApiSender } from './sender/external-api-sender'

async function main() {
  // Fetch → Aggregate
  const aggregatedRecords = await fetchAndAggregate()

  // 日別データのフィルタリング
  const dailyRecords = aggregatedRecords.filter(
    (r) => r.periodType === 'daily'
  )

  // per_model/allモードのみ処理
  if (mode !== 'per_model' && mode !== 'all') {
    console.log(`Skipping ${mode} mode (not supported in API_Meter integration)`)
    return
  }

  // Normalize
  const normalizer = createNormalizer()
  const normalizedRecords = normalizer.normalize(dailyRecords)

  // Transform
  const transformer = new DataTransformer()
  const { request } = transformer.transform(normalizedRecords)

  // Send
  const sender = new ExternalApiSender()
  await sender.send(request)
}
```

### 3. Refactor Phase
- [ ] エラーハンドリングの充実化
- [ ] ログ出力の改善

## 完了条件

- [ ] データフロー全体が正常に動作
- [ ] Normalizer層が正しく統合されている
- [ ] 日別データのフィルタリングが動作
- [ ] per_model/allモードで正しいデータがAPI_Meterへ送信される
- [ ] TypeScript strict mode: エラー0件
- [ ] Biome lint: エラー0件

## 参考資料

- [Design Document](../design.md) - 第9章「統合」
- [ADR 015: データフロー変更](../../adr/015-data-flow-transformation.md)
