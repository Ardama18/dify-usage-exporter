/**
 * Dify APIクライアント
 *
 * Dify Console APIとのHTTP通信を行う。
 * メール/パスワードでログインしてアクセストークンを取得し、Console APIにアクセス。
 * 指数バックオフリトライ、Retry-Afterヘッダー対応を実装。
 * ADR 002（リトライポリシー）、ADR 007（HTTPクライアント）に準拠。
 */

import axios, { type AxiosError, type AxiosInstance } from 'axios'
import { wrapper } from 'axios-cookiejar-support'
import axiosRetry from 'axios-retry'
import { CookieJar } from 'tough-cookie'
import type { Logger } from '../logger/winston-logger.js'
import type {
  DifyAppTokenCostsResponse,
  DifyConversation,
  DifyConversationsResponse,
  DifyMessage,
  DifyMessagesResponse,
  DifyNodeExecution,
  DifyNodeExecutionsResponse,
  DifyWorkflowRun,
  DifyWorkflowRunsResponse,
} from '../types/dify-usage.js'
import type { EnvConfig } from '../types/env.js'

/**
 * DifyApiClient作成時の依存関係
 */
export interface DifyApiClientDeps {
  config: EnvConfig
  logger: Logger
}

/**
 * アプリ情報
 */
export interface DifyApp {
  id: string
  name: string
  mode: string
}

/**
 * アプリ一覧レスポンス
 */
interface DifyAppsResponse {
  data: DifyApp[]
  total?: number
  page?: number
  limit?: number
  has_more?: boolean
}

/**
 * アプリ別トークンコスト取得パラメータ
 */
export interface FetchAppTokenCostsParams {
  /** アプリID */
  appId: string
  /** 取得開始日時（YYYY-MM-DD HH:mm形式） */
  start: string
  /** 取得終了日時（YYYY-MM-DD HH:mm形式） */
  end: string
}

/**
 * 会話一覧取得パラメータ
 */
export interface FetchConversationsParams {
  /** アプリID */
  appId: string
  /** 開始日時（Unix timestamp） */
  start?: number
  /** 終了日時（Unix timestamp） */
  end?: number
  /** 取得上限 */
  limit?: number
}

/**
 * メッセージ一覧取得パラメータ
 */
export interface FetchMessagesParams {
  /** アプリID */
  appId: string
  /** 会話ID */
  conversationId: string
  /** 取得上限 */
  limit?: number
}

/**
 * ワークフロー実行一覧取得パラメータ
 */
export interface FetchWorkflowRunsParams {
  /** アプリID */
  appId: string
  /** 開始日時（Unix timestamp） */
  start?: number
  /** 終了日時（Unix timestamp） */
  end?: number
  /** 取得上限 */
  limit?: number
}

/**
 * ノード実行詳細取得パラメータ
 */
export interface FetchNodeExecutionsParams {
  /** アプリID */
  appId: string
  /** ワークフロー実行ID */
  workflowRunId: string
}

/**
 * Difyログインレスポンス（レスポンスボディ用、実際はCookieで返される）
 */
interface DifyLoginResponse {
  result?: string
  data?: string
}

/**
 * DifyApiClientインターフェース
 */
export interface DifyApiClient {
  /**
   * アプリ一覧を取得する
   * @returns アプリ一覧
   */
  fetchApps(): Promise<DifyApp[]>

  /**
   * アプリ別のトークンコストを取得する
   * @param params 取得パラメータ
   * @returns トークンコストレスポンス
   */
  fetchAppTokenCosts(params: FetchAppTokenCostsParams): Promise<DifyAppTokenCostsResponse>

  /**
   * 会話一覧を取得する（ユーザー別集計用）
   * @param params 取得パラメータ
   * @returns 会話一覧
   */
  fetchConversations(params: FetchConversationsParams): Promise<DifyConversation[]>

  /**
   * メッセージ一覧を取得する（トークン情報含む）
   * @param params 取得パラメータ
   * @returns メッセージ一覧
   */
  fetchMessages(params: FetchMessagesParams): Promise<DifyMessage[]>

  /**
   * ワークフロー実行一覧を取得する
   * @param params 取得パラメータ
   * @returns ワークフロー実行一覧
   */
  fetchWorkflowRuns(params: FetchWorkflowRunsParams): Promise<DifyWorkflowRun[]>

  /**
   * ノード実行詳細を取得する（LLMノードのモデル別コスト情報）
   * @param params 取得パラメータ
   * @returns ノード実行詳細一覧
   */
  fetchNodeExecutions(params: FetchNodeExecutionsParams): Promise<DifyNodeExecution[]>
}

/**
 * DifyApiClientを作成する
 * @param deps 依存関係（EnvConfig, Logger）
 * @returns DifyApiClientインスタンス
 */
