import dotenv from 'dotenv'
dotenv.config()

import axios from 'axios'
import https from 'node:https'
import { loadConfig } from '../src/config/env-config.js'

// IPv4を優先するエージェント
const httpsAgent = new https.Agent({
  family: 4, // IPv4のみ
})

async function testExternalApi() {
  console.log('=== 外部API 通信テスト ===\n')

  try {
    const config = loadConfig()
    console.log('✓ 設定読み込み成功')
    console.log('  - EXTERNAL_API_URL:', config.EXTERNAL_API_URL)
    console.log('  - EXTERNAL_API_TOKEN:', config.EXTERNAL_API_TOKEN ? '***設定済み***' : '未設定')
    console.log('')

    // テストデータを作成
    const testRecords = [
      {
        date: '2025-11-29',
        app_id: 'test-app-001',
        app_name: 'テストアプリ1',
        token_count: 1000,
        total_price: '0.01',
        currency: 'USD',
        idempotency_key: '2025-11-29_test-app-001',
        transformed_at: new Date().toISOString(),
      },
      {
        date: '2025-11-29',
        app_id: 'test-app-002',
        app_name: 'テストアプリ2',
        token_count: 2500,
        total_price: '0.025',
        currency: 'USD',
        idempotency_key: '2025-11-29_test-app-002',
        transformed_at: new Date().toISOString(),
      },
    ]

    console.log('テストデータ送信中...')
    console.log('  - レコード数:', testRecords.length)
    console.log('  - 送信データ:')
    console.log(JSON.stringify(testRecords, null, 2))
    console.log('')

    const response = await axios.post(
      config.EXTERNAL_API_URL,
      { records: testRecords },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.EXTERNAL_API_TOKEN}`,
        },
        timeout: config.EXTERNAL_API_TIMEOUT_MS,
        httpsAgent,
      },
    )

    console.log('✓ 送信完了')
    console.log('  - ステータス:', response.status)
    console.log('  - レスポンス:', JSON.stringify(response.data, null, 2))

    console.log('')
    console.log('=== 外部API通信テスト完了 ===')
    console.log('')
    console.log('webhook.siteで受信データを確認してください:')
    console.log(`  ${config.EXTERNAL_API_URL.replace('webhook.site/', 'webhook.site/#!/view/')}`)
  } catch (error) {
    const err = error as Error & { response?: { status: number; data: unknown }; code?: string }
    console.error('✗ エラー発生:', err.message)
    console.error('  - エラー名:', err.name)
    if (err.code) {
      console.error('  - エラーコード:', err.code)
    }
    if (err.response) {
      console.error('  - ステータス:', err.response.status)
      console.error('  - データ:', JSON.stringify(err.response.data, null, 2))
    }
    console.error('  - スタック:', err.stack)
    process.exit(1)
  }
}

testExternalApi()
