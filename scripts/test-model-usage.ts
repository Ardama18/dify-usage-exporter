/**
 * モデル別使用量取得テストスクリプト
 *
 * 実行方法:
 * npx tsx scripts/test-model-usage.ts
 */

import dotenv from 'dotenv'
import { loadConfig } from '../src/config/env-config.js'
import { createDifyApiClient } from '../src/fetcher/dify-api-client.js'
import { createModelUsageFetcher } from '../src/fetcher/model-usage-fetcher.js'
import { createLogger } from '../src/logger/winston-logger.js'

// 環境変数読み込み
dotenv.config()

async function main() {
  console.log('=== モデル別使用量取得テスト ===\n')

  // 設定読み込み
  const config = loadConfig()
  const logger = createLogger({ logLevel: config.LOG_LEVEL })

  // Dify APIクライアント作成
  const difyClient = createDifyApiClient({ config, logger })

  // モデル別Fetcher作成
  const modelUsageFetcher = createModelUsageFetcher({ difyClient, logger })

  // 期間設定（今月）
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const startTimestamp = Math.floor(startOfMonth.getTime() / 1000)
  const endTimestamp = Math.floor(endOfMonth.getTime() / 1000)

  console.log(`期間: ${startOfMonth.toISOString().split('T')[0]} ~ ${endOfMonth.toISOString().split('T')[0]}`)
  console.log()

  try {
    // モデル別使用量を取得
    console.log('データ取得中...')
    const result = await modelUsageFetcher.fetch({
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

    // レコードサンプル表示
    if (result.records.length > 0) {
      console.log('\n=== レコードサンプル（最大3件）===')
      for (const record of result.records.slice(0, 3)) {
        console.log(`\n--- ${record.date} ---`)
        console.log(`  アプリ: ${record.app_name}`)
        console.log(`  ノード: ${record.node_title}`)
        console.log(`  ユーザー: ${record.user_id.substring(0, 10)}... (${record.user_type})`)
        console.log(`  モデル: ${record.model_name} (${record.model_provider})`)
        console.log(`  トークン: prompt=${record.prompt_tokens}, completion=${record.completion_tokens}, total=${record.total_tokens}`)
        console.log(`  価格: $${record.total_price.toFixed(6)} (prompt=$${record.prompt_price.toFixed(6)}, completion=$${record.completion_price.toFixed(6)})`)
      }
    }

    // サマリー表示
    if (result.summaries.length > 0) {
      console.log('\n=== ユーザー・モデル別サマリー ===')
      console.log('| ユーザーID | タイプ | モデル | アプリ | トークン | 価格(USD) | 実行回数 |')
      console.log('|------------|--------|--------|--------|----------|-----------|----------|')
      for (const summary of result.summaries) {
        console.log(
          `| ${summary.user_id.substring(0, 10)}... | ${summary.user_type} | ${summary.model_name} | ${summary.app_name.substring(0, 10)} | ${summary.total_tokens} | $${summary.total_price.toFixed(4)} | ${summary.execution_count} |`
        )
      }

      // ユーザー別合計
      console.log('\n=== ユーザー別合計コスト ===')
      const userTotals = new Map<string, { tokens: number; price: number; type: string }>()
      for (const summary of result.summaries) {
        const existing = userTotals.get(summary.user_id)
        if (existing) {
          existing.tokens += summary.total_tokens
          existing.price += summary.total_price
        } else {
          userTotals.set(summary.user_id, {
            tokens: summary.total_tokens,
            price: summary.total_price,
            type: summary.user_type,
          })
        }
      }
      for (const [userId, totals] of userTotals) {
        console.log(`  ${userId.substring(0, 10)}... (${totals.type}): ${totals.tokens} tokens, $${totals.price.toFixed(4)}`)
      }

      // モデル別合計
      console.log('\n=== モデル別合計コスト ===')
      const modelTotals = new Map<string, { tokens: number; price: number; executions: number }>()
      for (const summary of result.summaries) {
        const key = summary.model_name
        const existing = modelTotals.get(key)
        if (existing) {
          existing.tokens += summary.total_tokens
          existing.price += summary.total_price
          existing.executions += summary.execution_count
        } else {
          modelTotals.set(key, {
            tokens: summary.total_tokens,
            price: summary.total_price,
            executions: summary.execution_count,
          })
        }
      }
      for (const [model, totals] of modelTotals) {
        console.log(`  ${model}: ${totals.tokens} tokens, $${totals.price.toFixed(4)} (${totals.executions}回)`)
      }
    }

    console.log('\n=== テスト完了 ===')
  } catch (error) {
    console.error('エラー発生:', error)
    process.exit(1)
  }
}

main()