export function createDifyApiClient(deps: DifyApiClientDeps): DifyApiClient {
  const { config, logger } = deps

  // Cookie Jarでセッション管理（CSRF対策含む）
  const jar = new CookieJar()
  let client: AxiosInstance | null = null
  let csrfToken: string | null = null
  let isLoggedIn = false

  /**
   * Dify Console APIにログイン（Cookie経由で認証）
   */
  async function login(): Promise<void> {
    const baseUrl = config.DIFY_API_BASE_URL.replace(/\/$/, '')
    const loginUrl = `${baseUrl}/console/api/login`

    logger.debug('Difyログイン試行', { email: config.DIFY_EMAIL })

    // Cookie Jar対応のaxiosインスタンスでログイン
    const loginClient = wrapper(axios.create({ jar, withCredentials: true }))

    await loginClient.post<DifyLoginResponse>(
      loginUrl,
      {
        email: config.DIFY_EMAIL,
        password: config.DIFY_PASSWORD,
        remember_me: false,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: config.DIFY_FETCH_TIMEOUT_MS,
      }
    )

    // Cookie JarからCSRFトークンを取得
    const cookies = await jar.getCookies(baseUrl)
    let accessToken: string | null = null

    for (const cookie of cookies) {
      if (cookie.key === 'access_token') {
        accessToken = cookie.value
      }
      if (cookie.key === 'csrf_token') {
        csrfToken = cookie.value
      }
    }

    if (!accessToken) {
      throw new Error('Difyログイン失敗: アクセストークンを取得できませんでした')
    }

    isLoggedIn = true
    logger.info('Difyログイン成功')
  }

  /**
   * 認証済みaxiosクライアントを取得（必要に応じてログイン）
   */
  async function getAuthenticatedClient(): Promise<AxiosInstance> {
    if (!isLoggedIn) {
      await login()
    }

    if (!client) {
      // Cookie Jar対応のaxiosインスタンスを作成
      client = wrapper(
        axios.create({
          jar,
          withCredentials: true,
          baseURL: config.DIFY_API_BASE_URL.replace(/\/$/, ''),
          timeout: config.DIFY_FETCH_TIMEOUT_MS,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'dify-usage-exporter/1.0.0',
          },
        })
      )

      // リトライ設定（ADR 002, ADR 007準拠）
      axiosRetry(client, {
        retries: config.DIFY_FETCH_RETRY_COUNT,
        retryDelay: (retryCount, error) => {
          // 429の場合はRetry-Afterヘッダーを考慮
          const retryAfter = error.response?.headers['retry-after']
          if (retryAfter) {
            const delayMs = Number.parseInt(retryAfter, 10) * 1000
            logger.info('Retry-Afterヘッダー検出', { retryAfter, delayMs })
            return delayMs
          }
          // 指数バックオフ（1秒 → 2秒 → 4秒）
          return axiosRetry.exponentialDelay(retryCount)
        },
        retryCondition: (error: AxiosError) => {
          // リトライ対象: ネットワークエラー、5xx、429
          if (axiosRetry.isNetworkOrIdempotentRequestError(error)) {
            return true
          }
          const status = error.response?.status
          return status === 429 || (status !== undefined && status >= 500)
        },
        onRetry: (retryCount, error) => {
          logger.warn('APIリトライ試行', {
            retryCount,
            error: error.message,
            status: error.response?.status,
          })
        },
      })

      // リクエストインターセプター（CSRFトークン追加、ログ出力）
      client.interceptors.request.use((requestConfig) => {
        // CSRFトークンをヘッダーに追加
        if (csrfToken) {
          requestConfig.headers['X-CSRF-Token'] = csrfToken
        }
        logger.debug('APIリクエスト送信', {
          method: requestConfig.method,
          url: requestConfig.url,
          params: requestConfig.params,
        })
        return requestConfig
      })

      // レスポンスインターセプター（ログ出力）
      client.interceptors.response.use(
        (response) => {
          logger.debug('APIレスポンス受信', {
            status: response.status,
            url: response.config.url,
          })
          return response
        },
        (error: AxiosError) => {
          logger.error('APIエラー', {
            status: error.response?.status,
            message: error.message,
            url: error.config?.url,
          })
          throw error
        }
      )
    }

    return client
  }

  return {
    async fetchApps(): Promise<DifyApp[]> {
      const authenticatedClient = await getAuthenticatedClient()
      const apps: DifyApp[] = []
      let page = 1
      const limit = 100
      let hasMore = true

      while (hasMore) {
        const response = await authenticatedClient.get<DifyAppsResponse>('/console/api/apps', {
          params: { page, limit },
        })
        apps.push(...response.data.data)
        hasMore = response.data.has_more ?? response.data.data.length === limit
        page++
      }

      logger.info('アプリ一覧取得完了', { count: apps.length })
      return apps
    },

    async fetchAppTokenCosts(params: FetchAppTokenCostsParams): Promise<DifyAppTokenCostsResponse> {
      const authenticatedClient = await getAuthenticatedClient()
      const response = await authenticatedClient.get<DifyAppTokenCostsResponse>(
        `/console/api/apps/${params.appId}/statistics/token-costs`,
        {
          params: {
            start: params.start,
            end: params.end,
          },
        }
      )
      return response.data
    },

    async fetchConversations(params: FetchConversationsParams): Promise<DifyConversation[]> {
      const authenticatedClient = await getAuthenticatedClient()
      const conversations: DifyConversation[] = []
      const limit = params.limit ?? 100
      let lastId: string | undefined

      // ページネーション（無限スクロール形式）
      while (true) {
        const queryParams: Record<string, string | number> = { limit }
        if (lastId) {
          queryParams.last_id = lastId
        }
        // Note: start/endパラメータはDify APIでサポートされていないため、
        // 取得後にフィルタリングする必要がある

        const response = await authenticatedClient.get<DifyConversationsResponse>(
          `/console/api/apps/${params.appId}/chat-conversations`,
          { params: queryParams }
        )

        // 期間フィルタ（start/endが指定されている場合）
        let filteredData = response.data.data
        if (params.start || params.end) {
          filteredData = response.data.data.filter((conv) => {
            if (params.start && conv.created_at < params.start) return false
            if (params.end && conv.created_at > params.end) return false
            return true
          })
        }

        conversations.push(...filteredData)

        if (!response.data.has_more || response.data.data.length === 0) {
          break
        }

        // 期間外のデータが出始めたら早期終了（降順前提）
        if (params.start && response.data.data.some((conv) => conv.created_at < params.start!)) {
          break
        }

        // 次のページ用に最後のIDを保存
        lastId = response.data.data[response.data.data.length - 1].id
      }

      logger.info('会話一覧取得完了', { appId: params.appId, count: conversations.length })
      return conversations
    },

    async fetchMessages(params: FetchMessagesParams): Promise<DifyMessage[]> {
      const authenticatedClient = await getAuthenticatedClient()
      const messages: DifyMessage[] = []
      const limit = params.limit ?? 100
      let firstId: string | undefined

      // ページネーション（first_id形式で遡る）
      while (true) {
        const queryParams: Record<string, string | number> = {
          conversation_id: params.conversationId,
          limit,
        }
        if (firstId) {
          queryParams.first_id = firstId
        }

        const response = await authenticatedClient.get<DifyMessagesResponse>(
          `/console/api/apps/${params.appId}/chat-messages`,
          { params: queryParams }
        )

        messages.push(...response.data.data)

        if (!response.data.has_more || response.data.data.length === 0) {
          break
        }

        // 次のページ用に最初のIDを保存（古い方向に遡る）
        firstId = response.data.data[0].id
      }

      logger.debug('メッセージ一覧取得完了', {
        appId: params.appId,
        conversationId: params.conversationId,
        count: messages.length,
      })
      return messages
    },

    async fetchWorkflowRuns(params: FetchWorkflowRunsParams): Promise<DifyWorkflowRun[]> {
      const authenticatedClient = await getAuthenticatedClient()
      const workflowRuns: DifyWorkflowRun[] = []
      const limit = params.limit ?? 100
      let lastId: string | undefined

      // ページネーション（無限スクロール形式）
      while (true) {
        const queryParams: Record<string, string | number> = { limit }
        if (lastId) {
          queryParams.last_id = lastId
        }

        const response = await authenticatedClient.get<DifyWorkflowRunsResponse>(
          `/console/api/apps/${params.appId}/workflow-runs`,
          { params: queryParams }
        )

        // 期間フィルタ（start/endが指定されている場合）
        let filteredData = response.data.data
        if (params.start || params.end) {
          filteredData = response.data.data.filter((run) => {
            if (params.start && run.created_at < params.start) return false
            if (params.end && run.created_at > params.end) return false
            return true
          })
        }

        workflowRuns.push(...filteredData)

        if (!response.data.has_more || response.data.data.length === 0) {
          break
        }

        // 期間外のデータが出始めたら早期終了（降順前提）
        if (params.start && response.data.data.some((run) => run.created_at < params.start!)) {
          break
        }

        // 次のページ用に最後のIDを保存
        lastId = response.data.data[response.data.data.length - 1].id
      }

      logger.info('ワークフロー実行一覧取得完了', { appId: params.appId, count: workflowRuns.length })
      return workflowRuns
    },

    async fetchNodeExecutions(params: FetchNodeExecutionsParams): Promise<DifyNodeExecution[]> {
      const authenticatedClient = await getAuthenticatedClient()

      const response = await authenticatedClient.get<DifyNodeExecutionsResponse>(
        `/console/api/apps/${params.appId}/workflow-runs/${params.workflowRunId}/node-executions`
      )

      // レスポンス形式が配列の場合とdataプロパティの場合に対応
      const nodeExecutions = Array.isArray(response.data)
        ? response.data
        : response.data.data || []

      logger.debug('ノード実行詳細取得完了', {
        appId: params.appId,
        workflowRunId: params.workflowRunId,
        count: nodeExecutions.length,
      })
      return nodeExecutions
    },
  }
}
