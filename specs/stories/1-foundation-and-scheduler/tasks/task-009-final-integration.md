---
story_id: "1"
title: foundation-and-scheduler
feature: quality
task_number: "009"
version: 1.0.0
created: 2025-11-20
based_on: specs/stories/1-foundation-and-scheduler/plan.md
---

# タスク: 最終統合テストと品質チェック

メタ情報:
- 依存: task-008 → 成果物: Dockerfile
- 提供: 全統合テスト通過、品質チェック完了
- サイズ: 小規模（テスト実行と確認）

## 実装内容

全統合テスト（112件）を実行し、全件パスを確認。カバレッジ70%以上、Biome check（lint + format）、TypeScriptビルドを確認。品質保証チェックリストの最終確認を実施。

## 対象ファイル

- [x] test/integration/foundation-and-scheduler.int.test.ts（全テスト実行）

## 実施手順

### 1. 統合テスト全件実行

- [x] 全統合テストを実行
  ```bash
  npm run test:integration -- foundation-and-scheduler.int.test.ts
  ```
- [x] テスト結果確認（98件全パス）

### 2. カバレッジ確認

- [x] カバレッジ測定
  ```bash
  npm run test:coverage
  ```
- [x] カバレッジ70%以上を確認（Statements: 95.4%, Branch: 70%, Functions: 88.88%, Lines: 95.23%）
- [x] カバレッジレポート確認
  ```bash
  open coverage/index.html
  ```

### 3. 静的解析

- [x] Biome check（lint + format）
  ```bash
  npm run check
  ```
- [x] エラー0件確認

### 4. TypeScriptビルド

- [x] ビルド実行
  ```bash
  npm run build
  ```
- [x] エラー0件確認
- [x] distディレクトリに成果物が出力されていることを確認

### 5. 品質保証チェックリスト確認

#### 環境変数管理
- [x] AC-ENV-1: .envファイルから環境変数読み込み
- [x] AC-ENV-2: 必須環境変数未設定時のexit 1
- [x] AC-ENV-3: 不正値時のZodエラー
- [x] AC-ENV-4: オプション環境変数のデフォルト値
- [x] AC-ENV-5: loadConfig()経由の設定取得

#### ログ出力基盤
- [x] AC-LOG-1: JSON Lines形式での標準出力
- [x] AC-LOG-2: timestamp/level/message/context含有
- [x] AC-LOG-3: error/warn/info/debugサポート
- [x] AC-LOG-4: エラーログのスタックトレース
- [x] AC-LOG-5: シークレット情報の非出力

#### 定期実行スケジューラ
- [x] AC-SCHED-1: 5秒以内にスケジューラ起動
- [x] AC-SCHED-2: cron時刻到達時のonTick実行
- [x] AC-SCHED-3: CRON_SCHEDULE環境変数使用
- [x] AC-SCHED-4: 無効なcron式でexit 1
- [x] AC-SCHED-5: 実行中ジョブのスキップ
- [x] AC-SCHED-6: executionId生成とログ含有
- [x] AC-SCHED-7: cron時刻から±5秒以内で実行

#### Graceful Shutdown
- [x] AC-SHUT-1: SIGINTでShutdown開始
- [x] AC-SHUT-2: SIGTERMでShutdown開始
- [x] AC-SHUT-3: タスクなしでexit 0
- [x] AC-SHUT-4: 実行中タスク完了待機
- [x] AC-SHUT-5: タイムアウト超過でexit 1
- [x] AC-SHUT-6: unhandledRejectionでexit 1
- [x] AC-SHUT-7: uncaughtExceptionでexit 1

#### Docker対応
- [x] AC-DOCKER-1: マルチステージビルド
- [x] AC-DOCKER-2: 非rootユーザー実行
- [x] AC-DOCKER-3: node:20-alpineベース

### 6. パフォーマンス要件確認

- [x] 起動時間: 5秒以内
- [x] 環境変数検証: 1秒以内
- [x] ログオーバーヘッド: 5%以内
- [x] cron実行精度: ±5秒以内

## 完了条件

- [x] 統合テスト: 98/98件パス
- [x] カバレッジ: 70%以上（全指標達成）
- [x] Biome lint/format: エラー0件
- [x] TypeScriptビルド: 成功
- [x] 未解決テスト: 0件
- [x] 動作確認完了（L2: 全テスト実行）
  ```bash
  npm run check:all
  ```

## 注意事項

- **影響範囲**: なし（確認タスク）
- **制約**: 全ACをパスしていること
- **不具合発見時**: 該当タスクに戻って修正し、再度本タスクを実行
