/**
 * 手動実行スクリプト
 * Difyからデータを取得し、集計して外部APIへ送信する
 */
import dotenv from 'dotenv'
dotenv.config()

import https from 'node:https'
import axios from 'axios'
import { aggregateUsageData, type RawTokenCostRecord } from '../src/aggregator/usage-aggregator.js'
import { loadConfig } from '../src/config/env-config.js'
import { createDifyApiClient } from '../src/fetcher/dify-api-client.js'
import { createDifyUsageFetcher, type FetchedTokenCostRecord } from '../src/fetcher/dify-usage-fetcher.js'
import { createLogger } from '../src/logger/winston-logger.js'
import { createWatermarkManager } from '../src/watermark/watermark-manager.js'

// IPv4を優先するエージェント（IPv6接続問題の回避）
const httpsAgent = new https.Agent({
  family: 4,
})

async function runOnce() {
  console.log('=== Dify Usage Exporter 手動実行 ===\n')

  const config = loadConfig()
  const logger = createLogger(config)

  logger.info('実行開始', {
    difyApiUrl: config.DIFY_API_BASE_URL,
    externalApiUrl: config.EXTERNAL_API_URL,
    fetchPeriod: config.DIFY_FETCH_PERIOD,
    aggregationPeriod: config.DIFY_AGGREGATION_PERIOD,
    outputMode: config.DIFY_OUTPUT_MODE,
  })

  try {
    // 1. Dify APIクライアント作成
    const difyClient = createDifyApiClient({ config, logger })

    // 2. Watermarkマネージャー作成
    const watermarkManager = createWatermarkManager({
      config,
      logger,
    })

    // 3. Fetcher作成
    const fetcher = createDifyUsageFetcher({
      config,
      logger,
      client: difyClient,
      watermarkManager,
    })

    // 4. データ取得
    logger.info('データ取得開始')
    let allRecords: FetchedTokenCostRecord[] = []

    const fetchResult = await fetcher.fetch(async (records) => {
      allRecords = allRecords.concat(records)
    })

    if (!fetchResult.success) {
      logger.error('データ取得失敗', { errors: fetchResult.errors })
      process.exit(1)
    }

    logger.info('データ取得完了', {
      recordCount: allRecords.length,
      durationMs: fetchResult.durationMs,
      startDate: fetchResult.startDate,
      endDate: fetchResult.endDate,
    })

    if (allRecords.length === 0) {
      logger.info('送信するデータがありません')
      console.log('\n=== 完了（データなし）===')
      return
    }

    // 5. データ集計
    logger.info('データ集計開始')
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
      config.DIFY_OUTPUT_MODE
    )

    logger.info('データ集計完了', {
      appRecords: aggregationResult.appRecords.length,
      workspaceRecords: aggregationResult.workspaceRecords.length,
    })

    const totalAggregatedRecords =
      aggregationResult.appRecords.length + aggregationResult.workspaceRecords.length

    if (totalAggregatedRecords === 0) {
      logger.info('送信するデータがありません（集計後）')
      console.log('\n=== 完了（集計後データなし）===')
      return
    }

    // 6. 外部APIへ送信
    const payload = {
      aggregation_period: config.DIFY_AGGREGATION_PERIOD,
      output_mode: config.DIFY_OUTPUT_MODE,
      fetch_period: {
        start: fetchResult.startDate,
        end: fetchResult.endDate,
      },
      app_records: aggregationResult.appRecords,
      workspace_records: aggregationResult.workspaceRecords,
    }

    logger.info('外部API送信開始', {
      url: config.EXTERNAL_API_URL,
      appRecordCount: aggregationResult.appRecords.length,
      workspaceRecordCount: aggregationResult.workspaceRecords.length,
    })

    const response = await axios.post(config.EXTERNAL_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.EXTERNAL_API_TOKEN}`,
      },
      timeout: config.EXTERNAL_API_TIMEOUT_MS,
      httpsAgent,
    })

    logger.info('外部API送信完了', {
      status: response.status,
    })

    // 結果サマリー
    console.log('\n=== 実行結果サマリー ===')
    console.log(`取得期間: ${fetchResult.startDate} 〜 ${fetchResult.endDate}`)
    console.log(`取得レコード数（日別）: ${allRecords.length}`)
    console.log(`集計周期: ${config.DIFY_AGGREGATION_PERIOD}`)
    console.log(`出力モード: ${config.DIFY_OUTPUT_MODE}`)
    console.log(`アプリ別レコード数: ${aggregationResult.appRecords.length}`)
    console.log(`ワークスペース合計レコード数: ${aggregationResult.workspaceRecords.length}`)
    console.log(`送信ステータス: ${response.status}`)
    console.log('\n=== 完了 ===')
  } catch (error) {
    const err = error as Error & { response?: { status: number; data: unknown } }
    logger.error('実行エラー', {
      message: err.message,
      status: err.response?.status,
    })
    console.error('\n✗ エラー:', err.message)
    if (err.response) {
      console.error('  ステータス:', err.response.status)
    }
    process.exit(1)
  }
}

runOnce()
