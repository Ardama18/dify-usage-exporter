/**
 * Dify API動作確認スクリプト
 *
 * ログイン → アプリ一覧取得 → 各アプリのtoken-costs取得をテスト
 */

import axios from 'axios'
import { wrapper } from 'axios-cookiejar-support'
import { CookieJar } from 'tough-cookie'
import { loadConfig } from '../src/config/env-config.js'

async function main() {
  console.log('=== Dify API動作確認 ===\n')

  // 1. 設定読み込み
  console.log('1. 設定読み込み...')
  const config = loadConfig()
  console.log(`   DIFY_API_BASE_URL: ${config.DIFY_API_BASE_URL}`)
  console.log(`   DIFY_EMAIL: ${config.DIFY_EMAIL}`)
  console.log('')

  // 2. ログインテスト（Cookie Jarを使用）
  console.log('2. ログインテスト...')
  const loginUrl = `${config.DIFY_API_BASE_URL}/console/api/login`

  // Cookie Jarを設定したaxiosインスタンスを作成
  const jar = new CookieJar()
  const client = wrapper(axios.create({ jar, withCredentials: true }))

  try {
    const loginResponse = await client.post(
      loginUrl,
      {
        email: config.DIFY_EMAIL,
        password: config.DIFY_PASSWORD,
        remember_me: false,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    )

    // Cookie Jarからトークンを取得して確認
    const cookies = await jar.getCookies(config.DIFY_API_BASE_URL)
    let accessToken: string | null = null
    let csrfToken: string | null = null

    for (const cookie of cookies) {
      if (cookie.key === 'access_token') {
        accessToken = cookie.value
      }
      if (cookie.key === 'csrf_token') {
        csrfToken = cookie.value
      }
    }

    if (!accessToken) {
      console.log('   アクセストークンが見つかりません')
      console.log('   Cookies:', cookies.map(c => c.key))
      process.exit(1)
    }

    console.log('   ログイン成功!')
    console.log(`   CSRFトークン: ${csrfToken ? '取得済み' : 'なし'}`)
    console.log('')

    // 共通ヘッダー（Cookie Jarが自動でCookieを送信するが、CSRFトークンはヘッダーにも必要）
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken
    }

    // 3. アプリ一覧取得
    console.log('3. アプリ一覧取得...')
    const appsUrl = `${config.DIFY_API_BASE_URL}/console/api/apps`

    const appsResponse = await client.get(appsUrl, {
      headers,
      params: {
        limit: 100,
        page: 1,
      },
      timeout: 10000,
    })

    const apps = appsResponse.data.data || []
    console.log(`   ${apps.length}個のアプリを取得`)

    if (apps.length === 0) {
      console.log('   アプリがありません')
      process.exit(0)
    }

    // 各アプリの情報を表示
    apps.forEach((app: { id: string; name: string; mode: string }) => {
      console.log(`   - ${app.name} (${app.id}) [${app.mode}]`)
    })
    console.log('')

    // 4. 各アプリのtoken-costs取得
    console.log('4. 各アプリのtoken-costs取得...')
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - 7)

    const startStr = startDate.toISOString().split('T')[0] + ' 00:00'
    const endStr = today.toISOString().split('T')[0] + ' 23:59'
    console.log(`   期間: ${startStr} ~ ${endStr}`)
    console.log('')

    for (const app of apps.slice(0, 3)) { // 最初の3つだけテスト
      console.log(`   === ${app.name} ===`)
      const tokenCostsUrl = `${config.DIFY_API_BASE_URL}/console/api/apps/${app.id}/statistics/token-costs`

      try {
        const tokenCostsResponse = await client.get(tokenCostsUrl, {
          headers,
          params: {
            start: startStr,
            end: endStr,
          },
          timeout: 10000,
        })

        console.log('   レスポンス:', JSON.stringify(tokenCostsResponse.data, null, 2))
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.log(`   エラー: ${error.response?.status} - ${error.message}`)
          console.log(`   詳細: ${JSON.stringify(error.response?.data)}`)
        }
      }
      console.log('')
    }

    console.log('=== 完了 ===')
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('エラー:', error.message)
      console.error('ステータス:', error.response?.status)
      console.error('レスポンス:', JSON.stringify(error.response?.data, null, 2))
    } else {
      console.error('エラー:', error)
    }
    process.exit(1)
  }
}

main()
