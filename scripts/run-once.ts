/**
 * 手動実行スクリプト
 * Difyからモデル別使用量データを取得し、API_Meter形式で外部APIへ送信する
 *
 * API_Meter新仕様（SPEC-CHANGE-001）対応
 */
import dotenv from 'dotenv'
dotenv.config()

import https from 'node:https'
import axios from 'axios'
import {
  aggregateUsageData,
  type RawModelUsageRecord,
} from '../src/aggregator/usage-aggregator.js'
import { loadConfig } from '../src/config/env-config.js'
import { createDifyApiClient } from '../src/fetcher/dify-api-client.js'
import { createModelUsageFetcher } from '../src/fetcher/model-usage-fetcher.js'
import { createLogger } from '../src/logger/winston-logger.js'
import { createNormalizer } from '../src/normalizer/normalizer.js'
import { createDataTransformer } from '../src/transformer/data-transformer.js'
import { calculateDateRange } from '../src/utils/period-calculator.js'

// IPv4を優先するエージェント（IPv6接続問題の回避）
const httpsAgent = new https.Agent({
  family: 4,
})

async function runOnce() {
  console.log('=== Dify Usage Exporter 手動実行（API_Meter新仕様）===\n')

  const config = loadConfig()
  const logger = createLogger(config)

  logger.info('実行開始', {
    difyApiUrl: config.DIFY_API_BASE_URL,
    externalApiUrl: config.EXTERNAL_API_URL,
    fetchPeriod: config.DIFY_FETCH_PERIOD,
    aggregationPeriod: config.DIFY_AGGREGATION_PERIOD,
    tenantId: config.API_METER_TENANT_ID,
  })

  try {
    // 1. Dify APIクライアント作成
    const difyClient = createDifyApiClient({ config, logger })

    // 2. モデル別使用量Fetcher作成
    const modelUsageFetcher = createModelUsageFetcher({
      difyClient,
      logger,
    })

    // 3. 期間計算
    const periodRange = calculateDateRange(config.DIFY_FETCH_PERIOD)
    const startTimestamp = Math.floor(periodRange.startDate.getTime() / 1000)
    const endTimestamp = Math.floor(periodRange.endDate.getTime() / 1000)

    logger.info('データ取得開始', {
      startDate: periodRange.startDate.toISOString().split('T')[0],
      endDate: periodRange.endDate.toISOString().split('T')[0],
    })

    // 4. モデル別使用量データ取得
    const fetchResult = await modelUsageFetcher.fetch({
      startTimestamp,
      endTimestamp,
    })

    if (!fetchResult.success) {
      logger.error('データ取得失敗', { errors: fetchResult.errors })
      process.exit(1)
    }

    logger.info('データ取得完了', {
      recordCount: fetchResult.records.length,
      summaryCount: fetchResult.summaries.length,
    })

    if (fetchResult.records.length === 0) {
      logger.info('送信するデータがありません')
      console.log('\n=== 完了（データなし）===')
      return
    }

    // 5. RawModelUsageRecord形式に変換
    const rawModelRecords: RawModelUsageRecord[] = fetchResult.records.map((record) => ({
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

    // 6. データ集計（API_Meterは日別レコードを期待するため、常にdaily集計）
    logger.info('データ集計開始')
    const aggregationResult = aggregateUsageData(
      [], // appRecords用（空）
      'daily', // API_Meterは YYYY-MM-DD 形式を要求するため常にdaily
      'per_model',
      undefined, // userRecords
      rawModelRecords
    )

    logger.info('データ集計完了', {
      modelRecords: aggregationResult.modelRecords.length,
    })

    if (aggregationResult.modelRecords.length === 0) {
      logger.info('送信するデータがありません（集計後）')
      console.log('\n=== 完了（集計後データなし）===')
      return
    }

    // 7. 正規化（クレンジング）
    const normalizer = createNormalizer(logger)
    const normalizedRecords = normalizer.normalize(aggregationResult.modelRecords)

    logger.info('データ正規化完了', {
      normalizedRecords: normalizedRecords.length,
    })

    // 8. API_Meterリクエスト形式に変換
    const transformer = createDataTransformer({ logger })
    const transformResult = transformer.transform(normalizedRecords)

    logger.info('データ変換完了', {
      recordCount: transformResult.recordCount,
      tenantId: transformResult.request.tenant_id,
    })

    // 9. 外部APIへ送信（API_Meter新仕様）
    const apiUrl = `${config.EXTERNAL_API_URL}`

    logger.info('外部API送信開始', {
      url: apiUrl,
      recordCount: transformResult.recordCount,
    })

    const response = await axios.post(apiUrl, transformResult.request, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.EXTERNAL_API_TOKEN}`,
      },
      timeout: config.EXTERNAL_API_TIMEOUT_MS,
      httpsAgent,
    })

    logger.info('外部API送信完了', {
      status: response.status,
      data: response.data,
    })

    // 結果サマリー
    const startDate = periodRange.startDate.toISOString().split('T')[0]
    const endDate = periodRange.endDate.toISOString().split('T')[0]
    console.log('\n=== 実行結果サマリー ===')
    console.log(`取得期間: ${startDate} 〜 ${endDate}`)
    console.log(`取得レコード数（ノード実行）: ${fetchResult.records.length}`)
    console.log(`集計周期: daily (API_Meter形式)`)
    console.log(`集計後レコード数: ${aggregationResult.modelRecords.length}`)
    console.log(`正規化後レコード数: ${normalizedRecords.length}`)
    console.log(`送信レコード数: ${transformResult.recordCount}`)
    console.log(`Tenant ID: ${config.API_METER_TENANT_ID}`)
    console.log(`送信ステータス: ${response.status}`)
    if (response.data) {
      console.log(`レスポンス: ${JSON.stringify(response.data)}`)
    }
    console.log('\n=== 完了 ===')
  } catch (error) {
    const err = error as Error & { response?: { status: number; data: unknown } }
    logger.error('実行エラー', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    })
    console.error('\n✗ エラー:', err.message)
    if (err.response) {
      console.error('  ステータス:', err.response.status)
      console.error('  レスポンス:', JSON.stringify(err.response.data, null, 2))
    }
    process.exit(1)
  }
}

runOnce()
