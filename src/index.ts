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
import {
  createDifyUsageFetcher,
  type FetchedTokenCostRecord,
} from './fetcher/dify-usage-fetcher.js'
import { createModelUsageFetcher } from './fetcher/model-usage-fetcher.js'
import { createUserUsageFetcher } from './fetcher/user-usage-fetcher.js'
import type { FetchResult } from './interfaces/fetcher.js'
import { createLogger } from './logger/winston-logger.js'
import { createMetricsCollector } from './monitoring/metrics-collector.js'
import { createMetricsReporter } from './monitoring/metrics-reporter.js'
import { createNormalizer } from './normalizer/normalizer.js'
import { createScheduler } from './scheduler/cron-scheduler.js'
import { ExternalApiSender, type SendResult } from './sender/external-api-sender.js'
import { HttpClient } from './sender/http-client.js'
import { SpoolManager } from './sender/spool-manager.js'
import { setupGracefulShutdown } from './shutdown/graceful-shutdown.js'
import { createDataTransformer } from './transformer/data-transformer.js'
import { calculateDateRange } from './utils/period-calculator.js'
import { createWatermarkManager } from './watermark/watermark-manager.js'

// IPv4を優先するエージェント（IPv6接続問題の回避）
const httpsAgent = new https.Agent({
  family: 4,
})

/**
 * データ取得結果の型定義
 */
interface FetchDataResult {
  allRecords: FetchedTokenCostRecord[]
  rawUserRecords: RawUserUsageRecord[]
  rawModelRecords: RawModelUsageRecord[]
  fetchResult: FetchResult
}

/**
 * Difyからデータを取得
 * 1. トークンコストデータ取得
 * 2. ユーザー別使用量取得（per_user/allモード）
 * 3. モデル別使用量取得（per_model/allモード）
 */
async function fetchDataFromDify(
  fetcher: ReturnType<typeof createDifyUsageFetcher>,
  userUsageFetcher: ReturnType<typeof createUserUsageFetcher>,
  modelUsageFetcher: ReturnType<typeof createModelUsageFetcher>,
  config: ReturnType<typeof loadConfig>,
  logger: ReturnType<typeof createLogger>,
): Promise<FetchDataResult> {
  // 1. Difyからトークンコストデータ取得
  let allRecords: FetchedTokenCostRecord[] = []
  const fetchResult = await fetcher.fetch(async (records) => {
    allRecords = allRecords.concat(records)
  })

  if (!fetchResult.success) {
    logger.error('データ取得失敗', { errors: fetchResult.errors })
    return { allRecords: [], rawUserRecords: [], rawModelRecords: [], fetchResult }
  }

  if (allRecords.length === 0) {
    logger.info('送信するデータがありません')
    return { allRecords: [], rawUserRecords: [], rawModelRecords: [], fetchResult }
  }

  // 2. 期間計算（per_user/per_model/allモードで使用）
  const periodRange = calculateDateRange(
    config.DIFY_FETCH_PERIOD,
    config.DIFY_FETCH_START_DATE,
    config.DIFY_FETCH_END_DATE,
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

  return { allRecords, rawUserRecords, rawModelRecords, fetchResult }
}

/**
 * データ集計結果の型定義
 */
interface AggregateDataResult {
  aggregationResult: ReturnType<typeof aggregateUsageData>
  totalAggregatedRecords: number
}

/**
 * 取得したデータを集計
 * RawTokenCostRecordに変換し、アプリ/ワークスペース/ユーザー/モデル別に集計
 */
function aggregateData(
  allRecords: FetchedTokenCostRecord[],
  rawUserRecords: RawUserUsageRecord[],
  rawModelRecords: RawModelUsageRecord[],
  config: ReturnType<typeof loadConfig>,
  logger: ReturnType<typeof createLogger>,
): AggregateDataResult {
  // データ集計（RawTokenCostRecordに変換してから集計）
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
    rawModelRecords,
  )

  const totalAggregatedRecords =
    aggregationResult.appRecords.length +
    aggregationResult.workspaceRecords.length +
    aggregationResult.userRecords.length +
    aggregationResult.modelRecords.length

  logger.info('データ集計完了', {
    aggregationPeriod: config.DIFY_AGGREGATION_PERIOD,
    outputMode: config.DIFY_OUTPUT_MODE,
    appRecords: aggregationResult.appRecords.length,
    workspaceRecords: aggregationResult.workspaceRecords.length,
    userRecords: aggregationResult.userRecords.length,
    modelRecords: aggregationResult.modelRecords.length,
  })

  // アプリ毎のデータサマリーをログ出力（Difyとの一致確認用）
  if (aggregationResult.modelRecords.length > 0) {
    // アプリ毎にグループ化
    const appSummary = new Map<
      string,
      {
        app_name: string
        total_tokens: number
        total_cost: number
        models: Set<string>
        providers: Set<string>
        record_count: number
      }
    >()

    for (const record of aggregationResult.modelRecords) {
      const key = record.app_id
      const existing = appSummary.get(key)

      if (existing) {
        existing.total_tokens += record.total_tokens
        existing.total_cost += Number.parseFloat(record.total_price)
        existing.models.add(record.model_name)
        existing.providers.add(record.model_provider)
        existing.record_count += 1
      } else {
        appSummary.set(key, {
          app_name: record.app_name,
          total_tokens: record.total_tokens,
          total_cost: Number.parseFloat(record.total_price),
          models: new Set([record.model_name]),
          providers: new Set([record.model_provider]),
          record_count: 1,
        })
      }
    }

    // アプリ毎のサマリーをログ出力
    logger.info('=== アプリ毎のデータサマリー（Dify確認用） ===')
    for (const [appId, summary] of appSummary) {
      logger.info(`App: ${summary.app_name}`, {
        app_id: appId,
        app_name: summary.app_name,
        total_tokens: summary.total_tokens,
        total_cost_usd: summary.total_cost.toFixed(6),
        providers: [...summary.providers],
        models: [...summary.models],
        record_count: summary.record_count,
      })
    }
    logger.info('=== アプリ毎サマリー終了 ===')
  }

  return { aggregationResult, totalAggregatedRecords }
}

