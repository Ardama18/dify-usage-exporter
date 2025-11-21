# タスク: 統合テスト実装・実行

---
story_id: 2
title: dify-usage-fetcher
epic_id: 1
type: task
task_number: 008
version: 1.0.0
created: 2025-11-21
based_on: specs/stories/2-dify-usage-fetcher/plan.md
---

メタ情報:
- 依存: task-007 → 成果物: src/fetcher/dify-usage-fetcher.ts（Phase 4完了）
- 提供: test/integration/dify-usage-fetcher.int.test.ts（完全版）
- サイズ: 中規模（テストファイル完成）

## 実装内容

全ての統合テスト（59件）の実装を完了し、実行確認を行う。これまでの各タスクで部分的に実装した統合テストを統合し、不足分を補完する。

## 対象ファイル
- [ ] `test/integration/dify-usage-fetcher.int.test.ts` - 統合テスト完全版

## 実装手順

### 1. 既存テストの確認
- [ ] Task 005で実装したFR-4テストを確認
- [ ] Task 006で実装したFR-1, FR-2, FR-5テストを確認
- [ ] Task 007で実装したFR-3, FR-6, NFテストを確認

### 2. テスト構造の整理
- [ ] `test/integration/dify-usage-fetcher.int.test.ts` のテスト構造を確認
  ```typescript
  describe('DifyUsageFetcher 統合テスト', () => {
    describe('FR-1: Dify API認証', () => {
      // 5件（3件 + 2エッジケース）
    })
    describe('FR-2: 使用量データ取得API呼び出し', () => {
      // 7件（4件 + 3エッジケース）
    })
    describe('FR-3: ページング処理', () => {
      // 8件（4件 + 4エッジケース）
    })
    describe('FR-4: ウォーターマーク管理', () => {
      // 11件（6件 + 5エッジケース）
    })
    describe('FR-5: エラーハンドリング', () => {
      // 11件（5件 + 6エッジケース）
    })
    describe('FR-6: データバリデーション', () => {
      // 8件（4件 + 4エッジケース）
    })
    describe('非機能要件', () => {
      // 4件
    })
    describe('コンポーネント連携', () => {
      // 5件
    })
  })
  ```

### 3. 不足テストの補完
- [ ] 各FRのテストケースが計画通りか確認
- [ ] エッジケースのテストが実装されているか確認
- [ ] 非機能要件のテストを実装
  - パフォーマンステスト（10,000件/30秒）
  - メモリ使用量テスト（100MB以内）
  - 重複取得率テスト（0%）
  - セキュリティテスト（トークン非出力）
- [ ] コンポーネント連携テストを実装

### 4. テスト実行・検証
- [ ] 全統合テスト実行
  ```bash
  npm test -- test/integration/dify-usage-fetcher.int.test.ts
  ```
- [ ] テスト件数が59件であることを確認
- [ ] 全テストがパスすることを確認
- [ ] カバレッジ確認

## 完了条件
- [ ] 全59件の統合テストがパス
  ```bash
  npm test -- test/integration/dify-usage-fetcher.int.test.ts
  ```
- [ ] テストカバレッジ70%以上
  ```bash
  npm run test:coverage:fresh
  ```
- [ ] TypeScript strict mode: エラー0件
- [ ] Biome lint: エラー0件

## テスト件数内訳

| カテゴリ | テスト件数 |
|---------|-----------|
| FR-1: Dify API認証 | 5件 |
| FR-2: API呼び出し | 7件 |
| FR-3: ページング | 8件 |
| FR-4: ウォーターマーク | 11件 |
| FR-5: エラーハンドリング | 11件 |
| FR-6: バリデーション | 8件 |
| 非機能要件 | 4件 |
| コンポーネント連携 | 5件 |
| **合計** | **59件** |

## 関連する受入条件（AC）
- 全AC（AC-1-1 〜 AC-NF-4）を網羅

## 依存タスク
- task-007: DifyUsageFetcher実装（Phase 4完了が前提）

## 注意事項
- 影響範囲: 品質保証の基盤
- 制約: モックサーバーまたはテストダブルを使用して外部依存を分離
- テスト実行時間: 全体で3分以内を目標
- パフォーマンステストは実際の10,000件ではなく、サンプルデータで比例計算
