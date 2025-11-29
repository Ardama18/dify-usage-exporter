/**
 * ワークフローノード実行詳細調査スクリプト
 * モデル別トークン・コスト情報が取得可能か確認
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

  console.log('=== ワークフローノード実行詳細調査 ===\n')

  const jar = new CookieJar()
  const client = wrapper(axios.create({ jar, withCredentials: true }))

  // ログイン
  await client.post(`${baseUrl}/console/api/login`, {
    email,
    password,
    remember_me: false,
  })

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

  const chatApp = apps.find((app: { mode: string }) =>
    app.mode === 'chat' || app.mode === 'advanced-chat' || app.mode === 'agent-chat'
  )

  if (!chatApp) {
    console.log('Chatアプリが見つかりません')
    return
  }

  console.log(`対象アプリ: ${chatApp.name}`)
  console.log(`ID: ${chatApp.id}\n`)

  // workflow-runs 取得
  const wfRunsResponse = await client.get(
    `${baseUrl}/console/api/apps/${chatApp.id}/workflow-runs`,
    { params: { limit: 1 } }
  )

  if (!wfRunsResponse.data.data?.length) {
    console.log('workflow-runsがありません')
    return
  }

  const workflowRunId = wfRunsResponse.data.data[0].id
  console.log(`workflow-run ID: ${workflowRunId}`)
  console.log(`total_tokens: ${wfRunsResponse.data.data[0].total_tokens}\n`)

  // ノード実行詳細を取得
  console.log('=== node-executions 取得 ===')
  try {
    const nodeExecResponse = await client.get(
      `${baseUrl}/console/api/apps/${chatApp.id}/workflow-runs/${workflowRunId}/node-executions`
    )
    console.log('成功!')
    const nodeExecutions = nodeExecResponse.data.data || nodeExecResponse.data

    if (Array.isArray(nodeExecutions)) {
      console.log(`ノード実行数: ${nodeExecutions.length}\n`)

      // LLMノードを探す
      for (const exec of nodeExecutions) {
        if (exec.node_type === 'llm') {
          console.log('=== LLMノード実行詳細 ===')
          console.log(`node_id: ${exec.node_id}`)
          console.log(`node_type: ${exec.node_type}`)
          console.log(`title: ${exec.title}`)
          console.log(`status: ${exec.status}`)
          console.log(`elapsed_time: ${exec.elapsed_time}`)

          // execution_metadata を確認
          if (exec.execution_metadata) {
            console.log('\nexecution_metadata:')
            console.log(JSON.stringify(exec.execution_metadata, null, 2))
          }

          // process_data を確認
          if (exec.process_data) {
            console.log('\nprocess_data:')
            console.log(JSON.stringify(exec.process_data, null, 2))
          }

          // outputs を確認
          if (exec.outputs) {
            console.log('\noutputs (部分):')
            const outputKeys = Object.keys(exec.outputs)
            for (const key of outputKeys) {
              if (key.includes('token') || key.includes('price') || key.includes('model') || key.includes('usage')) {
                console.log(`  ${key}: ${JSON.stringify(exec.outputs[key])}`)
              }
            }
          }

          console.log('\n--- 全フィールド ---')
          console.log(JSON.stringify(exec, null, 2))
          console.log('\n')
        }
      }
    } else {
      console.log('レスポンス形式:')
      console.log(JSON.stringify(nodeExecutions, null, 2))
    }
  } catch (e: unknown) {
    if (axios.isAxiosError(e)) {
      console.log(`エラー: ${e.response?.status}`)
      console.log(JSON.stringify(e.response?.data))
    }
  }

  // tracing エンドポイントも試す
  console.log('\n=== tracing 取得 ===')
  try {
    const tracingResponse = await client.get(
      `${baseUrl}/console/api/apps/${chatApp.id}/workflow-runs/${workflowRunId}/tracing`
    )
    console.log('成功!')
    const tracing = tracingResponse.data

    // LLMトレースを探す
    if (Array.isArray(tracing)) {
      for (const trace of tracing) {
        if (trace.node_type === 'llm' || trace.type === 'llm') {
          console.log('\nLLMトレース:')
          console.log(JSON.stringify(trace, null, 2))
        }
      }
    } else {
      console.log(JSON.stringify(tracing, null, 2))
    }
  } catch (e: unknown) {
    if (axios.isAxiosError(e)) {
      console.log(`エラー: ${e.response?.status}`)
    }
  }

  // logs エンドポイントも試す
  console.log('\n=== advanced-chat/logs 取得 ===')
  try {
    const logsResponse = await client.get(
      `${baseUrl}/console/api/apps/${chatApp.id}/advanced-chat/logs`,
      { params: { limit: 1 } }
    )
    console.log('成功!')
    console.log(JSON.stringify(logsResponse.data, null, 2))
  } catch (e: unknown) {
    if (axios.isAxiosError(e)) {
      console.log(`エラー: ${e.response?.status}`)
    }
  }
}

main().catch(console.error)
