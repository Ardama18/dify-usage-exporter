import { loadConfig } from './config/env-config.js'
import { createLogger } from './logger/winston-logger.js'
import { createMetricsCollector } from './monitoring/metrics-collector.js'
import { createMetricsReporter } from './monitoring/metrics-reporter.js'
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

  // 3. MetricsReporterを作成
  const reporter = createMetricsReporter({ logger })

  // 4. スケジューラを作成
  const scheduler = createScheduler(config, logger, async () => {
    // MetricsCollectorを作成・開始
    const collector = createMetricsCollector()
    const executionId = collector.startCollection()
    logger.info('ジョブ実行開始', { executionId })

    try {
      // 後続ストーリーで実装: データ取得 → 変換 → 送信
      logger.info('エクスポートジョブ実行（プレースホルダー）')
    } finally {
      // メトリクス収集停止とレポート出力
      collector.stopCollection()
      reporter.report(
        collector.getExecutionId(),
        collector.getMetrics(),
        collector.getExecutionDuration(),
      )
    }
  })

  // 5. Graceful Shutdownを設定
  setupGracefulShutdown({
    timeoutMs: config.GRACEFUL_SHUTDOWN_TIMEOUT * 1000,
    scheduler,
    logger,
  })

  // 6. スケジューラを起動
  scheduler.start()

  // 設定ダンプ（シークレットはマスク）
  logger.info('設定値', {
    cronSchedule: config.CRON_SCHEDULE,
    gracefulShutdownTimeout: config.GRACEFUL_SHUTDOWN_TIMEOUT,
    maxRetry: config.MAX_RETRY,
    difyApiUrl: config.DIFY_API_BASE_URL,
    externalApiUrl: config.EXTERNAL_API_URL,
    // トークンは出力しない
  })
}

// ES Moduleの直接実行を検出
// Node.jsでimport.meta.urlとprocess.argv[1]を比較
// URL encodingの問題を回避するためdecodeURIComponentを使用
const isMainModule = (() => {
  const scriptPath = process.argv[1]
  if (!scriptPath) return false
  const moduleUrl = import.meta.url
  // file://をデコードしてパスを正規化
  const decodedModuleUrl = decodeURIComponent(moduleUrl)
  const expectedUrl = `file://${scriptPath}`
  return decodedModuleUrl === expectedUrl
})()

if (isMainModule) {
  main().catch((error) => {
    console.error('致命的なエラー:', error)
    process.exit(1)
  })
}
