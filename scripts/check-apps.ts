/**
 * アプリ一覧確認スクリプト
 */

import dotenv from 'dotenv'
import { loadConfig } from '../src/config/env-config.js'
import { createDifyApiClient } from '../src/fetcher/dify-api-client.js'
import { createLogger } from '../src/logger/winston-logger.js'

dotenv.config()

async function main() {
  const config = loadConfig()
  const logger = createLogger({ logLevel: 'debug' })

  const difyClient = createDifyApiClient({ config, logger })

  console.log('=== アプリ一覧確認 ===\n')

  const apps = await difyClient.fetchApps()

  console.log('アプリ一覧:')
  for (const app of apps) {
    console.log(`  - ID: ${app.id}`)
    console.log(`    Name: ${app.name}`)
    console.log(`    Mode: ${app.mode}`)
    console.log()
  }
}

main().catch(console.error)
