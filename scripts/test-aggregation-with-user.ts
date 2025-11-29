/**
 * ユーザー別集計の統合テスト
 */

import dotenv from 'dotenv'
import { loadConfig } from '../src/config/env-config.js'
import { createDifyApiClient } from '../src/fetcher/dify-api-client.js'
import { createUserUsageFetcher } from '../src/fetcher/user-usage-fetcher.js'
import { createLogger } from '../src/logger/winston-logger.js'
import {
  aggregateUsageData,
  type RawUserUsageRecord,
} from '../src/aggregator/usage-aggregator.js'

dotenv.config()

async function main() {
  console.log('=== ユーザー別集計 統合テスト ===\n')

  const config = loadConfig()
  const logger = createLogger({ logLevel: config.LOG_LEVEL })
  const difyClient = createDifyApiClient({ config, logger })
  const userUsageFetcher = createUserUsageFetcher({ difyClient, logger })

  // 今月の期間
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  console.log(`期間: ${startOfMonth.toISOString().split('T')[0]} ~ ${endOfMonth.toISOString().split('T')[0]}\n`)

  // 1. ユーザー別使用量取得
  console.log('1. ユーザー別使用量取得中...')
  const userResult = await userUsageFetcher.fetch({
    startTimestamp: Math.floor(startOfMonth.getTime() / 1000),
    endTimestamp: Math.floor(endOfMonth.getTime() / 1000),
  })

  console.log(`   取得レコード数: ${userResult.records.length}`)

  // 2. RawUserUsageRecordに変換
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

  // 3. 集計テスト (per_user モード)
  console.log('\n2. per_user モードで集計...')
  const aggregationResult = aggregateUsageData(
    [], // appRecordsは空
    'monthly',
    'per_user',
    rawUserRecords,
    undefined // modelRecords
  )

  console.log(`   userRecords: ${aggregationResult.userRecords.length}`)
  console.log(`   appRecords: ${aggregationResult.appRecords.length}`)
  console.log(`   workspaceRecords: ${aggregationResult.workspaceRecords.length}`)

  // 4. 結果表示
  if (aggregationResult.userRecords.length > 0) {
    console.log('\n=== ユーザー別集計結果 ===')
    console.log('| 期間 | ユーザーID | アプリ | 入力 | 出力 | 合計 | メッセージ数 | 会話数 |')
    console.log('|------|------------|--------|------|------|------|--------------|--------|')
    for (const record of aggregationResult.userRecords) {
      console.log(
        `| ${record.period} | ${record.user_id.substring(0, 8)}... | ${record.app_name.substring(0, 10)} | ${record.message_tokens} | ${record.answer_tokens} | ${record.total_tokens} | ${record.message_count} | ${record.conversation_count} |`
      )
    }
  }

  // 5. 外部API送信用ペイロード確認
  console.log('\n=== 外部API送信ペイロード ===')
  const payload = {
    aggregation_period: 'monthly',
    output_mode: 'per_user',
    fetch_period: {
      start: userResult.startDate,
      end: userResult.endDate,
    },
    user_records: aggregationResult.userRecords,
  }
  console.log(JSON.stringify(payload, null, 2))

  console.log('\n=== テスト完了 ===')
}

main().catch(console.error)
