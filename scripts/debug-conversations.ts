/**
 * 会話一覧API デバッグスクリプト
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

  console.log('=== 会話一覧API デバッグ ===\n')
  console.log(`Base URL: ${baseUrl}`)
  console.log(`Email: ${email}`)

  const jar = new CookieJar()
  const client = wrapper(axios.create({ jar, withCredentials: true }))

  // ログイン
  console.log('\n1. ログイン中...')
  await client.post(`${baseUrl}/console/api/login`, {
    email,
    password,
    remember_me: false,
  })
  console.log('ログイン成功')

  // アプリ一覧取得
  console.log('\n2. アプリ一覧取得...')
  const appsResponse = await client.get(`${baseUrl}/console/api/apps`, {
    params: { page: 1, limit: 100 },
  })
  const apps = appsResponse.data.data
  console.log(`アプリ数: ${apps.length}`)

  // 各アプリの会話一覧を試行
  for (const app of apps) {
    console.log(`\n3. アプリ: ${app.name} (${app.mode})`)
    console.log(`   ID: ${app.id}`)

    // chat-conversations エンドポイントを試す
    try {
      const response = await client.get(
        `${baseUrl}/console/api/apps/${app.id}/chat-conversations`,
        { params: { limit: 10 } }
      )
      console.log('   chat-conversations: 成功')
      console.log(`   データ数: ${response.data.data?.length || 0}`)
      if (response.data.data?.length > 0) {
        console.log('   サンプル:', JSON.stringify(response.data.data[0], null, 2))
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.log(`   chat-conversations: エラー ${error.response?.status}`)
        console.log(`   レスポンス: ${JSON.stringify(error.response?.data)}`)
      } else {
        console.log(`   chat-conversations: エラー ${error}`)
      }
    }

    // advanced-chat 向けの別エンドポイントを試す
    try {
      const response = await client.get(
        `${baseUrl}/console/api/apps/${app.id}/advanced-chat/conversations`,
        { params: { limit: 10 } }
      )
      console.log('   advanced-chat/conversations: 成功')
      console.log(`   データ数: ${response.data.data?.length || 0}`)
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.log(`   advanced-chat/conversations: エラー ${error.response?.status}`)
        console.log(`   レスポンス: ${JSON.stringify(error.response?.data)}`)
      } else {
        console.log(`   advanced-chat/conversations: エラー ${error}`)
      }
    }

    // messages エンドポイントを直接試す
    try {
      const response = await client.get(
        `${baseUrl}/console/api/apps/${app.id}/messages`,
        { params: { limit: 10 } }
      )
      console.log('   messages: 成功')
      console.log(`   データ数: ${response.data.data?.length || 0}`)
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        console.log(`   messages: エラー ${error.response?.status}`)
      } else {
        console.log(`   messages: エラー ${error}`)
      }
    }

    // workflow-runs を試す（workflowアプリ用）
    if (app.mode === 'workflow' || app.mode === 'advanced-chat') {
      try {
        const response = await client.get(
          `${baseUrl}/console/api/apps/${app.id}/workflow-runs`,
          { params: { limit: 10 } }
        )
        console.log('   workflow-runs: 成功')
        console.log(`   データ数: ${response.data.data?.length || 0}`)
        if (response.data.data?.length > 0) {
          console.log('   サンプル:', JSON.stringify(response.data.data[0], null, 2))
        }
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          console.log(`   workflow-runs: エラー ${error.response?.status}`)
        } else {
          console.log(`   workflow-runs: エラー ${error}`)
        }
      }
    }
  }
}

main().catch(console.error)
