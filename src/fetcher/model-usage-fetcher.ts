/**
 * モデル別使用量Fetcher
 *
 * ワークフロー実行のノード詳細からLLMノードのモデル別トークン・コスト情報を取得する。
 * ユーザー別・モデル別の詳細なコスト分析を可能にする。
 */

import type { Logger } from '../logger/winston-logger.js'
import type { DifyNodeExecution } from '../types/dify-usage.js'
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
 * LLMノード実行からModelUsageRecordを抽出
 */
function extractModelUsageFromNodeExecution(
  node: DifyNodeExecution,
  appId: string,
  appName: string,
  workflowRunId: string,
): ModelUsageRecord | null {
  // LLMノード以外はスキップ
  if (node.node_type !== 'llm') {
    return null
  }

  // process_dataからモデル情報を取得
  const processData = node.process_data
  if (!processData || !processData.usage) {
    return null
  }

  const usage = processData.usage

  // ユーザー情報を取得
  let userId: string
  let userType: 'end_user' | 'account'

  if (node.created_by_end_user?.id) {
    userId = node.created_by_end_user.id
    userType = 'end_user'
  } else if (node.created_by_account?.id) {
    userId = node.created_by_account.id
    userType = 'account'
  } else {
    // ユーザー情報がない場合はスキップ
    return null
  }

  // 日付を変換
  const date = node.created_at
    ? new Date(node.created_at * 1000).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]

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

        // 2. ワークフロー対応アプリのみフィルタ
        const workflowApps = apps.filter(
          (app: DifyApp) =>
            app.mode === 'workflow' || app.mode === 'advanced-chat' || app.mode === 'agent-chat',
        )
        logger.info('ワークフローアプリ数', { count: workflowApps.length })

        // 3. 各アプリのワークフロー実行を取得
        for (const app of workflowApps) {
          try {
            const workflowRuns = await difyClient.fetchWorkflowRuns({
              appId: app.id,
              start: startTimestamp,
              end: endTimestamp,
            })

            logger.debug('ワークフロー実行取得', {
              appId: app.id,
              appName: app.name,
              count: workflowRuns.length,
            })

            // 4. 各ワークフロー実行のノード詳細を取得
            for (const run of workflowRuns) {
              try {
                const nodeExecutions = await difyClient.fetchNodeExecutions({
                  appId: app.id,
                  workflowRunId: run.id,
                })

                // 5. LLMノードからモデル別使用量を抽出
                for (const node of nodeExecutions) {
                  const record = extractModelUsageFromNodeExecution(node, app.id, app.name, run.id)
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

        // 6. サマリー化
        const summaries = summarizeByUserAndModel(records)

        logger.info('モデル別使用量取得完了', {
          recordCount: records.length,
          summaryCount: summaries.length,
          errorCount: errors.length,
        })

        return {
          success: errors.length === 0,
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
