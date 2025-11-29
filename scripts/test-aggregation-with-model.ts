/**
 * モデル別集計の統合テスト
 */

import dotenv from 'dotenv'
import { loadConfig } from '../src/config/env-config.js'
import { createDifyApiClient } from '../src/fetcher/dify-api-client.js'
import { createModelUsageFetcher } from '../src/fetcher/model-usage-fetcher.js'
import { createLogger } from '../src/logger/winston-logger.js'
import {
  aggregateUsageData,
  type RawModelUsageRecord,
} from '../src/aggregator/usage-aggregator.js'

dotenv.config()

async function main() {
  console.log('=== モデル別集計 統合テスト ===\n')

  const config = loadConfig()
  const logger = createLogger({ logLevel: config.LOG_LEVEL })
  const difyClient = createDifyApiClient({ config, logger })
  const modelUsageFetcher = createModelUsageFetcher({ difyClient, logger })

  // 今月の期間
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  console.log(`期間: ${startOfMonth.toISOString().split('T')[0]} ~ ${endOfMonth.toISOString().split('T')[0]}\n`)

  // 1. モデル別使用量取得
  console.log('1. モデル別使用量取得中...')
  const modelResult = await modelUsageFetcher.fetch({
    startTimestamp: Math.floor(startOfMonth.getTime() / 1000),
    endTimestamp: Math.floor(endOfMonth.getTime() / 1000),
  })

  console.log(`   取得レコード数: ${modelResult.records.length}`)

  // 2. RawModelUsageRecordに変換
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

  // 3. 集計テスト (per_model モード)
  console.log('\n2. per_model モードで集計...')
  const aggregationResult = aggregateUsageData(
    [], // appRecordsは空
    'monthly',
    'per_model',
    undefined, // userRecords
    rawModelRecords
  )

  console.log(`   modelRecords: ${aggregationResult.modelRecords.length}`)
  console.log(`   appRecords: ${aggregationResult.appRecords.length}`)
  console.log(`   workspaceRecords: ${aggregationResult.workspaceRecords.length}`)

  // 4. 結果表示
  if (aggregationResult.modelRecords.length > 0) {
    console.log('\n=== モデル別集計結果 ===')
    console.log('| 期間 | ユーザーID | モデル | トークン | 価格(USD) | 実行回数 |')
    console.log('|------|------------|--------|----------|-----------|----------|')
    for (const record of aggregationResult.modelRecords) {
      console.log(
        `| ${record.period} | ${record.user_id.substring(0, 8)}... | ${record.model_name} | ${record.total_tokens} | $${record.total_price} | ${record.execution_count} |`
      )
    }
  }

  // 5. 外部API送信用ペイロード確認
  console.log('\n=== 外部API送信ペイロード ===')
  const payload = {
    aggregation_period: 'monthly',
    output_mode: 'per_model',
    fetch_period: {
      start: modelResult.startDate,
      end: modelResult.endDate,
    },
    model_records: aggregationResult.modelRecords,
  }
  console.log(JSON.stringify(payload, null, 2))

  console.log('\n=== テスト完了 ===')
}

main().catch(console.error)
