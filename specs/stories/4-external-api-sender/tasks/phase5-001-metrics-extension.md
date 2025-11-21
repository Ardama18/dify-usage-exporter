---
story_id: 4
title: external-api-sender
epic_id: 1
type: task
feature: external-api-sender
phase: 5
task_number: 001
version: 1.0.0
created: 2025-01-21
based_on: specs/stories/4-external-api-sender/plan.md
---

# タスク: ExecutionMetrics型拡張

## メタ情報
- 依存: phase3-001（ExternalApiSender実装）
- 提供: src/types/metrics.ts（拡張）
- サイズ: 小規模（既存ファイル拡張）
- 確認レベル: L1（単体テスト実行）

## 実装内容
ExecutionMetrics型拡張（sendSuccess, sendFailed, spoolSaved, spoolResendSuccess, failedMoved）、ExternalApiSenderにメトリクス記録機能追加。

## 対象ファイル
- [x] src/types/metrics.ts（拡張）
- [x] src/sender/external-api-sender.ts（拡張）

## 実装手順（TDD: Red-Green-Refactor）
### 1-3. メトリクス型拡張と記録機能追加
- [x] ExecutionMetrics型拡張
- [x] ExternalApiSenderにメトリクス記録機能追加
- [x] 単体テスト作成

## 完了条件
- [x] TypeScriptコンパイルエラーなし
- [x] Story 5でメトリクス集計に使用可能
- [x] 成果物作成完了
