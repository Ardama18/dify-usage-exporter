---
story_id: SPEC-CHANGE-001
title: api-meter-interface-update
feature: api-meter-integration
type: task
task_number: 010
phase: 4
version: 1.0.0
created: 2025-12-05
based_on: specs/stories/SPEC-CHANGE-001-api-meter-interface-update/plan.md
---

# タスク: 統合テストの実施

メタ情報:
- 依存: task-api-meter-interface-update-phase4-001 → 成果物: src/index.ts
- 提供: test/integration/api-meter-integration.int.test.ts（新規作成）
- サイズ: 中規模（1ファイル）

## 実装内容

データフロー全体（Fetch → Aggregate → Normalize → Transform → Send）の統合テストを実施します。

### テスト項目
1. per_modelモードのE2Eテスト
2. allモードのE2Eテスト
3. エラーハンドリングの統合テスト（リトライ、スプール保存）
4. 旧形式スプールファイル変換の統合テスト

## 対象ファイル

- [ ] test/integration/api-meter-integration.int.test.ts（新規作成）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase
- [ ] モックAPIサーバーの準備
- [ ] 統合テストファイル作成
- [ ] テスト実行して失敗を確認

### 2. Green Phase

```typescript
// test/integration/api-meter-integration.int.test.ts
import { describe, it, expect, beforeEach } from 'vitest'

describe('API_Meter Integration', () => {
  it('should send data in per_model mode', async () => {
    // Fetch → Aggregate → Normalize → Transform → Send
    // モックAPIサーバーで200 OKを返す
  })

  it('should send data in all mode', async () => {
    // 全体フローのテスト
  })

  it('should retry on 429 error', async () => {
    // リトライロジックのテスト
  })

  it('should convert legacy spool files', async () => {
    // 旧形式スプールファイル変換のテスト
  })
})
```

### 3. Refactor Phase
- [ ] テストの可読性向上

## 完了条件

- [ ] 統合テストが全てパス
- [ ] per_model/allモードでのデータフローが正常動作
- [ ] エラーハンドリングが正しく動作（リトライ、スプール保存）
- [ ] L3（E2Eテスト）レベルの確認完了

## 参考資料

- [Design Document](../design.md) - 第10章「テスト戦略」
