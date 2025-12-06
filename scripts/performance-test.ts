/**
 * パフォーマンステストスクリプト
 *
 * 正規化層・変換層のパフォーマンス測定を実施します。
 * 合格基準:
 * - 1000レコード/秒以上の処理速度
 * - 正規化層の処理時間が1ms未満
 *
 * 実行方法:
 * npm run test:performance
 */

import dotenv from 'dotenv'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import type { AggregatedModelRecord } from '../src/aggregator/usage-aggregator.js'
import { createLogger } from '../src/logger/winston-logger.js'
import { createNormalizer } from '../src/normalizer/normalizer.js'
import { createDataTransformer } from '../src/transformer/data-transformer.js'

// 環境変数読み込み
dotenv.config()

// パフォーマンステスト用の最小限の環境変数設定
process.env.API_METER_TENANT_ID = process.env.API_METER_TENANT_ID || '00000000-0000-0000-0000-000000000000'
process.env.API_METER_TOKEN = process.env.API_METER_TOKEN || 'test-token'
process.env.API_METER_URL = process.env.API_METER_URL || 'https://api-meter.example.com'
process.env.DIFY_API_URL = process.env.DIFY_API_URL || 'https://dify.example.com'
process.env.DIFY_CONSOLE_USER_EMAIL = process.env.DIFY_CONSOLE_USER_EMAIL || 'test@example.com'
process.env.DIFY_CONSOLE_USER_PASSWORD = process.env.DIFY_CONSOLE_USER_PASSWORD || 'test-password'
process.env.DIFY_WORKSPACE_ID = process.env.DIFY_WORKSPACE_ID || 'test-workspace-id'

/**
 * テストデータ生成
 *
 * @param count 生成するレコード数
 * @returns AggregatedModelRecord配列
 */
function generateTestData(count: number): AggregatedModelRecord[] {
  const records: AggregatedModelRecord[] = []
  const providers = ['openai', 'anthropic', 'google', 'cohere']
  const models = ['gpt-4', 'claude-3-opus', 'gemini-pro', 'command-r-plus']
  const userTypes: Array<'end_user' | 'account'> = ['end_user', 'account']

  for (let i = 0; i < count; i++) {
    const providerIdx = i % providers.length
    const modelIdx = i % models.length

    const promptTokens = 100 + (i % 900)
    const completionTokens = 50 + (i % 450)
    const totalTokens = promptTokens + completionTokens

    records.push({
      period: '2025-12-06',
      period_type: 'daily',
      user_id: `user_${i % 100}`,
      user_type: userTypes[i % 2],
      app_id: `app_${i % 10}`,
      app_name: `Test App ${i % 10}`,
      model_provider: providers[providerIdx],
      model_name: models[modelIdx],
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      prompt_price: '0.0001',
      completion_price: '0.0002',
      total_price: '0.0003',
      currency: 'USD',
      execution_count: 1 + (i % 10),
    })
  }

  return records
}

/**
 * パフォーマンステストを実行
 */
