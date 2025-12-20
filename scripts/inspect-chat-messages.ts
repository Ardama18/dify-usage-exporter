/**
 * チャットメッセージの構造を調査するスクリプト
 * advanced-chat アプリからモデル情報が取得できるか確認
 */

import dotenv from 'dotenv'
import { loadConfig } from '../src/config/env-config.js'
import { createDifyApiClient } from '../src/fetcher/dify-api-client.js'
import { createLogger } from '../src/logger/winston-logger.js'

dotenv.config()

async function main() {
  console.log('=== チャットメッセージ構造調査 ===\n')

  const config = loadConfig()
  const logger = createLogger({ logLevel: 'debug' })
  const difyClient = createDifyApiClient({ config, logger })

  try {
    // 1. アプリ一覧取得
    const apps = await difyClient.fetchApps()
    console.log('\n=== アプリ一覧 ===')
    for (const app of apps) {
      console.log(`  ${app.name} (${app.mode}) - ${app.id}`)
    }

    // 2. advanced-chat または chat アプリを探す
    const chatApps = apps.filter(
      (app) => app.mode === 'advanced-chat' || app.mode === 'chat' || app.mode === 'agent-chat'
    )

    if (chatApps.length === 0) {
      console.log('\nチャット系アプリが見つかりません')
      return
    }

    console.log(`\n=== チャット系アプリ: ${chatApps.length}件 ===`)

    // 期間設定（今月）
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startTimestamp = Math.floor(startOfMonth.getTime() / 1000)
    const endTimestamp = Math.floor(now.getTime() / 1000)

    for (const app of chatApps) {
      console.log(`\n--- ${app.name} (${app.mode}) ---`)

      // 3. 会話一覧を取得
      const conversations = await difyClient.fetchConversations({
        appId: app.id,
        start: startTimestamp,
        end: endTimestamp,
        limit: 5,
      })

      console.log(`会話数: ${conversations.length}`)

      if (conversations.length === 0) {
        continue
      }

      // 4. 最初の会話のメッセージを取得
      const conv = conversations[0]
      console.log(`\n会話ID: ${conv.id}`)
      console.log(`会話作成日時: ${new Date(conv.created_at * 1000).toISOString()}`)

      const messages = await difyClient.fetchMessages({
        appId: app.id,
        conversationId: conv.id,
        limit: 3,
      })

      console.log(`メッセージ数: ${messages.length}`)

      // 5. メッセージの完全な構造を表示
      if (messages.length > 0) {
        console.log('\n=== メッセージ構造 ===')
        for (const msg of messages.slice(0, 2)) {
          console.log(`\nメッセージID: ${msg.id}`)
          console.log(`message_tokens: ${msg.message_tokens}`)
          console.log(`answer_tokens: ${msg.answer_tokens}`)
          console.log(`query: ${msg.query?.substring(0, 50)}...`)
          console.log(`answer長さ: ${msg.answer?.length || 0}文字`)

          // workflow_run_id があれば、ノード詳細を取得してみる
          const workflowRunId = (msg as any).workflow_run_id
          if (workflowRunId) {
            console.log(`\n>>> workflow_run_id: ${workflowRunId}`)
            console.log('>>> ノード詳細を取得中...')

            try {
              const nodes = await difyClient.fetchNodeExecutions({
                appId: app.id,
                workflowRunId: workflowRunId,
              })

              console.log(`>>> ノード数: ${nodes.length}`)

              const llmNodes = nodes.filter((n) => n.node_type === 'llm')
              console.log(`>>> LLMノード数: ${llmNodes.length}`)

              if (llmNodes.length > 0) {
                console.log('\n=== advanced-chat の LLMノード詳細 ===')
                for (const llmNode of llmNodes) {
                  console.log(`\nノードタイトル: ${llmNode.title}`)
                  if (llmNode.process_data) {
                    console.log(`  model_provider: ${llmNode.process_data.model_provider}`)
                    console.log(`  model_name: ${llmNode.process_data.model_name}`)
                    if (llmNode.process_data.usage) {
                      const usage = llmNode.process_data.usage
                      console.log(`  prompt_tokens: ${usage.prompt_tokens}`)
                      console.log(`  completion_tokens: ${usage.completion_tokens}`)
                      console.log(`  total_tokens: ${usage.total_tokens}`)
                      console.log(`  prompt_price: ${usage.prompt_price}`)
                      console.log(`  completion_price: ${usage.completion_price}`)
                      console.log(`  total_price: ${usage.total_price}`)
                      console.log(`  currency: ${usage.currency}`)
                    }
                  }
                }
              }
            } catch (nodeError) {
              console.log(`>>> ノード詳細取得エラー: ${nodeError}`)
            }
          }
        }
      }
    }

    // 6. workflow アプリも確認
    const workflowApps = apps.filter((app) => app.mode === 'workflow')
    if (workflowApps.length > 0) {
      console.log('\n=== Workflow アプリ確認 ===')
      for (const app of workflowApps) {
        console.log(`\n--- ${app.name} (${app.mode}) ---`)

        const runs = await difyClient.fetchWorkflowRuns({
          appId: app.id,
          start: startTimestamp,
          end: endTimestamp,
          limit: 3,
        })

        console.log(`ワークフロー実行数: ${runs.length}`)

        if (runs.length > 0) {
          const run = runs[0]
          console.log(`実行ID: ${run.id}`)

          const nodes = await difyClient.fetchNodeExecutions({
            appId: app.id,
            workflowRunId: run.id,
          })

          console.log(`ノード数: ${nodes.length}`)

          const llmNodes = nodes.filter((n) => n.node_type === 'llm')
          console.log(`LLMノード数: ${llmNodes.length}`)

          if (llmNodes.length > 0) {
            console.log('\n=== LLMノード構造 ===')
            console.log(JSON.stringify(llmNodes[0], null, 2))
          }
        }
      }
    }

    console.log('\n=== 調査完了 ===')
  } catch (error) {
    console.error('エラー:', error)
    process.exit(1)
  }
}

main()
