---
story_id: "1"
title: foundation-and-scheduler
feature: foundation
task_number: "007"
version: 1.0.0
created: 2025-11-20
based_on: specs/stories/1-foundation-and-scheduler/plan.md
---

# タスク: エントリーポイント実装と統合テスト作成

メタ情報:
- 依存: task-006 → 成果物: src/shutdown/graceful-shutdown.ts
- 提供: src/index.ts（main関数、アプリケーション起動）
- サイズ: 中規模（実装1ファイル + テスト追記）

## 実装内容

アプリケーションのエントリーポイントを実装する。環境変数ロード、ロガー作成、スケジューラ作成、Graceful Shutdown設定、スケジューラ起動を順次実行。プレースホルダーのonTickを設定（後続ストーリーで実装）。

## 対象ファイル

- [ ] src/index.ts
- [ ] test/integration/foundation-and-scheduler.int.test.ts（エントリーポイント部分追記）

## 実装手順（TDD: Red-Green-Refactor）

### 1. Red Phase

- [ ] 統合テストの追記
  - 正常起動フロー（4件）
  - main()のエラーハンドリング（2件）
- [ ] テスト実行して失敗を確認
  ```bash
  npm run test:integration
  ```

### 2. Green Phase

- [ ] main()関数の実装（Design Doc準拠）
  ```typescript
  async function main(): Promise<void> {
    // 1. 環境変数を読み込み・検証
    const config = loadConfig()

    // 2. ロガーを作成
    const logger = createLogger(config)
    logger.info('アプリケーション起動開始', {
      nodeEnv: config.NODE_ENV,
      logLevel: config.LOG_LEVEL,
    })

    // 3. スケジューラを作成
    const scheduler = createScheduler(config, logger, async () => {
      // 後続ストーリーで実装: データ取得 → 変換 → 送信
      logger.info('エクスポートジョブ実行（プレースホルダー）')
    })

    // 4. Graceful Shutdownを設定
    setupGracefulShutdown({
      timeoutMs: config.GRACEFUL_SHUTDOWN_TIMEOUT * 1000,
      scheduler,
      logger,
    })

    // 5. スケジューラを起動
    scheduler.start()

    // 設定ダンプ（シークレットはマスク）
    logger.info('設定値', {
      cronSchedule: config.CRON_SCHEDULE,
      gracefulShutdownTimeout: config.GRACEFUL_SHUTDOWN_TIMEOUT,
      maxRetry: config.MAX_RETRY,
      difyApiUrl: config.DIFY_API_URL,
      externalApiUrl: config.EXTERNAL_API_URL,
      // トークンは出力しない
    })
  }

  main().catch((error) => {
    console.error('致命的なエラー:', error)
    process.exit(1)
  })
  ```

- [ ] テスト実行して通ることを確認

### 3. Refactor Phase

- [ ] コード改善（テストが通る状態を維持）
- [ ] `npm run check` でlint/formatエラーなし

## テストケース詳細

### 正常起動フロー（4件）
- loadConfig()が呼ばれる
- createLogger()が呼ばれる
- createScheduler()が呼ばれる
- setupGracefulShutdown()が呼ばれる

### main()のエラーハンドリング（2件）
- main()内でエラー発生時にconsole.errorで出力
- エラー発生時にexit(1)

## 完了条件

- [ ] 追加したテストが全てパス（6件）
- [ ] TypeScript strict mode: エラー0件
- [ ] Biome lint: エラー0件
- [ ] 動作確認完了（L2: 統合テスト実行）
  ```bash
  npm run test:integration -- foundation-and-scheduler.int.test.ts
  ```
- [ ] 起動時間5秒以内
- [ ] トレーサビリティ: 正常起動（4件）、エラーハンドリング（2件）

### Phase 3 動作確認手順

1. CRON_SCHEDULE='*/1 * * * *'（毎分実行）を設定
2. 起動し、1分待機
3. **期待結果**: ジョブ実行開始/完了ログが出力される
4. `kill -SIGTERM <pid>` を送信
5. **期待結果**: Graceful Shutdown完了ログが出力され、exit 0で終了

```bash
# .envに設定
CRON_SCHEDULE='*/1 * * * *'
# その他必須環境変数を設定

# ビルドと起動
npm run build && node dist/index.js

# 別ターミナルでシャットダウンテスト
kill -SIGTERM $(pgrep -f "node dist/index.js")
```

## 注意事項

- **影響範囲**: なし（最終エントリーポイント）
- **制約**: Design Docのインターフェースに完全準拠
- **シークレット保護**: 設定ダンプログにトークンを含めない
- **プレースホルダー**: onTickは後続ストーリーで実装
- **timeoutMs変換**: GRACEFUL_SHUTDOWN_TIMEOUTは秒単位のため、1000倍してミリ秒に変換
