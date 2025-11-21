---
story_id: 4
title: external-api-sender
epic_id: 1
type: task
feature: external-api-sender
phase: 3
task_number: 002
version: 1.0.0
created: 2025-01-21
based_on: specs/stories/4-external-api-sender/plan.md
---

# タスク: 統合テスト作成（E2Eフロー）

## メタ情報
- 依存: phase3-001（ExternalApiSender実装）
- 提供: src/sender/__tests__/integration/sender-e2e.int.test.ts
- サイズ: 中規模（統合テスト）
- 確認レベル: L3（E2Eシナリオテスト）

## 実装内容
統合テスト作成（Happy Path、Exception Pattern 1-3、スプール再送フロー）。

## 対象ファイル
- [ ] src/sender/__tests__/integration/sender-e2e.int.test.ts（新規作成）

## 実装手順（TDD: Red-Green-Refactor）
### 1-3. テストパターン実装
- [ ] Happy Path: 送信成功
- [ ] Exception Pattern 1: ネットワークエラー → リトライ → 成功
- [ ] Exception Pattern 2: リトライ上限 → スプール保存
- [ ] Exception Pattern 3: 409 Conflict → 成功扱い
- [ ] スプール再送フロー: スプール保存 → 再送成功

## 完了条件
- [ ] 全統合テストがパス
- [ ] E2Eフロー全体が正しく動作
- [ ] 成果物作成完了: src/sender/__tests__/integration/sender-e2e.int.test.ts