/**
 * API_Meterへデータ送信（per_model/allモードのみ）
 * 正規化 → 変換 → バッチ分割 → 送信の流れ
 */
async function sendToApiMeter(
  aggregationResult: ReturnType<typeof aggregateUsageData>,
  config: ReturnType<typeof loadConfig>,
  logger: ReturnType<typeof createLogger>,
  metrics: ReturnType<ReturnType<typeof createMetricsCollector>['getMetrics']>,
): Promise<void> {
  // 日別データのフィルタリング（period_type === 'daily'のみ）
  const dailyRecords = aggregationResult.modelRecords.filter(
    (record) => record.period_type === 'daily',
  )

  if (dailyRecords.length === 0) {
    logger.warn('No daily records for API_Meter', {
      aggregationPeriod: config.DIFY_AGGREGATION_PERIOD,
      totalModelRecords: aggregationResult.modelRecords.length,
    })
    return
  }

  // Normalize（プロバイダー/モデル名の正規化）
  const normalizer = createNormalizer(logger)
  const normalizedRecords = normalizer.normalize(dailyRecords)

  logger.info('正規化完了', {
    recordCount: normalizedRecords.length,
  })

  // バッチサイズ管理: 500レコード超の場合はバッチ分割
  const BATCH_SIZE = 500
  const batches: (typeof normalizedRecords)[] = []

  if (normalizedRecords.length > BATCH_SIZE) {
    logger.info('Splitting records into batches', {
      totalRecords: normalizedRecords.length,
      batchSize: BATCH_SIZE,
      batchCount: Math.ceil(normalizedRecords.length / BATCH_SIZE),
    })

    for (let i = 0; i < normalizedRecords.length; i += BATCH_SIZE) {
      batches.push(normalizedRecords.slice(i, i + BATCH_SIZE))
    }
  } else {
    batches.push(normalizedRecords)
  }

  // 各バッチを順次送信
  const httpClient = new HttpClient(logger, config)
  const spoolManager = new SpoolManager(logger)
  const sender = new ExternalApiSender(
    httpClient,
    spoolManager,
    { sendErrorNotification: () => Promise.resolve() }, // INotifier: Phase 3-3で実装予定
    logger,
    config,
    metrics,
  )

  // 送信結果を集計
  const results: SendResult[] = []
  let totalSent = 0

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    logger.info(`Sending batch ${i + 1}/${batches.length}`, {
      batchRecordCount: batch.length,
    })

    // Transform（ApiMeterRequest形式への変換）
    const transformer = createDataTransformer({ logger })
    const transformResult = transformer.transform(batch)

    // Send（API_Meterへ送信）
    const result = await sender.send(transformResult.request)
    results.push(result)

    totalSent += batch.length
    logger.info(`Batch ${i + 1}/${batches.length} sent successfully`, {
      batchRecordCount: batch.length,
      totalSent,
    })
  }

  // API_Meter送信結果サマリー
  const totalInserted = results.reduce((sum, r) => sum + (r.inserted ?? 0), 0)
  const totalUpdated = results.reduce((sum, r) => sum + (r.updated ?? 0), 0)
  const totalInApiMeter = results.reduce((sum, r) => sum + (r.total ?? 0), 0)

  logger.info('=== API_Meter送信結果サマリー ===')
  logger.info('API_Meter送信完了', {
    recordCount: totalSent,
    batchCount: batches.length,
    apiMeterResponse: {
      inserted: totalInserted,
      updated: totalUpdated,
      total: totalInApiMeter,
    },
  })
  logger.info(`送信レコード数: ${totalSent}件`)
  logger.info(`API_Meter結果: 新規=${totalInserted}件, 更新=${totalUpdated}件, 合計=${totalInApiMeter}件`)
  logger.info('=== API_Meter送信結果サマリー終了 ===')
}

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
      const fetchData = await fetchDataFromDify(
        fetcher,
        userUsageFetcher,
        modelUsageFetcher,
        config,
        logger,
      )
      collector.getMetrics().fetchedRecords = fetchData.allRecords.length

      if (!fetchData.fetchResult.success || fetchData.allRecords.length === 0) {
        return
      }

      // 2. データ集計
      const { aggregationResult, totalAggregatedRecords } = aggregateData(
        fetchData.allRecords,
        fetchData.rawUserRecords,
        fetchData.rawModelRecords,
        config,
        logger,
      )
      collector.getMetrics().transformedRecords = totalAggregatedRecords

      if (totalAggregatedRecords === 0) {
        logger.info('送信するデータがありません（集計後）')
        return
      }

      // 3. per_model/allモードのみAPI_Meterへ送信
      if (config.DIFY_OUTPUT_MODE === 'per_model' || config.DIFY_OUTPUT_MODE === 'all') {
        try {
          await sendToApiMeter(aggregationResult, config, logger, collector.getMetrics())
        } catch (error) {
          const err = error as Error
          logger.error('API_Meter送信失敗', {
            message: err.message,
          })
          // エラーをスローせず、次回実行時にスプールファイルから再送
        }
      } else {
        logger.info('Skipping API_Meter send (per_user/per_app/workspace mode)', {
          outputMode: config.DIFY_OUTPUT_MODE,
        })

        // 旧形式の外部API送信（per_user/per_app/workspaceモード用）
        const payload: Record<string, unknown> = {
          aggregation_period: config.DIFY_AGGREGATION_PERIOD,
          output_mode: config.DIFY_OUTPUT_MODE,
          fetch_period: {
            start: fetchData.fetchResult.startDate,
            end: fetchData.fetchResult.endDate,
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

        logger.info('外部API送信開始（旧形式）', {
          url: config.EXTERNAL_API_URL,
          appRecordCount: aggregationResult.appRecords.length,
          workspaceRecordCount: aggregationResult.workspaceRecords.length,
          userRecordCount: aggregationResult.userRecords.length,
          modelRecordCount: aggregationResult.modelRecords.length,
        })

        // デバッグ用: 送信ペイロードの詳細をログ出力
        logger.debug('送信ペイロード詳細（旧形式）', {
          aggregation_period: payload.aggregation_period,
          output_mode: payload.output_mode,
          fetch_period: payload.fetch_period,
          sampleAppRecord: aggregationResult.appRecords[0] || null,
          sampleWorkspaceRecord: aggregationResult.workspaceRecords[0] || null,
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

        logger.info('外部API送信完了（旧形式）', {
          status: response.status,
          appRecordCount: aggregationResult.appRecords.length,
          workspaceRecordCount: aggregationResult.workspaceRecords.length,
          userRecordCount: aggregationResult.userRecords.length,
          modelRecordCount: aggregationResult.modelRecords.length,
        })
      }
    } catch (error) {
      const err = error as Error
      // デバッグ用: エラーレスポンスの詳細をログ出力
      const axiosErr = error as { response?: { status?: number; data?: unknown } }
      logger.error('エクスポートジョブ失敗', {
        message: err.message,
        status: axiosErr.response?.status,
        responseData: axiosErr.response?.data,
        fullErrorResponse: JSON.stringify(axiosErr.response?.data, null, 2),
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
