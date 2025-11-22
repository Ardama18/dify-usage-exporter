---
story_id: "1"
title: foundation-and-scheduler
feature: quality
task_number: "010"
version: 1.0.0
created: 2025-11-20
based_on: specs/stories/1-foundation-and-scheduler/plan.md
---

# タスク: E2Eテスト実行

メタ情報:
- 依存: task-009 → 成果物: 全統合テスト通過
- 提供: 全E2Eテスト通過
- サイズ: 小規模（テスト実行と確認）

## 実装内容

全E2Eテスト（49件）を実行し、全件パスを確認。Docker環境でのアプリケーション起動、スケジューラ実行、Graceful Shutdown、ログ出力、異常系、全体シナリオをテスト。

## 対象ファイル

- [x] test/e2e/foundation-and-scheduler.e2e.test.ts

## 実施手順

### 1. E2Eテスト全件実行

- [x] 全E2Eテストを実行
  ```bash
  npm run test:e2e -- foundation-and-scheduler.e2e.test.ts
  ```
- [x] テスト結果確認（49件全パス）

### 2. テストカテゴリ別確認

#### Docker コンテナ E2Eテスト（11件）
- [x] docker build成功
- [x] docker run起動成功
- [x] 非rootユーザー実行
- [x] 環境変数渡し
- [x] ログJSON出力
- [x] SIGTERM対応
- [x] exit 0終了
- [x] イメージサイズ最適化
- [x] その他

#### アプリケーション起動 E2Eテスト（8件）
- [x] 正常起動
- [x] 起動ログ出力
- [x] 設定ダンプログ
- [x] シークレットマスク
- [x] 起動時間5秒以内
- [x] その他

#### スケジューラ実行 E2Eテスト（6件）
- [x] cron時刻での実行
- [x] 実行開始/完了ログ
- [x] executionId生成
- [x] 重複実行防止
- [x] その他

#### Graceful Shutdown E2Eテスト（8件）
- [x] SIGINT対応
- [x] SIGTERM対応
- [x] タスク完了待機
- [x] タイムアウト処理
- [x] exit 0/1
- [x] その他

#### ログ出力 E2Eテスト（6件）
- [x] JSON Lines形式
- [x] 必須フィールド
- [x] ログレベル
- [x] スタックトレース
- [x] その他

#### 異常系 E2Eテスト（2件）
- [x] 必須環境変数不足
- [x] 無効なcron式

#### 全体シナリオ E2Eテスト（8件）
- [x] 起動 → ジョブ実行 → シャットダウン
- [x] 長時間タスク中のシャットダウン
- [x] 複数回のジョブ実行
- [x] その他

### 3. パフォーマンス要件最終確認

- [x] 起動時間: 5秒以内
- [x] 環境変数検証: 1秒以内

### Phase 4 動作確認手順

1. `docker build -t dify-usage-exporter .` を実行
2. `docker run --env-file .env dify-usage-exporter` を実行
3. **期待結果**: コンテナ内で正常に起動し、ログが出力される
4. `docker stop <container_id>` を実行
5. **期待結果**: Graceful Shutdownが完了し、exit 0で終了

```bash
# ビルド
docker build -t dify-usage-exporter .

# 起動（デタッチモード）
docker run -d --name exporter --env-file .env dify-usage-exporter

# ログ確認
docker logs -f exporter

# Graceful Shutdown
docker stop exporter

# 終了コード確認
docker inspect exporter --format='{{.State.ExitCode}}'
# 出力: 0

# クリーンアップ
docker rm exporter
```

## 完了条件

- [x] E2Eテスト: 49/49件パス
- [x] パフォーマンス要件達成（起動5秒以内、検証1秒以内）
- [x] 動作確認完了（L3: E2Eテスト実行）
  ```bash
  npm run test:e2e -- foundation-and-scheduler.e2e.test.ts
  ```

## 最終確認チェックリスト

### ストーリー完了条件
- [x] 全統合テスト通過（98件）
- [x] 全E2Eテスト通過（49件）
- [x] カバレッジ70%以上（Statements: 96.47%, Branches: 87.83%, Functions: 96.35%, Lines: 96.7%）
- [x] Biome check通過
- [x] TypeScriptビルド成功
- [x] Docker build/run成功
- [x] 設計書（Design Doc）との整合性確認

### 次ストーリーへの引き継ぎ事項
- **提供インターフェース**:
  - EnvConfig型（src/types/env.ts）
  - Loggerインターフェース（src/logger/winston-logger.ts）
  - Schedulerインターフェース（src/scheduler/cron-scheduler.ts）
- **プレースホルダー**: onTick関数は後続ストーリーで実装
- **拡張ポイント**: envSchemaに新環境変数を追加可能

## 注意事項

- **影響範囲**: なし（最終確認タスク）
- **制約**: 全テストがパスしていること
- **不具合発見時**: 該当タスクに戻って修正し、再度本タスクを実行
- **E2Eテスト環境**: Dockerが利用可能であること
