import { loadConfig } from './config/env-config.js'
import { createLogger } from './logger/winston-logger.js'
import { createScheduler } from './scheduler/cron-scheduler.js'
import { setupGracefulShutdown } from './shutdown/graceful-shutdown.js'

export async function main(): Promise<void> {
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

// ES Moduleの直接実行を検出
// Node.jsでimport.meta.urlとprocess.argv[1]を比較
const isMainModule = import.meta.url === `file://${process.argv[1]}`

if (isMainModule) {
  main().catch((error) => {
    console.error('致命的なエラー:', error)
    process.exit(1)
  })
}
