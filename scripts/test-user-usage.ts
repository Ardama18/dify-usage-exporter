/**
 * ユーザー別使用量取得テストスクリプト
 *
 * 実行方法:
 * npx tsx scripts/test-user-usage.ts
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

// 環境変数読み込み
dotenv.config()

async function main() {
  console.log('=== ユーザー別使用量取得テスト ===\n')

  // 設定読み込み
  const config = loadConfig()
  const logger = createLogger({ logLevel: config.LOG_LEVEL })

  // Dify APIクライアント作成
  const difyClient = createDifyApiClient({ config, logger })

  // ユーザー別Fetcher作成
  const userUsageFetcher = createUserUsageFetcher({ difyClient, logger })

  // 期間設定（今月）
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const startTimestamp = Math.floor(startOfMonth.getTime() / 1000)
  const endTimestamp = Math.floor(endOfMonth.getTime() / 1000)

  console.log(`期間: ${startOfMonth.toISOString().split('T')[0]} ~ ${endOfMonth.toISOString().split('T')[0]}`)
  console.log()

  try {
    // ユーザー別使用量を取得
    console.log('データ取得中...')
    const result = await userUsageFetcher.fetch({
      startTimestamp,
      endTimestamp,
    })

    console.log('\n=== 取得結果 ===')
    console.log(`成功: ${result.success}`)
    console.log(`レコード数: ${result.records.length}`)
    console.log(`サマリー数: ${result.summaries.length}`)
    console.log(`エラー数: ${result.errors.length}`)

    if (result.errors.length > 0) {
      console.log('\nエラー一覧:')
      for (const error of result.errors) {
        console.log(`  - ${error}`)
      }
    }

    // サマリー表示
    if (result.summaries.length > 0) {
      console.log('\n=== ユーザー別サマリー ===')
      console.log('| ユーザーID | タイプ | アプリ名 | 入力トークン | 出力トークン | 合計 | メッセージ数 | 会話数 |')
      console.log('|------------|--------|----------|--------------|--------------|------|--------------|--------|')
      for (const summary of result.summaries) {
        console.log(
          `| ${summary.user_id.substring(0, 10)}... | ${summary.user_type} | ${summary.app_name.substring(0, 10)} | ${summary.total_message_tokens} | ${summary.total_answer_tokens} | ${summary.total_tokens} | ${summary.message_count} | ${summary.conversation_count} |`
        )
      }
    }

    // aggregatorでの集計テスト
    if (result.records.length > 0) {
      console.log('\n=== 月次集計テスト ===')

      // RawUserUsageRecordに変換
      const rawUserRecords: RawUserUsageRecord[] = result.records.map((r) => ({
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

      // per_userモードで集計
      const aggregationResult = aggregateUsageData(
        [], // トークンコストレコードは空
        'monthly',
        'per_user',
        rawUserRecords
      )

      console.log(`ユーザー別集計レコード数: ${aggregationResult.userRecords.length}`)

      if (aggregationResult.userRecords.length > 0) {
        console.log('\n集計結果サンプル:')
        for (const record of aggregationResult.userRecords.slice(0, 5)) {
          console.log(JSON.stringify(record, null, 2))
        }
      }
    }

    console.log('\n=== テスト完了 ===')
  } catch (error) {
    console.error('エラー発生:', error)
    process.exit(1)
  }
}

main()
