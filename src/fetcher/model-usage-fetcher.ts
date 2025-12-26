/**
 * モデル別使用量Fetcher
 *
 * 全アプリモード（workflow, advanced-chat, agent-chat, chat, completion）から
 * モデル別トークン・コスト情報を取得する。
 *
 * - workflow: /workflow-runs → /node-executions（LLMノードごとの詳細）
 * - advanced-chat / agent-chat: /chat-conversations → /chat-messages → workflow_run_id → /node-executions
 * - chat / completion: /apps/{id}（モデル設定）→ /statistics/token-costs（日次集計）
 *   ※ ワークフローがないため、アプリ = モデルの1:1マッピング
 */

import type { Logger } from '../logger/winston-logger.js'
import type { DifyAppDetail, DifyMessage, DifyNodeExecution } from '../types/dify-usage.js'
import type { DifyApiClient, DifyApp } from './dify-api-client.js'

/**
 * モデル別使用量Fetcher作成時の依存関係
 */
export interface ModelUsageFetcherDeps {
  difyClient: DifyApiClient
  logger: Logger
}

/**
 * モデル別使用量レコード（1つのLLMノード実行）
 */
export interface ModelUsageRecord {
  /** 日付 (YYYY-MM-DD) */
  date: string
  /** アプリID */
  app_id: string
  /** アプリ名 */
  app_name: string
  /** ワークフロー実行ID */
  workflow_run_id: string
  /** ノードID */
  node_id: string
  /** ノードタイトル */
  node_title: string
  /** ユーザーID */
  user_id: string
  /** ユーザータイプ */
  user_type: 'end_user' | 'account'
  /** モデルプロバイダー */
  model_provider: string
  /** モデル名 */
  model_name: string
  /** 入力トークン数 */
  prompt_tokens: number
  /** 出力トークン数 */
  completion_tokens: number
  /** 合計トークン数 */
  total_tokens: number
  /** 入力価格 */
  prompt_price: number
  /** 出力価格 */
  completion_price: number
  /** 合計価格 */
  total_price: number
  /** 通貨 */
  currency: string
}

/**
 * モデル別サマリーレコード
 */
export interface ModelUsageSummary {
  /** ユーザーID */
  user_id: string
  /** ユーザータイプ */
  user_type: 'end_user' | 'account'
  /** モデルプロバイダー */
  model_provider: string
  /** モデル名 */
  model_name: string
  /** アプリID */
  app_id: string
  /** アプリ名 */
  app_name: string
  /** 合計入力トークン数 */
  total_prompt_tokens: number
  /** 合計出力トークン数 */
  total_completion_tokens: number
  /** 合計トークン数 */
  total_tokens: number
  /** 合計価格 */
  total_price: number
  /** 通貨 */
  currency: string
  /** 実行回数 */
  execution_count: number
}

/**
 * モデル別使用量取得パラメータ
 */
export interface FetchModelUsageParams {
  /** 開始日時（Unix timestamp） */
  startTimestamp: number
  /** 終了日時（Unix timestamp） */
  endTimestamp: number
}

/**
 * モデル別使用量取得結果
 */
export interface ModelUsageFetchResult {
  /** 成功フラグ */
  success: boolean
  /** 個別レコード */
  records: ModelUsageRecord[]
  /** ユーザー・モデル別サマリー */
  summaries: ModelUsageSummary[]
  /** エラー一覧 */
  errors: string[]
  /** 取得開始日 */
  startDate: string
  /** 取得終了日 */
  endDate: string
}

/**
 * ModelUsageFetcherインターフェース
 */
export interface ModelUsageFetcher {
  fetch(params: FetchModelUsageParams): Promise<ModelUsageFetchResult>
}

/**
 * LLMノード実行からユーザー情報を取得するためのコンテキスト
 */
interface UserContext {
  userId: string
  userType: 'end_user' | 'account'
  createdAt?: number
}

/**
 * メッセージからユーザーコンテキストを取得
 */
function getUserContextFromMessage(message: DifyMessage): UserContext | null {
  if (message.from_end_user_id) {
    return {
      userId: message.from_end_user_id,
      userType: 'end_user',
      createdAt: message.created_at,
    }
  }
  if (message.from_account_id) {
    return {
      userId: message.from_account_id,
      userType: 'account',
      createdAt: message.created_at,
    }
  }
  return null
}

