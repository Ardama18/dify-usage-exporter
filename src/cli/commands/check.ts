/**
 * checkコマンド
 *
 * DifyおよびAPI Meterへの接続テストを実行する。
 * エラー発生時に詳細な原因情報を出力する。
 */

import axios, { type AxiosError, type AxiosResponse } from 'axios'
import { wrapper } from 'axios-cookiejar-support'
import { Command } from 'commander'
import { CookieJar } from 'tough-cookie'
import type { CliDependencies } from '../bootstrap.js'

/**
 * 接続テスト結果
 */
interface ConnectionTestResult {
  success: boolean
  message: string
  details: Record<string, unknown>
}

/**
 * Dify接続テストを実行
 */
async function testDifyConnection(
  baseUrl: string,
  email: string,
  password: string,
): Promise<ConnectionTestResult> {
  const jar = new CookieJar()
  const client = wrapper(axios.create({ jar, withCredentials: true }))
  const loginUrl = `${baseUrl.replace(/\/$/, '')}/console/api/login`

  console.log('\n🔍 Dify接続テスト開始')
  console.log(`   URL: ${loginUrl}`)
  console.log(`   Email: ${email}`)

  try {
    const response: AxiosResponse = await client.post(
      loginUrl,
      {
        email,
        password,
        remember_me: false,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: () => true, // 全てのステータスを受け入れる
      },
    )

    // レスポンス情報を収集
    const statusCode = response.status
    const responseBody = response.data
    const setCookieHeaders = response.headers['set-cookie'] || []

    console.log(`\n   📊 レスポンス情報:`)
    console.log(`      ステータスコード: ${statusCode}`)
    console.log(`      レスポンスボディ: ${JSON.stringify(responseBody)}`)
    console.log(`      Set-Cookieヘッダー数: ${setCookieHeaders.length}`)

    // Cookieを確認
    const cookies = await jar.getCookies(baseUrl)
    console.log(`\n   🍪 取得したCookie:`)

    let hasAccessToken = false
    let accessTokenCookieName = ''

    for (const cookie of cookies) {
      console.log(`      - ${cookie.key}: ${cookie.value.substring(0, 20)}...`)
      if (cookie.key === '__Host-access_token' || cookie.key === 'access_token') {
        hasAccessToken = true
        accessTokenCookieName = cookie.key
      }
    }

    // Set-Cookieヘッダーの詳細
    if (setCookieHeaders.length > 0) {
      console.log(`\n   📝 Set-Cookieヘッダー詳細:`)
      for (const header of setCookieHeaders) {
        const cookieName = header.split('=')[0]
        console.log(`      - ${cookieName}`)
      }
    }

    // 結果判定
    if (statusCode !== 200) {
      return {
        success: false,
        message: `HTTPエラー: ステータスコード ${statusCode}`,
        details: {
          statusCode,
          responseBody,
          possibleCauses: [
            statusCode === 401 ? 'メールアドレスまたはパスワードが間違っています' : null,
            statusCode === 403 ? 'アクセス権限がありません' : null,
            statusCode === 404 ? 'ログインAPIエンドポイントが見つかりません（URLを確認してください）' : null,
            statusCode >= 500 ? 'Difyサーバーでエラーが発生しています' : null,
          ].filter(Boolean),
        },
      }
    }

    if (!hasAccessToken) {
      return {
        success: false,
        message: 'アクセストークンCookieが取得できませんでした',
        details: {
          statusCode,
          responseBody,
          cookiesReceived: cookies.map((c) => c.key),
          setCookieHeaders: setCookieHeaders.map((h: string) => h.split('=')[0]),
          possibleCauses: [
            'Difyのバージョンによりcookie名が異なる可能性があります',
            '期待されるCookie名: __Host-access_token または access_token',
            'nginx等のプロキシがSet-Cookieヘッダーを削除している可能性があります',
            'DIFY_API_BASE_URLをAPIコンテナ直接（例: http://docker-api-1:5001）に変更してみてください',
          ],
        },
      }
    }

    return {
      success: true,
      message: 'Dify接続成功',
      details: {
        statusCode,
        accessTokenCookieName,
        cookiesReceived: cookies.map((c) => c.key),
      },
    }
  } catch (error) {
    const axiosError = error as AxiosError

    console.log(`\n   ❌ エラー発生:`)
    console.log(`      メッセージ: ${axiosError.message}`)

    if (axiosError.code) {
      console.log(`      エラーコード: ${axiosError.code}`)
    }

    const possibleCauses: string[] = []

    if (axiosError.code === 'ECONNREFUSED') {
      possibleCauses.push('接続が拒否されました。URLとポートが正しいか確認してください')
      possibleCauses.push('Difyが起動しているか確認してください')
    } else if (axiosError.code === 'ENOTFOUND') {
      possibleCauses.push('ホスト名が解決できません。URLが正しいか確認してください')
      possibleCauses.push('DNSの設定を確認してください')
    } else if (axiosError.code === 'ETIMEDOUT') {
      possibleCauses.push('接続がタイムアウトしました')
      possibleCauses.push('ネットワーク接続を確認してください')
    } else if (axiosError.message.includes('certificate')) {
      possibleCauses.push('SSL証明書エラーです')
      possibleCauses.push('NODE_TLS_REJECT_UNAUTHORIZED=0 を設定するか、HTTPを使用してください')
    }

    return {
      success: false,
      message: `接続エラー: ${axiosError.message}`,
      details: {
        errorCode: axiosError.code,
        errorMessage: axiosError.message,
        possibleCauses,
      },
    }
  }
}

