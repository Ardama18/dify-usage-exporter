---
story_id: 4
title: external-api-sender
epic_id: 1
type: task
feature: external-api-sender
phase: 4
task_number: 001
version: 1.0.0
created: 2025-01-21
based_on: specs/stories/4-external-api-sender/plan.md
---

# タスク: INotifierインターフェース定義とモック実装

## メタ情報
- 依存: なし
- 提供:
  - src/interfaces/notifier.ts
  - src/notifier/console-notifier.ts
- サイズ: 小規模（2ファイル）
- 確認レベル: L1（単体テスト実行）

## 実装内容
INotifierインターフェース定義、ConsoleNotifier実装（モック、ログ出力のみ）。

## 対象ファイル
- [x] src/interfaces/notifier.ts（新規作成）
- [x] src/notifier/console-notifier.ts（新規作成）
- [x] src/notifier/__tests__/console-notifier.test.ts（新規作成）

## 実装手順（TDD: Red-Green-Refactor）
### 1-3. インターフェース定義とモック実装
- [x] INotifierインターフェース定義（sendErrorNotification）
- [x] ConsoleNotifier実装（ログ出力のみ）
- [x] 単体テスト作成

## 完了条件
- [x] 追加したテストが全てパス
- [x] ConsoleNotifierでログ出力される
- [x] 成果物作成完了