/**
 * LLMノード実行からModelUsageRecordを抽出
 * @param node ノード実行詳細
 * @param appId アプリID
 * @param appName アプリ名
 * @param workflowRunId ワークフロー実行ID
 * @param fallbackUserContext ノードにユーザー情報がない場合のフォールバック（メッセージから取得）
 */
function extractModelUsageFromNodeExecution(
  node: DifyNodeExecution,
  appId: string,
  appName: string,
  workflowRunId: string,
  fallbackUserContext?: UserContext | null,
  logger?: Logger,
): ModelUsageRecord | null {
  // process_dataからモデル情報を取得（usageがあるノードのみ処理）
  const processData = node.process_data
  if (!processData || !processData.usage) {
    return null
  }

  // LLM以外のノードタイプでもトークンを消費する場合がある
  // 例: agent, question-classifier, parameter-extractor, knowledge-retrieval
  if (node.node_type !== 'llm' && logger) {
    logger.debug('非LLMノードからトークン情報を取得', {
      nodeType: node.node_type,
      nodeTitle: node.title,
      totalTokens: processData.usage.total_tokens,
    })
  }

  const usage = processData.usage

  // ユーザー情報を取得（ノード → フォールバックの順）
  let userId: string
  let userType: 'end_user' | 'account'

  if (node.created_by_end_user?.id) {
    userId = node.created_by_end_user.id
    userType = 'end_user'
  } else if (node.created_by_account?.id) {
    userId = node.created_by_account.id
    userType = 'account'
  } else if (fallbackUserContext) {
    // ノードにユーザー情報がない場合はフォールバックを使用
    userId = fallbackUserContext.userId
    userType = fallbackUserContext.userType
  } else {
    // ユーザー情報がない場合はunknownとして処理
    userId = 'unknown'
    userType = 'account'
  }

  // 日付を変換（ノード → フォールバックの順）
  let date: string
  if (node.created_at) {
    date = new Date(node.created_at * 1000).toISOString().split('T')[0]
  } else if (fallbackUserContext?.createdAt) {
    date = new Date(fallbackUserContext.createdAt * 1000).toISOString().split('T')[0]
  } else {
    date = new Date().toISOString().split('T')[0]
  }

  return {
    date,
    app_id: appId,
    app_name: appName,
    workflow_run_id: workflowRunId,
    node_id: node.node_id,
    node_title: node.title || 'LLM',
    user_id: userId,
    user_type: userType,
    model_provider: processData.model_provider || 'unknown',
    model_name: processData.model_name || 'unknown',
    prompt_tokens: usage.prompt_tokens || 0,
    completion_tokens: usage.completion_tokens || 0,
    total_tokens: usage.total_tokens || 0,
    prompt_price: Number.parseFloat(usage.prompt_price || '0'),
    completion_price: Number.parseFloat(usage.completion_price || '0'),
    total_price: Number.parseFloat(usage.total_price || '0'),
    currency: usage.currency || 'USD',
  }
}

/**
 * レコードをユーザー・モデル別にサマリー化
 */
function summarizeByUserAndModel(records: ModelUsageRecord[]): ModelUsageSummary[] {
  const summaryMap = new Map<string, ModelUsageSummary>()

  for (const record of records) {
    const key = `${record.user_id}:${record.model_provider}:${record.model_name}:${record.app_id}`

    const existing = summaryMap.get(key)
    if (existing) {
      existing.total_prompt_tokens += record.prompt_tokens
      existing.total_completion_tokens += record.completion_tokens
      existing.total_tokens += record.total_tokens
      existing.total_price += record.total_price
      existing.execution_count += 1
    } else {
      summaryMap.set(key, {
        user_id: record.user_id,
        user_type: record.user_type,
        model_provider: record.model_provider,
        model_name: record.model_name,
        app_id: record.app_id,
        app_name: record.app_name,
        total_prompt_tokens: record.prompt_tokens,
        total_completion_tokens: record.completion_tokens,
        total_tokens: record.total_tokens,
        total_price: record.total_price,
        currency: record.currency,
        execution_count: 1,
      })
    }
  }

  return Array.from(summaryMap.values())
}