/**
 * API Meter接続テストを実行（POSTリクエスト）
 */
async function testApiMeterConnection(
  baseUrl: string,
  token: string,
  tenantId: string,
): Promise<ConnectionTestResult> {
  console.log('\n🔍 API Meter接続テスト開始')
  console.log(`   URL: ${baseUrl}`)
  console.log(`   Token: ${token.substring(0, 10)}...`)
  console.log(`   Tenant ID: ${tenantId}`)

  // テスト用の最小限のリクエストデータ
  const testPayload = {
    tenant_id: tenantId,
    export_metadata: {
      exporter_version: '1.0.0',
      export_timestamp: new Date().toISOString(),
      aggregation_period: 'daily',
      source_system: 'dify',
      date_range: {
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
      },
    },
    records: [], // 空のレコード（接続テスト用）
  }

  try {
    const response = await axios.post(baseUrl, testPayload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
      validateStatus: () => true,
    })

    const statusCode = response.status
    const responseBody = response.data

    console.log(`\n   📊 レスポンス情報:`)
    console.log(`      ステータスコード: ${statusCode}`)
    console.log(`      レスポンスボディ: ${JSON.stringify(responseBody).substring(0, 200)}`)

    // 成功（200, 201）
    if (statusCode >= 200 && statusCode < 300) {
      return {
        success: true,
        message: 'API Meter接続成功（POSTリクエスト成功）',
        details: {
          statusCode,
          responseBody,
        },
      }
    }

    // 400はバリデーションエラーだが接続自体は成功
    if (statusCode === 400) {
      return {
        success: true,
        message: 'API Meter接続成功（サーバー到達可能、バリデーションエラーは想定内）',
        details: {
          statusCode,
          responseBody,
          note: '空のレコードでテストしたため、バリデーションエラーは想定内です',
        },
      }
    }

    // 422もバリデーションエラーだが接続自体は成功
    if (statusCode === 422) {
      return {
        success: true,
        message: 'API Meter接続成功（サーバー到達可能、バリデーションエラーは想定内）',
        details: {
          statusCode,
          responseBody,
          note: 'テストデータのバリデーションエラーは想定内です',
        },
      }
    }

    if (statusCode === 401) {
      return {
        success: false,
        message: '認証エラー: APIトークンが無効です',
        details: {
          statusCode,
          responseBody,
          possibleCauses: [
            'EXTERNAL_API_TOKENが正しいか確認してください',
            'トークンの有効期限が切れている可能性があります',
          ],
        },
      }
    }

    if (statusCode === 403) {
      return {
        success: false,
        message: '権限エラー: アクセス権限がありません',
        details: {
          statusCode,
          responseBody,
          possibleCauses: [
            'API_METER_TENANT_IDが正しいか確認してください',
            'このテナントへのアクセス権限がない可能性があります',
          ],
        },
      }
    }

    if (statusCode === 404) {
      return {
        success: false,
        message: 'エンドポイントが見つかりません',
        details: {
          statusCode,
          responseBody,
          possibleCauses: [
            'EXTERNAL_API_URLが正しいか確認してください',
            'APIエンドポイントのパスが変更された可能性があります',
          ],
        },
      }
    }

    if (statusCode >= 500) {
      return {
        success: false,
        message: `サーバーエラー: ステータスコード ${statusCode}`,
        details: {
          statusCode,
          responseBody,
          possibleCauses: ['API Meterサーバーで問題が発生しています'],
        },
      }
    }

    return {
      success: true,
      message: `API Meter接続成功（ステータスコード: ${statusCode}）`,
      details: {
        statusCode,
        responseBody,
      },
    }
  } catch (error) {
    const axiosError = error as AxiosError

    console.log(`\n   ❌ エラー発生:`)
    console.log(`      メッセージ: ${axiosError.message}`)

    if (axiosError.code) {
      console.log(`      エラーコード: ${axiosError.code}`)
    }

    const possibleCauses: string[] = []

    if (axiosError.code === 'ECONNREFUSED') {
      possibleCauses.push('接続が拒否されました')
    } else if (axiosError.code === 'ENOTFOUND') {
      possibleCauses.push('ホスト名が解決できません')
    } else if (axiosError.code === 'ETIMEDOUT') {
      possibleCauses.push('接続がタイムアウトしました')
    }

    return {
      success: false,
      message: `接続エラー: ${axiosError.message}`,
      details: {
        errorCode: axiosError.code,
        errorMessage: axiosError.message,
        possibleCauses,
      },
    }
  }
}

