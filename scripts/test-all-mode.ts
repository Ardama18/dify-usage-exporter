/**
 * all モードの統合テスト
 */

import dotenv from 'dotenv'
import axios from 'axios'
import https from 'node:https'
import { loadConfig } from '../src/config/env-config.js'
import { createDifyApiClient } from '../src/fetcher/dify-api-client.js'
import { createDifyUsageFetcher, type FetchedTokenCostRecord } from '../src/fetcher/dify-usage-fetcher.js'
import { createModelUsageFetcher } from '../src/fetcher/model-usage-fetcher.js'
import { createUserUsageFetcher } from '../src/fetcher/user-usage-fetcher.js'
import { createWatermarkManager } from '../src/watermark/watermark-manager.js'
import { createLogger } from '../src/logger/winston-logger.js'
import {
  aggregateUsageData,
  type RawTokenCostRecord,
  type RawUserUsageRecord,
  type RawModelUsageRecord,
} from '../src/aggregator/usage-aggregator.js'
import { calculateDateRange } from '../src/utils/period-calculator.js'

dotenv.config()

const httpsAgent = new https.Agent({ family: 4 })

async function main() {
  console.log('=== all モード 統合テスト ===\n')

  const config = loadConfig()
  const logger = createLogger({ logLevel: config.LOG_LEVEL })
  const difyClient = createDifyApiClient({ config, logger })
  const watermarkManager = createWatermarkManager({ config, logger })
  const fetcher = createDifyUsageFetcher({ config, logger, client: difyClient, watermarkManager })
  const modelUsageFetcher = createModelUsageFetcher({ difyClient, logger })
  const userUsageFetcher = createUserUsageFetcher({ difyClient, logger })

  // 期間計算
  const periodRange = calculateDateRange(
    config.DIFY_FETCH_PERIOD,
    config.DIFY_FETCH_START_DATE,
    config.DIFY_FETCH_END_DATE
  )
  const startStr = periodRange.startDate.toISOString().split('T')[0]
  const endStr = periodRange.endDate.toISOString().split('T')[0]
  console.log(`期間: ${startStr} ~ ${endStr}\n`)

  // 1. アプリ別トークンコスト取得
  console.log('1. アプリ別トークンコスト取得中...')
  let allRecords: FetchedTokenCostRecord[] = []
  const fetchResult = await fetcher.fetch(async (records) => {
    allRecords = allRecords.concat(records)
  })
  console.log(`   取得レコード数: ${allRecords.length}`)

  // 2. ユーザー別使用量取得
  console.log('\n2. ユーザー別使用量取得中...')
  const userResult = await userUsageFetcher.fetch({
    startTimestamp: Math.floor(periodRange.startDate.getTime() / 1000),
    endTimestamp: Math.floor(periodRange.endDate.getTime() / 1000),
  })
  console.log(`   取得レコード数: ${userResult.records.length}`)

  // 3. モデル別使用量取得
  console.log('\n3. モデル別使用量取得中...')
  const modelResult = await modelUsageFetcher.fetch({
    startTimestamp: Math.floor(periodRange.startDate.getTime() / 1000),
    endTimestamp: Math.floor(periodRange.endDate.getTime() / 1000),
  })
  console.log(`   取得レコード数: ${modelResult.records.length}`)

  // 4. データ変換
  const rawRecords: RawTokenCostRecord[] = allRecords.map((r) => ({
    date: r.date,
    app_id: r.app_id,
    app_name: r.app_name,
    token_count: r.token_count,
    total_price: r.total_price,
    currency: r.currency,
  }))

  const rawUserRecords: RawUserUsageRecord[] = userResult.records.map((r) => ({
    date: r.date,
    user_id: r.user_id,
    user_type: r.user_type,
    app_id: r.app_id,
    app_name: r.app_name,
    message_tokens: r.message_tokens,
    answer_tokens: r.answer_tokens,
    total_tokens: r.total_tokens,
    conversation_id: r.conversation_id,
  }))

  const rawModelRecords: RawModelUsageRecord[] = modelResult.records.map((r) => ({
    date: r.date,
    user_id: r.user_id,
    user_type: r.user_type,
    app_id: r.app_id,
    app_name: r.app_name,
    model_provider: r.model_provider,
    model_name: r.model_name,
    prompt_tokens: r.prompt_tokens,
    completion_tokens: r.completion_tokens,
    total_tokens: r.total_tokens,
    prompt_price: r.prompt_price,
    completion_price: r.completion_price,
    total_price: r.total_price,
    currency: r.currency,
  }))

  // 5. 集計（all モード）
  console.log('\n4. all モードで集計...')
  const aggregationResult = aggregateUsageData(
    rawRecords,
    'monthly',
    'all',
    rawUserRecords,
    rawModelRecords
  )

  console.log(`   appRecords: ${aggregationResult.appRecords.length}`)
  console.log(`   workspaceRecords: ${aggregationResult.workspaceRecords.length}`)
  console.log(`   userRecords: ${aggregationResult.userRecords.length}`)
  console.log(`   modelRecords: ${aggregationResult.modelRecords.length}`)

  // 6. ペイロード構築
  const payload: Record<string, unknown> = {
    aggregation_period: 'monthly',
    output_mode: 'all',
    fetch_period: {
      start: fetchResult.startDate,
      end: fetchResult.endDate,
    },
  }

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

  console.log('\n=== 外部API送信ペイロード ===')
  console.log(JSON.stringify(payload, null, 2))

  // 7. 外部APIへ送信
  console.log('\n5. 外部APIへ送信中...')
  console.log(`   URL: ${config.EXTERNAL_API_URL}`)

  try {
    const response = await axios.post(config.EXTERNAL_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.EXTERNAL_API_TOKEN}`,
      },
      timeout: config.EXTERNAL_API_TIMEOUT_MS,
      httpsAgent,
    })

    console.log(`   ステータス: ${response.status}`)
    console.log('\n=== テスト完了（成功） ===')
  } catch (error) {
    const err = error as Error
    console.log(`   エラー: ${err.message}`)
    console.log('\n=== テスト完了（送信エラー） ===')
  }
}

main().catch(console.error)