/**
 * モデル別使用量Fetcherを作成する
 */
export function createModelUsageFetcher(deps: ModelUsageFetcherDeps): ModelUsageFetcher {
  const { difyClient, logger } = deps

  /**
   * workflowモードのアプリからモデル使用量を取得
   * /workflow-runs → /node-executions
   */
  async function fetchFromWorkflowApp(
    app: DifyApp,
    startTimestamp: number,
    endTimestamp: number,
    records: ModelUsageRecord[],
    errors: string[],
  ): Promise<void> {
    try {
      const workflowRuns = await difyClient.fetchWorkflowRuns({
        appId: app.id,
        start: startTimestamp,
        end: endTimestamp,
      })

      logger.info('ワークフロー実行一覧取得完了', {
        appId: app.id,
        count: workflowRuns.length,
      })

      for (const run of workflowRuns) {
        try {
          const nodeExecutions = await difyClient.fetchNodeExecutions({
            appId: app.id,
            workflowRunId: run.id,
          })

          for (const node of nodeExecutions) {
            const record = extractModelUsageFromNodeExecution(node, app.id, app.name, run.id, null, logger)
            if (record) {
              records.push(record)
            }
          }
        } catch (error) {
          const errorMsg = `ノード実行取得エラー: ${app.name} / ${run.id}`
          logger.warn(errorMsg, { error })
          errors.push(errorMsg)
        }
      }
    } catch (error) {
      const errorMsg = `ワークフロー実行取得エラー: ${app.name}`
      logger.warn(errorMsg, { error })
      errors.push(errorMsg)
    }
  }

  /**
   * advanced-chat / agent-chat モードのアプリからモデル使用量を取得
   * /chat-conversations → /chat-messages → workflow_run_id → /node-executions
   * ワークフローデータがない場合は、token-costs APIへフォールバック
   */
  async function fetchFromChatApp(
    app: DifyApp,
    startTimestamp: number,
    endTimestamp: number,
    records: ModelUsageRecord[],
    errors: string[],
  ): Promise<void> {
    try {
      // 1. 会話一覧を取得
      const conversations = await difyClient.fetchConversations({
        appId: app.id,
        start: startTimestamp,
        end: endTimestamp,
      })

      logger.info('会話一覧取得完了', {
        appId: app.id,
        appName: app.name,
        count: conversations.length,
      })

      // 2. 各会話のメッセージを取得
      const processedWorkflowRunIds = new Set<string>()
      const recordsBeforeCount = records.length

      for (const conv of conversations) {
        try {
          const messages = await difyClient.fetchMessages({
            appId: app.id,
            conversationId: conv.id,
          })

          // 3. 各メッセージのworkflow_run_idからノード詳細を取得
          for (const message of messages) {
            const workflowRunId = message.workflow_run_id
            if (!workflowRunId) {
              continue
            }

            // 同じworkflow_run_idを重複処理しない
            if (processedWorkflowRunIds.has(workflowRunId)) {
              continue
            }
            processedWorkflowRunIds.add(workflowRunId)

            try {
              const nodeExecutions = await difyClient.fetchNodeExecutions({
                appId: app.id,
                workflowRunId: workflowRunId,
              })

              // メッセージからユーザーコンテキストを取得
              const userContext = getUserContextFromMessage(message)

              for (const node of nodeExecutions) {
                const record = extractModelUsageFromNodeExecution(
                  node,
                  app.id,
                  app.name,
                  workflowRunId,
                  userContext,
                  logger,
                )
                if (record) {
                  records.push(record)
                }
              }
            } catch (error) {
              const errorMsg = `ノード実行取得エラー: ${app.name} / ${workflowRunId}`
              logger.warn(errorMsg, { error })
              errors.push(errorMsg)
            }
          }
        } catch (error) {
          const errorMsg = `メッセージ取得エラー: ${app.name} / ${conv.id}`
          logger.warn(errorMsg, { error })
          errors.push(errorMsg)
        }
      }

      // 4. ワークフローデータが取得できなかった場合、token-costs APIへフォールバック
      const recordsAddedCount = records.length - recordsBeforeCount
      if (recordsAddedCount === 0 && conversations.length > 0) {
        logger.info('ワークフローデータなし、token-costs APIへフォールバック', {
          appId: app.id,
          appName: app.name,
          mode: app.mode,
          conversationCount: conversations.length,
        })

        // chat/completionアプリと同じ処理を実行
        await fetchFromSimpleChatApp(app, startTimestamp, endTimestamp, records, errors)
      } else {
        logger.debug('チャットアプリ処理完了', {
          appId: app.id,
          appName: app.name,
          workflowRunCount: processedWorkflowRunIds.size,
          recordsAdded: recordsAddedCount,
        })
      }
    } catch (error) {
      const errorMsg = `会話取得エラー: ${app.name}`
      logger.warn(errorMsg, { error })
      errors.push(errorMsg)
    }
  }

  /**
   * アプリ詳細からモデル情報を抽出
   */
  function extractModelInfo(appDetail: DifyAppDetail): { provider: string; model: string } | null {
    // model_config 内のネストされた model オブジェクトを確認
    // 構造: model_config.model.provider / model_config.model.name
    const nestedModel = (appDetail.model_config as Record<string, unknown>)?.model as
      | { provider?: string; name?: string; model?: string }
      | undefined
    if (nestedModel?.provider && (nestedModel?.name || nestedModel?.model)) {
      // provider が "langgenius/openai/openai" のような形式の場合、最後の部分を使用
      let provider = nestedModel.provider
      if (provider.includes('/')) {
        const parts = provider.split('/')
        provider = parts[parts.length - 1]
      }
      return {
        provider,
        model: nestedModel.name || nestedModel.model || 'unknown',
      }
    }

    // model_config.provider / model_config.model を確認（フラット構造）
    if (appDetail.model_config?.provider && appDetail.model_config?.model) {
      return {
        provider: appDetail.model_config.provider,
        model: appDetail.model_config.model,
      }
    }

    // model_config.model_id がある場合（provider:model 形式の可能性）
    if (appDetail.model_config?.model_id) {
      const parts = appDetail.model_config.model_id.split('/')
      if (parts.length >= 2) {
        return {
          provider: parts[0],
          model: parts.slice(1).join('/'),
        }
      }
      return {
        provider: 'unknown',
        model: appDetail.model_config.model_id,
      }
    }

    // トップレベルの model オブジェクトから取得
    if (appDetail.model?.provider && (appDetail.model?.name || appDetail.model?.model)) {
      return {
        provider: appDetail.model.provider,
        model: appDetail.model.name || appDetail.model.model || 'unknown',
      }
    }

    return null
  }

  /**
   * chat / completion モードのアプリからモデル使用量を取得
   * ワークフローがないため、アプリ = モデルの1:1マッピング
   * /apps/{id}（モデル設定）→ /statistics/token-costs（日次集計）
   */
  async function fetchFromSimpleChatApp(
    app: DifyApp,
    startTimestamp: number,
    endTimestamp: number,
    records: ModelUsageRecord[],
    errors: string[],
  ): Promise<void> {
    try {
      // 1. アプリ詳細を取得してモデル情報を取得
      const appDetail = await difyClient.fetchAppDetails({ appId: app.id })
      const modelInfo = extractModelInfo(appDetail)

      if (!modelInfo) {
        logger.warn('モデル情報が取得できません', {
          appId: app.id,
          appName: app.name,
          mode: app.mode,
        })
        errors.push(`モデル情報取得不可: ${app.name}`)
        return
      }

      logger.debug('アプリモデル情報取得', {
        appId: app.id,
        appName: app.name,
        provider: modelInfo.provider,
        model: modelInfo.model,
      })

      // 2. トークンコストを取得（日次集計）
      const startDate = new Date(startTimestamp * 1000)
      const endDate = new Date(endTimestamp * 1000)

      // APIのstart/endパラメータ形式: YYYY-MM-DD HH:mm
      const startStr = `${startDate.toISOString().split('T')[0]} 00:00`
      const endStr = `${endDate.toISOString().split('T')[0]} 23:59`

      const tokenCosts = await difyClient.fetchAppTokenCosts({
        appId: app.id,
        start: startStr,
        end: endStr,
      })

      logger.debug('トークンコスト取得完了', {
        appId: app.id,
        appName: app.name,
        count: tokenCosts.data.length,
      })

      // 3. 日次データからレコードを生成
      for (const cost of tokenCosts.data) {
        // chat/completionモードは入力/出力の内訳がないため、
        // total_tokensを全てprompt_tokensとして扱う
        // ※ API_Meter側のバリデーション（total = prompt + completion）を満たすため
        const record: ModelUsageRecord = {
          date: cost.date,
          app_id: app.id,
          app_name: app.name,
          // chat/completionモードにはworkflow_run_idがないため、日次集計IDを生成
          workflow_run_id: `daily-${app.id}-${cost.date}`,
          node_id: 'direct-llm',
          node_title: 'Direct LLM Call',
          // chat/completionモードはユーザー単位の内訳がないため、アプリ全体として記録
          user_id: 'app-aggregate',
          user_type: 'account',
          model_provider: modelInfo.provider,
          model_name: modelInfo.model,
          // DifyのAPIは入力/出力の内訳を提供しないため、全てprompt_tokensとして記録
          prompt_tokens: cost.token_count,
          completion_tokens: 0,
          total_tokens: cost.token_count,
          prompt_price: Number.parseFloat(cost.total_price),
          completion_price: 0,
          total_price: Number.parseFloat(cost.total_price),
          currency: cost.currency,
        }
        records.push(record)
      }

      logger.info('chat/completionアプリ処理完了', {
        appId: app.id,
        appName: app.name,
        mode: app.mode,
        recordCount: tokenCosts.data.length,
      })
    } catch (error) {
      const errorMsg = `chat/completionアプリ処理エラー: ${app.name}`
      logger.warn(errorMsg, { error })
      errors.push(errorMsg)
    }
  }

  return {
    async fetch(params: FetchModelUsageParams): Promise<ModelUsageFetchResult> {
      const { startTimestamp, endTimestamp } = params
      const records: ModelUsageRecord[] = []
      const errors: string[] = []

      const startDate = new Date(startTimestamp * 1000).toISOString().split('T')[0]
      const endDate = new Date(endTimestamp * 1000).toISOString().split('T')[0]

      logger.info('モデル別使用量取得開始', { startDate, endDate })

      try {
        // 1. アプリ一覧を取得
        const apps = await difyClient.fetchApps()
        logger.info('アプリ取得完了', { count: apps.length })

        // 2. モード別にアプリを分類
        const workflowApps = apps.filter((app: DifyApp) => app.mode === 'workflow')
        const advancedChatApps = apps.filter(
          (app: DifyApp) => app.mode === 'advanced-chat' || app.mode === 'agent-chat',
        )
        const simpleChatApps = apps.filter(
          (app: DifyApp) => app.mode === 'chat' || app.mode === 'completion',
        )

        logger.info('アプリ分類完了', {
          workflowApps: workflowApps.length,
          advancedChatApps: advancedChatApps.length,
          simpleChatApps: simpleChatApps.length,
        })

        // 3. workflowモードのアプリを処理
        for (const app of workflowApps) {
          await fetchFromWorkflowApp(app, startTimestamp, endTimestamp, records, errors)
        }

        // 4. advanced-chat / agent-chat モードのアプリを処理
        for (const app of advancedChatApps) {
          await fetchFromChatApp(app, startTimestamp, endTimestamp, records, errors)
        }

        // 5. chat / completion モードのアプリを処理（ワークフローなし）
        for (const app of simpleChatApps) {
          await fetchFromSimpleChatApp(app, startTimestamp, endTimestamp, records, errors)
        }

        // 6. サマリー化
        const summaries = summarizeByUserAndModel(records)

        logger.info('モデル別使用量取得完了', {
          recordCount: records.length,
          summaryCount: summaries.length,
          errorCount: errors.length,
        })

        return {
          success: errors.length === 0 || records.length > 0,
          records,
          summaries,
          errors,
          startDate,
          endDate,
        }
      } catch (error) {
        const errorMsg = `モデル別使用量取得エラー: ${error}`
        logger.error(errorMsg, { error })
        errors.push(errorMsg)

        return {
          success: false,
          records,
          summaries: [],
          errors,
          startDate,
          endDate,
        }
      }
    },
  }
}