/**
 * checkコマンドを作成
 */
export function createCheckCommand(deps: CliDependencies): Command {
  const { config } = deps

  const command = new Command('check')
    .description('Test connections to Dify and API Meter')
    .option('--dify', 'Test Dify connection only')
    .option('--api-meter', 'Test API Meter connection only')
    .option('--json', 'Output as JSON')
    .action(async (options: { dify?: boolean; apiMeter?: boolean; json?: boolean }) => {
      const testBoth = !options.dify && !options.apiMeter
      const results: Record<string, ConnectionTestResult> = {}

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('       接続テスト - Dify Usage Exporter')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      // Dify接続テスト
      if (testBoth || options.dify) {
        results.dify = await testDifyConnection(
          config.DIFY_API_BASE_URL,
          config.DIFY_EMAIL,
          config.DIFY_PASSWORD,
        )

        if (results.dify.success) {
          console.log('\n   ✅ Dify: 接続成功')
        } else {
          console.log('\n   ❌ Dify: 接続失敗')
          console.log(`      原因: ${results.dify.message}`)
          if (results.dify.details.possibleCauses) {
            console.log('      考えられる原因:')
            for (const cause of results.dify.details.possibleCauses as string[]) {
              console.log(`        - ${cause}`)
            }
          }
        }
      }

      // API Meter接続テスト
      if (testBoth || options.apiMeter) {
        results.apiMeter = await testApiMeterConnection(
          config.EXTERNAL_API_URL,
          config.EXTERNAL_API_TOKEN,
          config.API_METER_TENANT_ID,
        )

        if (results.apiMeter.success) {
          console.log('\n   ✅ API Meter: 接続成功')
        } else {
          console.log('\n   ❌ API Meter: 接続失敗')
          console.log(`      原因: ${results.apiMeter.message}`)
          if (results.apiMeter.details.possibleCauses) {
            console.log('      考えられる原因:')
            for (const cause of results.apiMeter.details.possibleCauses as string[]) {
              console.log(`        - ${cause}`)
            }
          }
        }
      }

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      // サマリー
      const allSuccess = Object.values(results).every((r) => r.success)
      if (allSuccess) {
        console.log('✅ 全ての接続テストが成功しました')
      } else {
        console.log('❌ 一部の接続テストが失敗しました')
        process.exitCode = 1
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

      // JSON出力
      if (options.json) {
        console.log(JSON.stringify(results, null, 2))
      }
    })

  return command
}
