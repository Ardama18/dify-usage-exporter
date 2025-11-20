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

- [ ] test/e2e/foundation-and-scheduler.e2e.test.ts

## 実施手順

### 1. E2Eテスト全件実行

- [ ] 全E2Eテストを実行
  ```bash
  npm run test:e2e -- foundation-and-scheduler.e2e.test.ts
  ```
- [ ] テスト結果確認（49件全パス）

### 2. テストカテゴリ別確認

#### Docker コンテナ E2Eテスト（11件）
- [ ] docker build成功
- [ ] docker run起動成功
- [ ] 非rootユーザー実行
- [ ] 環境変数渡し
- [ ] ログJSON出力
- [ ] SIGTERM対応
- [ ] exit 0終了
- [ ] イメージサイズ最適化
- [ ] その他

#### アプリケーション起動 E2Eテスト（8件）
- [ ] 正常起動
- [ ] 起動ログ出力
- [ ] 設定ダンプログ
- [ ] シークレットマスク
- [ ] 起動時間5秒以内
- [ ] その他

#### スケジューラ実行 E2Eテスト（6件）
- [ ] cron時刻での実行
- [ ] 実行開始/完了ログ
- [ ] executionId生成
- [ ] 重複実行防止
- [ ] その他

#### Graceful Shutdown E2Eテスト（8件）
- [ ] SIGINT対応
- [ ] SIGTERM対応
- [ ] タスク完了待機
- [ ] タイムアウト処理
- [ ] exit 0/1
- [ ] その他

#### ログ出力 E2Eテスト（6件）
- [ ] JSON Lines形式
- [ ] 必須フィールド
- [ ] ログレベル
- [ ] スタックトレース
- [ ] その他

#### 異常系 E2Eテスト（2件）
- [ ] 必須環境変数不足
- [ ] 無効なcron式

#### 全体シナリオ E2Eテスト（8件）
- [ ] 起動 → ジョブ実行 → シャットダウン
- [ ] 長時間タスク中のシャットダウン
- [ ] 複数回のジョブ実行
- [ ] その他

### 3. パフォーマンス要件最終確認

- [ ] 起動時間: 5秒以内
- [ ] 環境変数検証: 1秒以内

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

- [ ] E2Eテスト: 49/49件パス
- [ ] パフォーマンス要件達成（起動5秒以内、検証1秒以内）
- [ ] 動作確認完了（L3: E2Eテスト実行）
  ```bash
  npm run test:e2e -- foundation-and-scheduler.e2e.test.ts
  ```

## 最終確認チェックリスト

### ストーリー完了条件
- [ ] 全統合テスト通過（112件）
- [ ] 全E2Eテスト通過（49件）
- [ ] カバレッジ70%以上
- [ ] Biome check通過
- [ ] TypeScriptビルド成功
- [ ] Docker build/run成功
- [ ] 設計書（Design Doc）との整合性確認

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
