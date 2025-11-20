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

- [ ] test/integration/foundation-and-scheduler.int.test.ts（全テスト実行）

## 実施手順

### 1. 統合テスト全件実行

- [ ] 全統合テストを実行
  ```bash
  npm run test:integration -- foundation-and-scheduler.int.test.ts
  ```
- [ ] テスト結果確認（112件全パス）

### 2. カバレッジ確認

- [ ] カバレッジ測定
  ```bash
  npm run test:coverage
  ```
- [ ] カバレッジ70%以上を確認
- [ ] カバレッジレポート確認
  ```bash
  open coverage/index.html
  ```

### 3. 静的解析

- [ ] Biome check（lint + format）
  ```bash
  npm run check
  ```
- [ ] エラー0件確認

### 4. TypeScriptビルド

- [ ] ビルド実行
  ```bash
  npm run build
  ```
- [ ] エラー0件確認
- [ ] distディレクトリに成果物が出力されていることを確認

### 5. 品質保証チェックリスト確認

#### 環境変数管理
- [ ] AC-ENV-1: .envファイルから環境変数読み込み
- [ ] AC-ENV-2: 必須環境変数未設定時のexit 1
- [ ] AC-ENV-3: 不正値時のZodエラー
- [ ] AC-ENV-4: オプション環境変数のデフォルト値
- [ ] AC-ENV-5: loadConfig()経由の設定取得

#### ログ出力基盤
- [ ] AC-LOG-1: JSON Lines形式での標準出力
- [ ] AC-LOG-2: timestamp/level/message/context含有
- [ ] AC-LOG-3: error/warn/info/debugサポート
- [ ] AC-LOG-4: エラーログのスタックトレース
- [ ] AC-LOG-5: シークレット情報の非出力

#### 定期実行スケジューラ
- [ ] AC-SCHED-1: 5秒以内にスケジューラ起動
- [ ] AC-SCHED-2: cron時刻到達時のonTick実行
- [ ] AC-SCHED-3: CRON_SCHEDULE環境変数使用
- [ ] AC-SCHED-4: 無効なcron式でexit 1
- [ ] AC-SCHED-5: 実行中ジョブのスキップ
- [ ] AC-SCHED-6: executionId生成とログ含有
- [ ] AC-SCHED-7: cron時刻から±5秒以内で実行

#### Graceful Shutdown
- [ ] AC-SHUT-1: SIGINTでShutdown開始
- [ ] AC-SHUT-2: SIGTERMでShutdown開始
- [ ] AC-SHUT-3: タスクなしでexit 0
- [ ] AC-SHUT-4: 実行中タスク完了待機
- [ ] AC-SHUT-5: タイムアウト超過でexit 1
- [ ] AC-SHUT-6: unhandledRejectionでexit 1
- [ ] AC-SHUT-7: uncaughtExceptionでexit 1

#### Docker対応
- [ ] AC-DOCKER-1: マルチステージビルド
- [ ] AC-DOCKER-2: 非rootユーザー実行
- [ ] AC-DOCKER-3: node:20-alpineベース

### 6. パフォーマンス要件確認

- [ ] 起動時間: 5秒以内
- [ ] 環境変数検証: 1秒以内
- [ ] ログオーバーヘッド: 5%以内
- [ ] cron実行精度: ±5秒以内

## 完了条件

- [ ] 統合テスト: 112/112件パス
- [ ] カバレッジ: 70%以上
- [ ] Biome lint/format: エラー0件
- [ ] TypeScriptビルド: 成功
- [ ] 未解決テスト: 0件
- [ ] 動作確認完了（L2: 全テスト実行）
  ```bash
  npm run check:all
  ```

## 注意事項

- **影響範囲**: なし（確認タスク）
- **制約**: 全ACをパスしていること
- **不具合発見時**: 該当タスクに戻って修正し、再度本タスクを実行
