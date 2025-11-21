---
story_id: 4
title: external-api-sender
epic_id: 1
type: task
feature: external-api-sender
phase: 3
task_number: 001
version: 1.0.0
created: 2025-01-21
based_on: specs/stories/4-external-api-sender/plan.md
---

# タスク: ExternalApiSenderクラス実装

## メタ情報
- 依存:
  - phase1-002（HttpClient） → 成果物: src/sender/http-client.ts
  - phase1-003（RetryPolicy） → 成果物: src/sender/retry-policy.ts
  - phase2-002（SpoolManager） → 成果物: src/sender/spool-manager.ts
- 提供:
  - src/sender/external-api-sender.ts
  - src/sender/__tests__/external-api-sender.test.ts
- サイズ: 中規模（1ファイル、複雑なロジック）
- 確認レベル: L3（E2Eシナリオテスト）

## 実装内容
ExternalApiSenderクラス実装（send, resendSpooled, handleSendError, calculateBatchKey, isMaxRetriesError）。

## 対象ファイル
- [x] src/sender/external-api-sender.ts（新規作成）
- [x] src/sender/__tests__/external-api-sender.test.ts（新規作成）

## 実装手順（TDD: Red-Green-Refactor）
### 1. Red Phase
- [x] 依存成果物の確認
- [x] 失敗するテストを作成（送信成功、409 Conflict、リトライ上限→スプール保存、リトライ成功）
- [x] テスト実行して失敗を確認

### 2. Green Phase
- [x] ExternalApiSenderクラス実装
- [x] 追加したテストのみ実行して通ることを確認

### 3. Refactor Phase
- [x] コード整理、追加したテストが引き続き通ることを確認

## 完了条件
- [x] 追加したテストが全てパス
- [x] TypeScript strict mode: エラー0件
- [x] Biome lint: エラー0件
- [x] 動作確認完了（L3: E2Eシナリオテスト）
- [x] 成果物作成完了: src/sender/external-api-sender.ts

## 注意事項
- Design Docのデータフローに完全準拠
- 冪等キー生成はSHA256を使用
