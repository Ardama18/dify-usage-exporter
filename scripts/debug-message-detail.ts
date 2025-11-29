/**
 * メッセージ詳細調査スクリプト
 * モデル情報・価格情報が取得可能か確認
 */

import axios from 'axios'
import { wrapper } from 'axios-cookiejar-support'
import { CookieJar } from 'tough-cookie'
import dotenv from 'dotenv'

dotenv.config()

async function main() {
  const baseUrl = process.env.DIFY_API_BASE_URL || 'http://localhost'
  const email = process.env.DIFY_EMAIL
  const password = process.env.DIFY_PASSWORD

  console.log('=== メッセージ詳細調査 ===\n')

  const jar = new CookieJar()
  const client = wrapper(axios.create({ jar, withCredentials: true }))

  // ログイン
  console.log('1. ログイン中...')
  await client.post(`${baseUrl}/console/api/login`, {
    email,
    password,
    remember_me: false,
  })

  // CSRFトークン取得
  const cookies = await jar.getCookies(baseUrl)
  let csrfToken: string | undefined
  for (const cookie of cookies) {
    if (cookie.key === 'csrf_token') {
      csrfToken = cookie.value
    }
  }
  if (csrfToken) {
    client.defaults.headers.common['X-CSRF-Token'] = csrfToken
  }
  console.log('ログイン成功\n')

  // アプリ一覧取得
  const appsResponse = await client.get(`${baseUrl}/console/api/apps`, {
    params: { page: 1, limit: 100 },
  })
  const apps = appsResponse.data.data

  // Chatアプリを探す
  const chatApp = apps.find((app: { mode: string }) =>
    app.mode === 'chat' || app.mode === 'advanced-chat' || app.mode === 'agent-chat'
  )

  if (!chatApp) {
    console.log('Chatアプリが見つかりません')
    return
  }

  console.log(`2. 対象アプリ: ${chatApp.name} (${chatApp.mode})`)
  console.log(`   ID: ${chatApp.id}\n`)

  // 会話一覧取得
  const convResponse = await client.get(
    `${baseUrl}/console/api/apps/${chatApp.id}/chat-conversations`,
    { params: { limit: 5 } }
  )
  const conversations = convResponse.data.data

  if (conversations.length === 0) {
    console.log('会話がありません')
    return
  }

  console.log(`3. 会話数: ${conversations.length}\n`)

  // 最初の会話のメッセージを取得
  const conversationId = conversations[0].id
  console.log(`4. 会話ID: ${conversationId}`)
  console.log(`   会話名: ${conversations[0].name}\n`)

  // メッセージ取得
  const msgResponse = await client.get(
    `${baseUrl}/console/api/apps/${chatApp.id}/chat-messages`,
    { params: { conversation_id: conversationId, limit: 5 } }
  )
  const messages = msgResponse.data.data

  console.log(`5. メッセージ数: ${messages.length}\n`)

  // メッセージの全フィールドを出力
  if (messages.length > 0) {
    console.log('=== メッセージ全フィールド ===')
    console.log(JSON.stringify(messages[0], null, 2))

    console.log('\n=== トークン・コスト関連フィールド抽出 ===')
    const msg = messages[0]
    console.log(`message_tokens: ${msg.message_tokens}`)
    console.log(`answer_tokens: ${msg.answer_tokens}`)
    console.log(`provider_response_latency: ${msg.provider_response_latency}`)
    console.log(`model: ${msg.model}`)
    console.log(`model_id: ${msg.model_id}`)
    console.log(`model_provider: ${msg.model_provider}`)
    console.log(`message_price: ${msg.message_price}`)
    console.log(`answer_price: ${msg.answer_price}`)
    console.log(`total_price: ${msg.total_price}`)
    console.log(`currency: ${msg.currency}`)

    // message_metadata を確認
    if (msg.metadata) {
      console.log('\n=== metadata ===')
      console.log(JSON.stringify(msg.metadata, null, 2))
    }

    // agent_thoughts を確認（モデル情報がここにある可能性）
    if (msg.agent_thoughts && msg.agent_thoughts.length > 0) {
      console.log('\n=== agent_thoughts[0] ===')
      console.log(JSON.stringify(msg.agent_thoughts[0], null, 2))
    }

    // workflow_run_id があれば workflow-run 詳細も取得
    if (msg.workflow_run_id) {
      console.log(`\n=== workflow_run_id: ${msg.workflow_run_id} ===`)
      try {
        const wfResponse = await client.get(
          `${baseUrl}/console/api/apps/${chatApp.id}/workflow-runs/${msg.workflow_run_id}`
        )
        console.log('workflow-run詳細:')
        console.log(JSON.stringify(wfResponse.data, null, 2))
      } catch (e) {
        console.log('workflow-run詳細取得失敗')
      }
    }
  }

  // workflow-runs も確認（モデル別トークン情報があるか）
  console.log('\n\n=== workflow-runs 調査 ===')
  try {
    const wfResponse = await client.get(
      `${baseUrl}/console/api/apps/${chatApp.id}/workflow-runs`,
      { params: { limit: 1 } }
    )
    if (wfResponse.data.data?.length > 0) {
      console.log('workflow-run サンプル:')
      console.log(JSON.stringify(wfResponse.data.data[0], null, 2))
    }
  } catch (e) {
    console.log('workflow-runs取得失敗')
  }

  // メッセージ詳細エンドポイントを試す
  if (messages.length > 0) {
    const messageId = messages[0].id
    console.log(`\n\n=== メッセージ詳細 API (message_id: ${messageId}) ===`)
    try {
      const detailResponse = await client.get(
        `${baseUrl}/console/api/apps/${chatApp.id}/messages/${messageId}`
      )
      console.log(JSON.stringify(detailResponse.data, null, 2))
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        console.log(`エラー: ${e.response?.status}`)
        console.log(JSON.stringify(e.response?.data))
      }
    }
  }

  // statistics/daily-conversations も確認
  console.log('\n\n=== statistics/daily-conversations ===')
  try {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const statsResponse = await client.get(
      `${baseUrl}/console/api/apps/${chatApp.id}/statistics/daily-conversations`,
      {
        params: {
          start: start.toISOString().split('T')[0] + ' 00:00',
          end: now.toISOString().split('T')[0] + ' 23:59'
        }
      }
    )
    console.log(JSON.stringify(statsResponse.data, null, 2))
  } catch (e: unknown) {
    if (axios.isAxiosError(e)) {
      console.log(`エラー: ${e.response?.status}`)
    }
  }

  // statistics/token-costs も確認（モデル別の内訳があるか）
  console.log('\n\n=== statistics/token-costs ===')
  try {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const statsResponse = await client.get(
      `${baseUrl}/console/api/apps/${chatApp.id}/statistics/token-costs`,
      {
        params: {
          start: start.toISOString().split('T')[0] + ' 00:00',
          end: now.toISOString().split('T')[0] + ' 23:59'
        }
      }
    )
    console.log(JSON.stringify(statsResponse.data, null, 2))
  } catch (e: unknown) {
    if (axios.isAxiosError(e)) {
      console.log(`エラー: ${e.response?.status}`)
    }
  }
}

main().catch(console.error)
