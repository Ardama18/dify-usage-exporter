import dotenv from 'dotenv'
dotenv.config()

import { loadConfig } from '../src/config/env-config.js'
import { createLogger } from '../src/logger/winston-logger.js'
import { createDifyApiClient } from '../src/fetcher/dify-api-client.js'

async function testConnection() {
  console.log('=== Dify API 接続テスト ===\n')

  try {
    const config = loadConfig()
    console.log('✓ 設定読み込み成功')
    console.log('  - DIFY_API_BASE_URL:', config.DIFY_API_BASE_URL)
    console.log('  - DIFY_EMAIL:', config.DIFY_EMAIL)
    console.log('')

    const logger = createLogger(config)
    const client = createDifyApiClient({ config, logger })

    console.log('アプリ一覧を取得中...')
    const apps = await client.fetchApps()
    console.log('✓ アプリ一覧取得成功')
    console.log('  - 取得したアプリ数:', apps.length)

    if (apps.length > 0) {
      console.log('  - アプリ一覧:')
      apps.slice(0, 5).forEach((app, i) => {
        console.log(`    ${i + 1}. ${app.name} (ID: ${app.id}, mode: ${app.mode})`)
      })
      if (apps.length > 5) {
        console.log(`    ... 他 ${apps.length - 5} 件`)
      }

      // 最初のアプリのtoken-costsを取得
      console.log('')
      console.log(`トークンコスト取得中 (アプリ: ${apps[0].name})...`)

      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)

      const costs = await client.fetchAppTokenCosts({
        appId: apps[0].id,
        start: startDate.toISOString().split('T')[0] + ' 00:00',
        end: endDate.toISOString().split('T')[0] + ' 23:59',
      })

      console.log('✓ トークンコスト取得成功')
      console.log('  - レコード数:', costs.data.length)
      if (costs.data.length > 0) {
        console.log('  - サンプル:', JSON.stringify(costs.data[0], null, 2))
      }
    }

    console.log('')
    console.log('=== 接続テスト完了 ===')
  } catch (error) {
    console.error('✗ エラー発生:', (error as Error).message)
    const err = error as { response?: { status: number; data: unknown } }
    if (err.response) {
      console.error('  - ステータス:', err.response.status)
      console.error('  - データ:', JSON.stringify(err.response.data, null, 2))
    }
    process.exit(1)
  }
}

testConnection()