async function runPerformanceTest(): Promise<void> {
  console.log('=== パフォーマンステスト開始 ===\n')

  const logger = createLogger({ logLevel: 'error' }) // パフォーマンステスト中はエラーのみログ出力
  const recordCounts = [100, 300, 500]
  let allTestsPassed = true

  // ウォームアップ（初回実行のオーバーヘッドを除去）
  console.log('ウォームアップ実行中...')
  const warmupData = generateTestData(50)
  const warmupNormalizer = createNormalizer(logger)
  warmupNormalizer.normalize(warmupData)
  const warmupTransformer = createDataTransformer({ logger })
  warmupTransformer.transform(warmupNormalizer.normalize(warmupData))
  console.log('ウォームアップ完了\n')

  for (const count of recordCounts) {
    console.log(`\n=== ${count}レコードでのテスト ===`)

    // テストデータ生成
    const testData = generateTestData(count)
    console.log(`テストデータ生成完了: ${testData.length}レコード`)

    // 正規化層のパフォーマンス測定
    const normalizeStart = performance.now()
    const normalizer = createNormalizer(logger)
    const normalized = normalizer.normalize(testData)
    const normalizeEnd = performance.now()
    const normalizeTime = normalizeEnd - normalizeStart
    const normalizeTimePerRecord = normalizeTime / count

    console.log(`正規化層: ${normalizeTime.toFixed(2)}ms (${normalizeTimePerRecord.toFixed(4)}ms/record)`)

    // 変換層のパフォーマンス測定
    const transformStart = performance.now()
    const transformer = createDataTransformer({ logger })
    const { request, recordCount } = transformer.transform(normalized)
    const transformEnd = performance.now()
    const transformTime = transformEnd - transformStart
    const transformTimePerRecord = transformTime / count

    console.log(`変換層: ${transformTime.toFixed(2)}ms (${transformTimePerRecord.toFixed(4)}ms/record)`)

    // 総処理時間とスループット
    const totalTime = normalizeTime + transformTime
    const recordsPerSecond = (count / totalTime) * 1000

    console.log(`合計処理時間: ${totalTime.toFixed(2)}ms`)
    console.log(`スループット: ${recordsPerSecond.toFixed(0)} records/second`)
    console.log(`変換後レコード数: ${recordCount}`)

    // 合格基準の検証
    console.log('\n--- 合格基準チェック ---')

    // 1. スループット: 1000レコード/秒以上
    const throughputPassed = recordsPerSecond >= 1000
    if (throughputPassed) {
      console.log(`✅ スループット: ${recordsPerSecond.toFixed(0)} >= 1000 records/second`)
    } else {
      console.error(`❌ スループット不足: ${recordsPerSecond.toFixed(0)} < 1000 records/second`)
      allTestsPassed = false
    }

    // 2. 正規化層: 1ms/record未満（レコード単位での処理時間）
    const normalizePassed = normalizeTimePerRecord < 1.0
    if (normalizePassed) {
      console.log(`✅ 正規化層処理時間（レコード単位）: ${normalizeTimePerRecord.toFixed(4)}ms/record < 1ms/record`)
    } else {
      console.error(`❌ 正規化層処理時間超過: ${normalizeTimePerRecord.toFixed(4)}ms/record >= 1ms/record`)
      allTestsPassed = false
    }

    // 3. 全体処理時間: 1秒未満（Design Doc記載の合格基準）
    const totalTimePassed = totalTime < 1000
    if (totalTimePassed) {
      console.log(`✅ 全体処理時間: ${totalTime.toFixed(2)}ms < 1000ms`)
    } else {
      console.error(`❌ 全体処理時間超過: ${totalTime.toFixed(2)}ms >= 1000ms`)
      allTestsPassed = false
    }

    // レコード検証
    if (recordCount !== count) {
      console.error(`❌ レコード数不一致: ${recordCount} !== ${count}`)
      allTestsPassed = false
    } else {
      console.log(`✅ レコード数一致: ${recordCount} === ${count}`)
    }

    // リクエスト構造検証
    if (!request.tenant_id || request.tenant_id.length === 0) {
      console.error('❌ tenant_idが設定されていません')
      allTestsPassed = false
    } else {
      console.log(`✅ tenant_id設定済み: ${request.tenant_id}`)
    }

    if (!request.export_metadata || !request.export_metadata.export_timestamp) {
      console.error('❌ export_metadataが正しく設定されていません')
      allTestsPassed = false
    } else {
      console.log('✅ export_metadata設定済み')
    }

    if (!request.records || request.records.length !== count) {
      console.error(`❌ リクエストレコード数不一致: ${request.records?.length} !== ${count}`)
      allTestsPassed = false
    } else {
      console.log(`✅ リクエストレコード数: ${request.records.length}`)
    }
  }

  console.log('\n=== パフォーマンステスト結果 ===')
  if (allTestsPassed) {
    console.log('✅ すべてのテストに合格しました')
    process.exit(0)
  } else {
    console.error('❌ 一部のテストが不合格です')
    process.exit(1)
  }
}

runPerformanceTest().catch((error) => {
  console.error('パフォーマンステスト実行エラー:', error)
  process.exit(1)
})
