/**
 * ユーザー別使用量Fetcher
 *
 * ログAPI（会話・メッセージ）を使用して、ユーザー別のトークン使用量を取得する。
 * アプリ → 会話 → メッセージ の階層でデータを取得し、ユーザー別に集計。
 */

import type { DifyApiClient, DifyApp } from './dify-api-client.js'
import type { Logger } from '../logger/winston-logger.js'
import type { DifyConversation, DifyMessage } from '../types/dify-usage.js'

/**
 * ユーザー別使用量レコード（メッセージ単位）
 */
export interface UserUsageRecord {
  /** 日付（YYYY-MM-DD） */
  date: string
  /** アプリID */
  app_id: string
  /** アプリ名 */
  app_name: string
  /** ユーザーID（end_user_id または account_id） */
  user_id: string
  /** ユーザータイプ（end_user: APIユーザー、account: コンソールユーザー） */
  user_type: 'end_user' | 'account'
  /** 会話ID */
  conversation_id: string
  /** メッセージID */
  message_id: string
  /** 入力トークン数 */
  message_tokens: number
  /** 出力トークン数 */
  answer_tokens: number
  /** 合計トークン数 */
  total_tokens: number
}

/**
 * ユーザー別集計結果
 */
export interface UserUsageSummary {
  /** ユーザーID */
  user_id: string
  /** ユーザータイプ */
  user_type: 'end_user' | 'account'
  /** アプリID */
  app_id: string
  /** アプリ名 */
  app_name: string
  /** 入力トークン合計 */
  total_message_tokens: number
  /** 出力トークン合計 */
  total_answer_tokens: number
  /** トークン合計 */
  total_tokens: number
  /** メッセージ数 */
  message_count: number
  /** 会話数 */
  conversation_count: number
}

/**
 * Fetcherの依存関係
 */
export interface UserUsageFetcherDeps {
  difyClient: DifyApiClient
  logger: Logger
}

/**
 * Fetch結果
 */
export interface UserUsageFetchResult {
  /** 取得成功 */
  success: boolean
  /** ユーザー別詳細レコード */
  records: UserUsageRecord[]
  /** ユーザー別集計結果 */
  summaries: UserUsageSummary[]
  /** 取得開始日 */
  startDate: string
  /** 取得終了日 */
  endDate: string
  /** エラー情報 */
  errors: string[]
}

/**
 * Fetchパラメータ
 */
export interface UserUsageFetchParams {
  /** 取得開始日時（Unix timestamp） */
  startTimestamp: number
  /** 取得終了日時（Unix timestamp） */
  endTimestamp: number
  /** 対象アプリ（指定しない場合は全アプリ） */
  apps?: DifyApp[]
}

/**
 * UserUsageFetcherインターフェース
 */
export interface UserUsageFetcher {
  /**
   * ユーザー別使用量を取得する
   * @param params 取得パラメータ
   * @returns 取得結果
   */
  fetch(params: UserUsageFetchParams): Promise<UserUsageFetchResult>
}

/**
 * UserUsageFetcherを作成する
 * @param deps 依存関係
 * @returns UserUsageFetcherインスタンス
 */
