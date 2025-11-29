import https from 'node:https'
import axios from 'axios'
import {
  aggregateUsageData,
  type RawModelUsageRecord,
  type RawTokenCostRecord,
  type RawUserUsageRecord,
} from './aggregator/usage-aggregator.js'
import { loadConfig } from './config/env-config.js'
import { createDifyApiClient } from './fetcher/dify-api-client.js'
import { createDifyUsageFetcher, type FetchedTokenCostRecord } from './fetcher/dify-usage-fetcher.js'
import { createModelUsageFetcher } from './fetcher/model-usage-fetcher.js'
import { createUserUsageFetcher } from './fetcher/user-usage-fetcher.js'
import { createLogger } from './logger/winston-logger.js'
import { createMetricsCollector } from './monitoring/metrics-collector.js'
import { createMetricsReporter } from './monitoring/metrics-reporter.js'
import { createScheduler } from './scheduler/cron-scheduler.js'
import { setupGracefulShutdown } from './shutdown/graceful-shutdown.js'
import { calculateDateRange } from './utils/period-calculator.js'
import { createWatermarkManager } from './watermark/watermark-manager.js'

// IPv4を優先するエージェント（IPv6接続問題の回避）
const httpsAgent = new https.Agent({
  family: 4,
})

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

  // 4. 依存コンポーネントを作成
  const difyClient = createDifyApiClient({ config, logger })
  const watermarkManager = createWatermarkManager({ config, logger })
  const fetcher = createDifyUsageFetcher({
    config,
    logger,
    client: difyClient,
    watermarkManager,
  })
  const modelUsageFetcher = createModelUsageFetcher({ difyClient, logger })
  const userUsageFetcher = createUserUsageFetcher({ difyClient, logger })

  // 5. スケジューラを作成
  const scheduler = createScheduler(config, logger, async () => {
    // MetricsCollectorを作成・開始
    const collector = createMetricsCollector()
    const executionId = collector.startCollection()
    logger.info('ジョブ実行開始', { executionId })

    try {
      // === 実際のエクスポート処理 ===

      // 1. Difyからデータ取得
      let allRecords: FetchedTokenCostRecord[] = []
      const fetchResult = await fetcher.fetch(async (records) => {
        allRecords = allRecords.concat(records)
      })

      collector.getMetrics().fetchedRecords = allRecords.length

      if (!fetchResult.success) {
        logger.error('データ取得失敗', { errors: fetchResult.errors })
        return
      }

      if (allRecords.length === 0) {
        logger.info('送信するデータがありません')
        return
      }

      // 2. 期間計算（per_user/per_model/allモードで使用）
      const periodRange = calculateDateRange(
        config.DIFY_FETCH_PERIOD,
        config.DIFY_FETCH_START_DATE,
        config.DIFY_FETCH_END_DATE
      )

      // 3. ユーザー別使用量を取得（per_user/allモードの場合）
      let rawUserRecords: RawUserUsageRecord[] = []
      if (config.DIFY_OUTPUT_MODE === 'per_user' || config.DIFY_OUTPUT_MODE === 'all') {
        const userResult = await userUsageFetcher.fetch({
          startTimestamp: Math.floor(periodRange.startDate.getTime() / 1000),
          endTimestamp: Math.floor(periodRange.endDate.getTime() / 1000),
        })

        rawUserRecords = userResult.records.map((record) => ({
          date: record.date,
          user_id: record.user_id,
          user_type: record.user_type,
          app_id: record.app_id,
          app_name: record.app_name,
          message_tokens: record.message_tokens,
          answer_tokens: record.answer_tokens,
          total_tokens: record.total_tokens,
          conversation_id: record.conversation_id,
        }))

        logger.info('ユーザー別使用量取得完了', { recordCount: rawUserRecords.length })
      }

      // 4. モデル別使用量を取得（per_model/allモードの場合）
      let rawModelRecords: RawModelUsageRecord[] = []
      if (config.DIFY_OUTPUT_MODE === 'per_model' || config.DIFY_OUTPUT_MODE === 'all') {
        const modelResult = await modelUsageFetcher.fetch({
          startTimestamp: Math.floor(periodRange.startDate.getTime() / 1000),
          endTimestamp: Math.floor(periodRange.endDate.getTime() / 1000),
        })

        rawModelRecords = modelResult.records.map((record) => ({
          date: record.date,
          user_id: record.user_id,
          user_type: record.user_type,
          app_id: record.app_id,
          app_name: record.app_name,
          model_provider: record.model_provider,
          model_name: record.model_name,
          prompt_tokens: record.prompt_tokens,
          completion_tokens: record.completion_tokens,
          total_tokens: record.total_tokens,
          prompt_price: record.prompt_price,
          completion_price: record.completion_price,
          total_price: record.total_price,
          currency: record.currency,
        }))

        logger.info('モデル別使用量取得完了', { recordCount: rawModelRecords.length })
      }

      // 5. データ集計（RawTokenCostRecordに変換してから集計）
      const rawRecords: RawTokenCostRecord[] = allRecords.map((record) => ({
        date: record.date,
        app_id: record.app_id,
        app_name: record.app_name,
        token_count: record.token_count,
        total_price: record.total_price,
        currency: record.currency,
      }))

      const aggregationResult = aggregateUsageData(
        rawRecords,
        config.DIFY_AGGREGATION_PERIOD,
        config.DIFY_OUTPUT_MODE,
        rawUserRecords,
        rawModelRecords
      )

      const totalAggregatedRecords =
        aggregationResult.appRecords.length +
        aggregationResult.workspaceRecords.length +
        aggregationResult.userRecords.length +
        aggregationResult.modelRecords.length
      collector.getMetrics().transformedRecords = totalAggregatedRecords

      if (totalAggregatedRecords === 0) {
        logger.info('送信するデータがありません（集計後）')
        return
      }

      logger.info('データ集計完了', {
        aggregationPeriod: config.DIFY_AGGREGATION_PERIOD,
        outputMode: config.DIFY_OUTPUT_MODE,
        appRecords: aggregationResult.appRecords.length,
        workspaceRecords: aggregationResult.workspaceRecords.length,
        userRecords: aggregationResult.userRecords.length,
        modelRecords: aggregationResult.modelRecords.length,
      })

      // 4. 外部APIへ送信
      const payload: Record<string, unknown> = {
        aggregation_period: config.DIFY_AGGREGATION_PERIOD,
        output_mode: config.DIFY_OUTPUT_MODE,
        fetch_period: {
          start: fetchResult.startDate,
          end: fetchResult.endDate,
        },
      }

      // 出力モードに応じてペイロードを構築
      if (aggregationResult.appRecords.length > 0) {
        payload.app_records = aggregationResult.appRecords
      }
      if (aggregationResult.workspaceRecords.length > 0) {
        payload.workspace_records = aggregationResult.workspaceRecords
      }
      if (aggregationResult.userRecords.length > 0) {
        payload.user_records = aggregationResult.userRecords
      }
      if (aggregationResult.modelRecords.length > 0) {
        payload.model_records = aggregationResult.modelRecords
      }

      logger.info('外部API送信開始', {
        url: config.EXTERNAL_API_URL,
        appRecordCount: aggregationResult.appRecords.length,
        workspaceRecordCount: aggregationResult.workspaceRecords.length,
        userRecordCount: aggregationResult.userRecords.length,
        modelRecordCount: aggregationResult.modelRecords.length,
      })

      const response = await axios.post(config.EXTERNAL_API_URL, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.EXTERNAL_API_TOKEN}`,
        },
        timeout: config.EXTERNAL_API_TIMEOUT_MS,
        httpsAgent,
      })

      collector.getMetrics().sendSuccess = totalAggregatedRecords

      logger.info('外部API送信完了', {
        status: response.status,
        appRecordCount: aggregationResult.appRecords.length,
        workspaceRecordCount: aggregationResult.workspaceRecords.length,
        userRecordCount: aggregationResult.userRecords.length,
        modelRecordCount: aggregationResult.modelRecords.length,
      })
    } catch (error) {
      const err = error as Error
      logger.error('エクスポートジョブ失敗', {
        message: err.message,
      })
      collector.getMetrics().sendFailed = 1
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

  // 6. Graceful Shutdownを設定
  setupGracefulShutdown({
    timeoutMs: config.GRACEFUL_SHUTDOWN_TIMEOUT * 1000,
    scheduler,
    logger,
  })

  // 7. スケジューラを起動
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