export function createUserUsageFetcher(deps: UserUsageFetcherDeps): UserUsageFetcher {
  const { difyClient, logger } = deps

  /**
   * Unix timestampをYYYY-MM-DD形式に変換
   */
  function timestampToDate(timestamp: number): string {
    const date = new Date(timestamp * 1000)
    return date.toISOString().split('T')[0]
  }

  /**
   * メッセージからユーザーIDを取得
   */
  function getUserInfo(
    message: DifyMessage,
    conversation: DifyConversation,
  ): { userId: string; userType: 'end_user' | 'account' } {
    // メッセージのユーザー情報を優先
    if (message.from_end_user_id) {
      return { userId: message.from_end_user_id, userType: 'end_user' }
    }
    if (message.from_account_id) {
      return { userId: message.from_account_id, userType: 'account' }
    }
    // 会話のユーザー情報にフォールバック
    if (conversation.from_end_user_id) {
      return { userId: conversation.from_end_user_id, userType: 'end_user' }
    }
    if (conversation.from_account_id) {
      return { userId: conversation.from_account_id, userType: 'account' }
    }
    // 不明な場合
    return { userId: 'unknown', userType: 'end_user' }
  }

  /**
   * レコードをユーザー別に集計
   */
  function aggregateByUser(records: UserUsageRecord[]): UserUsageSummary[] {
    const aggregated = new Map<
      string,
      {
        userType: 'end_user' | 'account'
        appId: string
        appName: string
        messageTokens: number
        answerTokens: number
        totalTokens: number
        messageCount: number
        conversationIds: Set<string>
      }
    >()

    for (const record of records) {
      // キー: user_id|app_id
      const key = `${record.user_id}|${record.app_id}`

      const existing = aggregated.get(key) || {
        userType: record.user_type,
        appId: record.app_id,
        appName: record.app_name,
        messageTokens: 0,
        answerTokens: 0,
        totalTokens: 0,
        messageCount: 0,
        conversationIds: new Set<string>(),
      }

      existing.messageTokens += record.message_tokens
      existing.answerTokens += record.answer_tokens
      existing.totalTokens += record.total_tokens
      existing.messageCount += 1
      existing.conversationIds.add(record.conversation_id)

      aggregated.set(key, existing)
    }

    // Mapを配列に変換
    const summaries: UserUsageSummary[] = []
    for (const [key, data] of aggregated) {
      const [userId] = key.split('|')
      summaries.push({
        user_id: userId,
        user_type: data.userType,
        app_id: data.appId,
        app_name: data.appName,
        total_message_tokens: data.messageTokens,
        total_answer_tokens: data.answerTokens,
        total_tokens: data.totalTokens,
        message_count: data.messageCount,
        conversation_count: data.conversationIds.size,
      })
    }

    // ユーザーID、アプリIDでソート
    summaries.sort((a, b) => {
      const userCompare = a.user_id.localeCompare(b.user_id)
      if (userCompare !== 0) return userCompare
      return a.app_id.localeCompare(b.app_id)
    })

    return summaries
  }

  return {
    async fetch(params: UserUsageFetchParams): Promise<UserUsageFetchResult> {
      const { startTimestamp, endTimestamp, apps: providedApps } = params
      const startDate = timestampToDate(startTimestamp)
      const endDate = timestampToDate(endTimestamp)
      const records: UserUsageRecord[] = []
      const errors: string[] = []

      logger.info('ユーザー別使用量取得開始', { startDate, endDate })

      try {
        // アプリ一覧を取得（指定がなければ全アプリ）
        const apps = providedApps ?? (await difyClient.fetchApps())
        logger.info('対象アプリ数', { count: apps.length })

        // 各アプリの会話・メッセージを取得
        for (const app of apps) {
          try {
            // Chat系アプリのみ対象（completion系は会話がない）
            if (app.mode !== 'chat' && app.mode !== 'advanced-chat' && app.mode !== 'agent-chat') {
              logger.debug('Chatアプリではないためスキップ', { appId: app.id, mode: app.mode })
              continue
            }

            // 会話一覧を取得
            const conversations = await difyClient.fetchConversations({
              appId: app.id,
              start: startTimestamp,
              end: endTimestamp,
            })

            logger.debug('会話取得完了', { appId: app.id, count: conversations.length })

            // 各会話のメッセージを取得
            for (const conversation of conversations) {
              try {
                const messages = await difyClient.fetchMessages({
                  appId: app.id,
                  conversationId: conversation.id,
                })

                // メッセージをレコードに変換
                for (const message of messages) {
                  // 期間フィルタ（メッセージ単位）
                  const messageDate = timestampToDate(message.created_at)
                  if (messageDate < startDate || messageDate > endDate) {
                    continue
                  }

                  const { userId, userType } = getUserInfo(message, conversation)

                  records.push({
                    date: messageDate,
                    app_id: app.id,
                    app_name: app.name,
                    user_id: userId,
                    user_type: userType,
                    conversation_id: conversation.id,
                    message_id: message.id,
                    message_tokens: message.message_tokens,
                    answer_tokens: message.answer_tokens,
                    total_tokens: message.message_tokens + message.answer_tokens,
                  })
                }
              } catch (error) {
                const errorMessage = `会話 ${conversation.id} のメッセージ取得失敗: ${error}`
                logger.warn(errorMessage)
                errors.push(errorMessage)
              }
            }
          } catch (error) {
            const errorMessage = `アプリ ${app.id} の会話取得失敗: ${error}`
            logger.warn(errorMessage)
            errors.push(errorMessage)
          }
        }

        // ユーザー別に集計
        const summaries = aggregateByUser(records)

        logger.info('ユーザー別使用量取得完了', {
          recordCount: records.length,
          summaryCount: summaries.length,
          errorCount: errors.length,
        })

        return {
          success: errors.length === 0,
          records,
          summaries,
          startDate,
          endDate,
          errors,
        }
      } catch (error) {
        const errorMessage = `ユーザー別使用量取得失敗: ${error}`
        logger.error(errorMessage)
        errors.push(errorMessage)

        return {
          success: false,
          records,
          summaries: [],
          startDate,
          endDate,
          errors,
        }
      }
    },
  }
}
